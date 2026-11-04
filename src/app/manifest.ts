import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Termwise College ERP", short_name: "Termwise", start_url: "/home", display: "standalone",
    background_color: "#fafcfc", theme_color: "#0e5a66",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
