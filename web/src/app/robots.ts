import type { MetadataRoute } from "next";
import { adresseDuSite } from "@/lib/site/adresse";
import { CHEMINS_FERMES, CHEMINS_OUVERTS } from "@/lib/site/referencement";

/** robots.txt : tout est permis, sauf l'espace connecté, le back-office, l'espace formateur, l'API et les pages de compte. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: CHEMINS_OUVERTS, disallow: CHEMINS_FERMES },
    sitemap: `${adresseDuSite()}/sitemap.xml`,
  };
}
