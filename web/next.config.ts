import type { NextConfig } from "next";
import { motifsImages } from "./src/lib/couvertures/adresse";
import { assertNoSecretKey } from "./src/lib/env";

// Une clé secrète dans une variable NEXT_PUBLIC_ serait recopiée dans le code envoyé au navigateur : on refuse de démarrer.
assertNoSecretKey(process.env);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Couvertures des formations (espace public « couvertures ») : redimensionnées et compressées par next/image.
  images: { remotePatterns: motifsImages(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  partialPrefetching: true,
  experimental: {
    // Photo de profil : 2 Mo au plus, plus l'enveloppe de l'envoi (1 Mo par défaut).
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
