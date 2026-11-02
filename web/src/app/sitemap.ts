import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listFormationsDuPlan, type FormationDuPlan } from "@/lib/catalogue/plan-du-site";
import { adresseDuSite } from "@/lib/site/adresse";
import { planDuSite } from "@/lib/site/referencement";

/**
 * sitemap.xml : les pages publiques, les fiches des formations publiées et les profils de leurs formateurs, lus à la
 * requête (comme le catalogue). Sans base ou si la lecture échoue : les pages fixes seulement.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Rendu à la requête, jamais pendant le build : hors du try, pour que l'arrêt du pré-rendu ne passe pas pour une erreur.
  await connection();
  let formations: FormationDuPlan[] = [];
  try {
    formations = await listFormationsDuPlan();
  } catch (erreur) {
    console.error("Plan du site : formations illisibles, pages fixes seulement.", erreur);
  }
  return planDuSite(adresseDuSite(), formations);
}
