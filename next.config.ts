import "./src/env";
import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  transpilePackages: ["ios-haptics"],
};
export default config;
