import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Termwise College ERP", short_name: "Termwise", start_url: "/home", display: "standalone",
    background_color: "#f2f4f7", theme_color: "#f2f4f7",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
