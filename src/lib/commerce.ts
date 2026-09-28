import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

import { env } from "../env";
import { getCache, setCache } from "./db";

export { serialized } from "./db";

export type Provider = "swiggy" | "blinkit";
export interface Purchase {
  id: string;
  account: string;
  provider: Provider;
  date: string;
  status: string;
  items: { name: string; quantity: number }[];
}
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
export function providerConfig(account: string, provider: Provider) {
  const config = Object.hasOwn(env.MCP_ACCOUNTS, account)
    ? env.MCP_ACCOUNTS[account]
    : undefined;
  return provider === "swiggy"
    ? { token: config?.swiggy?.token, url: "https://mcp.swiggy.com/im" }
    : { token: config?.blinkit?.token, url: config?.blinkit?.url };
}

export function connectionStatus(account: string, provider: Provider) {
  const config = providerConfig(account, provider);
  return Boolean(config.url && config.token);
}
export async function callTool(
  account: string,
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
  account: string,
  provider: Provider,
  orders: Purchase[]
) {
  await setCache(
    `history:${provider}:${account}`,
    JSON.stringify({ orders, syncedAt: new Date().toISOString() })
  );
}
export async function pooledHistory(accounts: string[]) {
  const results = await Promise.all(
    accounts.flatMap((account) =>
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
