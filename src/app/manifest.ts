import type { MetadataRoute } from "next";

const PWA_ASSET_BASE = "/images/golazopool_pwa_pack/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GolazoPool",
    short_name: "GolazoPool",
    description:
      "Plataforma de pronosticos deportivos para el Mundial de Futbol FIFA 2026.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EEF2F5",
    theme_color: "#004A99",
    categories: ["sports", "entertainment"],
    icons: [
      {
        src: `${PWA_ASSET_BASE}/icon-48-48.png`,
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-72-72.png`,
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-96-96.png`,
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-128-128.png`,
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-144-144.png`,
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-152-152.png`,
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-192-192.png`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-256-256.png`,
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-384-384.png`,
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/icon-512-512.png`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `${PWA_ASSET_BASE}/maskable-icon-512-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
