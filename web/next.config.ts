import type { NextConfig } from "next";
import { assertNoSecretKey } from "./src/lib/env";

// Une clé secrète dans une variable NEXT_PUBLIC_ serait recopiée dans le code envoyé au navigateur : on refuse de démarrer.
assertNoSecretKey(process.env);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
