import { NextResponse } from "next/server";
import { z } from "zod";

import { sameOrigin } from "@/lib/auth";
import {
  accountSchema,
  providerSchema,
  callTool,
  connectionStatus,
  pooledHistory,
  saveHistory,
  serialized,
} from "@/lib/commerce";
import type { Purchase } from "@/lib/commerce";
import { getCache, setCache, hash, rateLimit } from "@/lib/db";

const command = z.object({
  account: accountSchema,
  action: z.enum(["addresses", "search", "add", "cart", "history"]),
  addressId: z.string().max(200).optional(),
  page: z.number().int().min(1).max(30).optional(),
  productId: z.string().max(200).optional(),
  provider: providerSchema,
  quantity: z.number().int().min(1).max(20).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  requestId: z.string().uuid().optional(),
});
const itemSchema = z.object({ name: z.string(), quantity: z.number() });
const swiggyCart = z.object({
  cartTotalAmount: z.string().optional(),
  cartWarning: z.object({ message: z.string() }).optional(),
  items: z.array(
    z.object({
      itemName: z.string(),
      quantity: z.number().int().positive(),
      skuId: z.string(),
      spinId: z.string(),
    })
  ),
  selectedAddress: z.string().optional(),
});
export interface ProductResult {
  id: string;
  name: string;
  pack: string;
  price: number;
  available: boolean;
  spinId?: string;
  skuId?: string;
}
export async function GET() {
  return NextResponse.json(
    {
      accounts: (["sid", "partner"] as const).map((id) => ({
        blinkit: connectionStatus(id, "blinkit"),
        id,
        swiggy: connectionStatus(id, "swiggy"),
      })),
      history: await pooledHistory(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }
  try {
    const b = command.parse(await req.json());
    const key = `${b.account}:${b.provider}`;
    if (!(await rateLimit(`commerce:${key}`, 150))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    if (!connectionStatus(b.account, b.provider)) {
      throw new Error("This cart isn’t available yet.");
    }
    if (b.action === "addresses") {
      if (b.provider === "blinkit") {
        return NextResponse.json({
          addresses: [],
          location: "Saved delivery address",
        });
      }
      const data = z
        .object({
          addresses: z.array(
            z.object({
              addressCategory: z.string().optional(),
              addressTag: z.string().optional(),
              id: z.string(),
            })
          ),
          pagination: z.object({ hasMore: z.boolean() }).optional(),
        })
        .parse(
          await callTool(b.account, b.provider, "get_addresses", {
            page: b.page || 1,
            pageSize: 10,
          })
        );
      const list = data.addresses.map((a, i) => ({
        id: a.id,
        label:
          a.addressTag ||
          a.addressCategory ||
          `Saved address ${((b.page || 1) - 1) * 10 + i + 1}`,
      }));
      const prior = JSON.parse((await getCache(`addresses:${key}`)) || "[]");
      await setCache(`addresses:${key}`, JSON.stringify([...prior, ...list]));
      return NextResponse.json({
        addresses: list,
        hasMore: data.pagination?.hasMore ?? false,
      });
    }
    if (b.action === "history") {
      const payload = await serialized(key, () =>
        callTool(
          b.account,
          b.provider,
          b.provider === "swiggy" ? "get_orders" : "get_order_history",
          b.provider === "swiggy" ? { count: 20 } : { limit: 20 }
        )
      );
      let orders: Purchase[];
      if (b.provider === "swiggy") {
        const data = z
          .object({
            orders: z.array(
              z.object({
                createdAt: z.string(),
                items: z.array(itemSchema),
                orderId: z.string(),
                status: z.string(),
              })
            ),
          })
          .parse(payload);
        orders = data.orders.map((o) => ({
          account: b.account,
          date: o.createdAt,
          id: hash(key + o.orderId),
          items: o.items,
          provider: b.provider,
          status: o.status,
        }));
      } else {
        const data = z
          .array(
            z.object({
              date: z.string(),
              items: z.array(itemSchema).optional(),
              order_id: z.string(),
              status: z.string(),
            })
          )
          .parse(payload);
        orders = data.map((o) => ({
          account: b.account,
          date: o.date,
          id: hash(key + o.order_id),
          items: o.items || [],
          provider: b.provider,
          status: o.status,
        }));
      }
      await saveHistory(b.account, b.provider, orders);
      return NextResponse.json({
        history: await pooledHistory(),
        message: `Synced ${orders.length} recent orders.`,
      });
    }
    if (b.action === "cart") {
      const data = await serialized(key, () =>
        callTool(b.account, b.provider, "get_cart")
      );
      if (b.provider === "swiggy") {
        const c = swiggyCart.parse(data);
        return NextResponse.json({
          items: c.items.map((i) => ({
            name: i.itemName,
            quantity: i.quantity,
          })),
          total: c.cartTotalAmount,
          warning: c.cartWarning?.message,
        });
      }
      const c = z
        .object({
          items: z.array(itemSchema),
          total: z.number(),
          warning: z.string().optional(),
        })
        .parse(data);
      return NextResponse.json(c);
    }
    if (b.provider === "swiggy") {
      const ids = JSON.parse((await getCache(`addresses:${key}`)) || "[]") as {
        id: string;
      }[];
      if (!b.addressId || !ids.some((a) => a.id === b.addressId)) {
        throw new Error("Load and select a saved delivery address first.");
      }
    }
    if (b.action === "search") {
      if (!b.query) {
        throw new Error("Enter an ingredient to search.");
      }
      const payload = await serialized(key, () =>
        callTool(
          b.account,
          b.provider,
          "search_products",
          b.provider === "swiggy"
            ? { addressId: b.addressId, query: b.query }
            : { limit: 15, query: b.query }
        )
      );
      let products: ProductResult[];
      if (b.provider === "swiggy") {
        const data = z
          .object({
            products: z.array(
              z.object({
                displayName: z.string(),
                variations: z.array(
                  z.object({
                    displayName: z.string(),
                    isInStockAndAvailable: z.boolean(),
                    price: z.object({ offerPrice: z.number() }),
                    quantityDescription: z.string(),
                    skuId: z.string(),
                    spinId: z.string(),
                  })
                ),
              })
            ),
          })
          .parse(payload);
        products = data.products.flatMap((p) =>
          p.variations.map((v) => ({
            available: v.isInStockAndAvailable,
            id: v.skuId,
            name: v.displayName || p.displayName,
            pack: v.quantityDescription,
            price: v.price.offerPrice,
            skuId: v.skuId,
            spinId: v.spinId,
          }))
        );
      } else {
        const data = z
          .object({
            products: z.array(
              z.object({
                id: z.string(),
                in_stock: z.boolean(),
                name: z.string(),
                price: z.number(),
                unit: z.string(),
              })
            ),
          })
          .parse(payload);
        products = data.products.map((p) => ({
          available: p.in_stock,
          id: p.id,
          name: p.name,
          pack: p.unit,
          price: p.price,
        }));
      }
      await setCache(
        `search:${key}`,
        JSON.stringify({
          addressId: b.addressId || null,
          expires: Date.now() + 600_000,
          products,
        })
      );
      return NextResponse.json({ products });
    }
    if (b.action === "add") {
      if (!b.productId || !b.requestId) {
        throw new Error("Select a product from search results.");
      }
      return await serialized(key, async () => {
        const receipt = await getCache(`receipt:${key}:${b.requestId}`);
        if (receipt) {
          const saved = JSON.parse(receipt);
          return NextResponse.json(saved, { status: saved.error ? 409 : 200 });
        }
        const cache = JSON.parse(
          (await getCache(`search:${key}`)) || "null"
        ) as {
          products: ProductResult[];
          expires: number;
          addressId: string | null;
        } | null;
        const product = cache?.products.find((p) => p.id === b.productId);
        if (
          !cache ||
          cache.expires < Date.now() ||
          !product?.available ||
          cache.addressId !== (b.addressId || null)
        ) {
          throw new Error(
            "Product results expired or address changed. Search again before adding."
          );
        }
        const quantity = b.quantity || 1;
        // Persist before a provider mutation: a timeout must never turn a retry into a duplicate addition.
        const pendingReceipt = async () => {
          await setCache(
            `receipt:${key}:${b.requestId}`,
            JSON.stringify({
              error: "Check your cart before adding again.",
            })
          );
        };
        // Preserve the existing provider cart; never replace it with only the new item.
        if (b.provider === "swiggy") {
          const existing = swiggyCart.parse(
            await callTool(b.account, b.provider, "get_cart")
          );
          if (
            existing.items.length &&
            existing.selectedAddress !== b.addressId
          ) {
            throw new Error(
              "This cart uses a different delivery address. Review it in Swiggy first."
            );
          }
          const items = existing.items.map(
            ({ spinId, skuId, quantity: previousQuantity }) => ({
              quantity: previousQuantity,
              skuId,
              spinId,
            })
          );
          const old = items.find((i) => i.skuId === product.skuId);
          if (old) {
            old.quantity += quantity;
          } else {
            items.push({
              quantity,
              skuId: product.skuId ?? "",
              spinId: product.spinId ?? "",
            });
          }
          await pendingReceipt();
          await callTool(b.account, b.provider, "update_cart", {
            items,
            selectedAddressId: b.addressId,
          });
          const updated = swiggyCart.parse(
            await callTool(b.account, b.provider, "get_cart")
          );
          const wanted = items.find((i) => i.skuId === product.skuId)?.quantity;
          const actual = updated.items.find(
            (i) => i.skuId === product.skuId
          )?.quantity;
          if (actual !== wanted) {
            throw new Error(
              "The cart quantity could not be verified. Review the cart before retrying; stock limits may apply."
            );
          }
        } else {
          await pendingReceipt();
          await callTool(b.account, b.provider, "add_to_cart", {
            product_id: product.id,
            quantity,
          });
        }
        const result = {
          message: `Added ${quantity} × ${product.name} to the selected account’s cart.`,
          requestId: b.requestId,
        };
        await setCache(`receipt:${key}:${b.requestId}`, JSON.stringify(result));
        return NextResponse.json(result);
      });
    }
    throw new Error("Unsupported action.");
  } catch (error) {
    const schema = error instanceof z.ZodError;
    return NextResponse.json(
      {
        error: schema
          ? "Couldn’t read the result. Check your cart before retrying."
          : error instanceof Error
            ? error.message
            : "Provider request failed.",
      },
      { status: 400 }
    );
  }
}
