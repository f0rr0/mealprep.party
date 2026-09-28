import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

import { env } from "../env";
import { getCache, setCache } from "./db";

export { serialized } from "./db";

export type Account = "sid" | "partner";
export type Provider = "swiggy" | "blinkit";
export interface Purchase {
  id: string;
  account: Account;
  provider: Provider;
  date: string;
  status: string;
  items: { name: string; quantity: number }[];
}
export const accountSchema = z.enum(["sid", "partner"]);
export const providerSchema = z.enum(["swiggy", "blinkit"]);
// No arbitrary tool passthrough. Checkout, payment and order placement are unreachable.
const allowedTools = {
  blinkit: ["search_products", "get_cart", "add_to_cart", "get_order_history"],
  swiggy: [
    "get_addresses",
    "search_products",
    "get_cart",
    "update_cart",
    "get_orders",
  ],
};
export function assertAllowed(provider: Provider, name: string) {
  if (!allowedTools[provider].includes(name)) {
    throw new Error("This app cannot place orders or make payments.");
  }
}
export function providerConfig(account: Account, provider: Provider) {
  if (provider === "swiggy") {
    return {
      token:
        account === "sid"
          ? env.SWIGGY_SID_ACCESS_TOKEN
          : env.SWIGGY_PARTNER_ACCESS_TOKEN,
      url: "https://mcp.swiggy.com/im",
    };
  }
  return account === "sid"
    ? { token: env.BLINKIT_SID_MCP_TOKEN, url: env.BLINKIT_SID_MCP_URL }
    : {
        token: env.BLINKIT_PARTNER_MCP_TOKEN,
        url: env.BLINKIT_PARTNER_MCP_URL,
      };
}
export function connectionStatus(account: Account, provider: Provider) {
  const config = providerConfig(account, provider);
  return Boolean(config.url && config.token);
}
export async function callTool(
  account: Account,
  provider: Provider,
  name: string,
  args: Record<string, unknown> = {}
) {
  assertAllowed(provider, name);
  const config = providerConfig(account, provider);
  if (!config.url || !config.token) {
    throw new Error("This cart isn’t available yet.");
  }
  const client = new Client({ name: "our-kitchen", version: "1.0.0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: {
          headers: { Authorization: `Bearer ${config.token}` },
          signal: AbortSignal.timeout(30_000),
        },
      })
    );
    const result = await client.callTool({ arguments: args, name }, undefined, {
      timeout: 30_000,
    });
    if (result.isError) {
      throw new TypeError("This store is unavailable. Try again later.");
    }
    let payload: unknown = result.structuredContent;
    if (!payload) {
      const content = result.content as { type: string; text?: string }[];
      const raw = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error(
          "Couldn’t read the store’s response. Check your cart before retrying."
        );
      }
    }
    const parsed = payload as { success?: boolean; data?: unknown };
    if (parsed.success === false) {
      throw new Error(
        "The store couldn’t complete this request. Check your cart."
      );
    }
    return parsed.data ?? payload;
  } finally {
    await client.close().catch(() => {
      /* empty */
    });
  }
}
export async function saveHistory(
  account: Account,
  provider: Provider,
  orders: Purchase[]
) {
  await setCache(
    `history:${provider}:${account}`,
    JSON.stringify({ orders, syncedAt: new Date().toISOString() })
  );
}
export async function pooledHistory() {
  const results = await Promise.all(
    (["sid", "partner"] as const).flatMap((account) =>
      (["swiggy", "blinkit"] as const).map(async (provider) => {
        const raw = await getCache(`history:${provider}:${account}`);
        return raw ? (JSON.parse(raw).orders as Purchase[]) : [];
      })
    )
  );
  return results
    .flat()
    .toSorted((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
