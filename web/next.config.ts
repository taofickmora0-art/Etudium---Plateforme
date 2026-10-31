import type { NextConfig } from "next";
import { motifsImages } from "./src/lib/couvertures/adresse";
import { assertNoSecretKey } from "./src/lib/env";

// Une clé secrète dans une variable NEXT_PUBLIC_ serait recopiée dans le code envoyé au navigateur : on refuse de démarrer.
assertNoSecretKey(process.env);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Tests sur téléphone, sur le même Wi-Fi (http://192.168.x.x:3000) : sans cela, Next bloque ses fichiers de
  // développement pour toute autre adresse que localhost, et la page reste sans réaction. Sans effet en production.
  // `nip.io` donne un nom à l'adresse (http://192.168.0.3.nip.io:3000) : Supabase refuse tout retour de connexion
  // (Google) vers une adresse en chiffres autre que localhost, mais accepte un nom inscrit dans ses Redirect URLs.
  allowedDevOrigins: ["192.168.*.*", "**.nip.io"],
  // Le rond « N » de Next en bas de l'écran recouvrait la barre du bas sur téléphone : masqué (développement seulement ;
  // une erreur s'affiche toujours en plein écran).
  devIndicators: false,
  // Couvertures des formations (espace public « couvertures ») : redimensionnées et compressées par next/image.
  images: { remotePatterns: motifsImages(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  partialPrefetching: true,
  // L'Accueil est la communauté (spec du nouvel Accueil, §4) : les anciens liens y mènent, `?espace=` compris.
  async redirects() {
    return [{ source: "/communaute", destination: "/accueil", permanent: false }];
  },
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
