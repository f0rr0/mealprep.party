import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f5f4ed",
    description: "Meals, sorted.",
    display: "standalone",
    icons: (["any", "maskable"] as const).map((purpose) => ({
      purpose,
      sizes: "1024x1024",
      src: purpose === "maskable" ? "/app-icon-maskable.png" : "/app-icon.png",
      type: "image/png",
    })),
    name: "mealprep.party",
    short_name: "mealprep.party",
    start_url: "/",
    theme_color: "#344b3b",
  };
}
