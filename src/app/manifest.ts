import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f5f4ed",
    description: "Meals, recipes and groceries for our home.",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "any", src: "/icon.svg", type: "image/svg+xml" },
    ],
    name: "Our Kitchen",
    short_name: "Kitchen",
    start_url: "/",
    theme_color: "#344b3b",
  };
}
