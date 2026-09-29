import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f5f4ed",
    description: "Meals, sorted.",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "192x192", src: "/icon.png", type: "image/png" },
    ],
    name: "mealprep.party",
    short_name: "mealprep.party",
    start_url: "/",
    theme_color: "#344b3b",
  };
}
