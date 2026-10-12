import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipebox",
    short_name: "Recipebox",
    description: "Plan meals and keep your weekly shopping list in one place.",
    start_url: "/shop",
    display: "standalone",
    background_color: "#fff7e8",
    theme_color: "#f4a51c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
