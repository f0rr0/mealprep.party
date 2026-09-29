import "./src/env";
import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  transpilePackages: ["ios-haptics"],
};
export default config;
