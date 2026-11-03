import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listFormationsDuPlan, listLivresDuPlan, type FormationDuPlan, type LivreDuPlan } from "@/lib/catalogue/plan-du-site";
import { adresseDuSite } from "@/lib/site/adresse";
import { planDuSite } from "@/lib/site/referencement";

/**
 * sitemap.xml : les pages publiques, les fiches des formations publiées, les profils de leurs formateurs et les fiches
 * des livres publiés, lus à la requête (comme le catalogue). Sans base ou si une lecture échoue : les pages fixes, et ce
 * que l'autre lecture a donné.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Rendu à la requête, jamais pendant le build : hors du try, pour que l'arrêt du pré-rendu ne passe pas pour une erreur.
  await connection();
  let formations: FormationDuPlan[] = [];
  let livres: LivreDuPlan[] = [];
  const [lusFormations, lusLivres] = await Promise.allSettled([listFormationsDuPlan(), listLivresDuPlan()]);
  if (lusFormations.status === "fulfilled") formations = lusFormations.value;
  else console.error("Plan du site : formations illisibles, pages fixes seulement.", lusFormations.reason);
  if (lusLivres.status === "fulfilled") livres = lusLivres.value;
  else console.error("Plan du site : livres illisibles.", lusLivres.reason);
  return planDuSite(adresseDuSite(), formations, livres);
}
