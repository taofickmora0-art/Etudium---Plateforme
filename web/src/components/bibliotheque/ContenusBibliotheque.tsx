import { notFound, redirect } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Heading } from "@/components/ui/Text";
import type { ShellUser } from "@/lib/auth/current-user";
import { aDomaine } from "@/lib/auth/domaines";
import { lireCatalogue, lireFicheLivre, lireMesLectures } from "@/lib/bibliotheque/data";
import { adresseLivre, ecrireFiltresBibliotheque, lireFiltresBibliotheque, MIGRATION_BIBLIOTHEQUE } from "@/lib/bibliotheque/regles";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { renvoyerFormateur } from "@/lib/catalogue/garde-formateur";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { FicheDeLivre } from "./FicheDeLivre";
import { LecteurLivre } from "./LecteurLivre";
import { PageBibliotheque } from "./PageBibliotheque";

// Les pages publiques de la Bibliothèque assemblées (étape B) : ce qu'elles lisent selon le compte (visiteur, compte
// connecté), et le cas de la base sans la 0074. Les pages de src/app ne font que les poser dans leur Suspense.

const estEquipe = (compte: ShellUser | null) => compte !== null && aDomaine(compte.roles, "contenus");

/**
 * La base n'a pas encore la Bibliothèque : l'équipe des contenus lit la migration à appliquer ; un étudiant ou un
 * visiteur, le message neutre (« Cette fonction n'est pas disponible pour le moment. »).
 */
export function BibliothequeAbsente({ equipe }: { equipe: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <Heading level="page">Bibliothèque</Heading>
      {equipe ? (
        <Banner tone="attention" title="La Bibliothèque n’est pas encore dans la base.">
          {MIGRATION_BIBLIOTHEQUE}
        </Banner>
      ) : (
        <BandeauIndisponible />
      )}
    </div>
  );
}

/** « Continuer la lecture » ne doit jamais empêcher la page de s'afficher : illisible, la rangée disparaît (avec une trace). */
async function lecturesOuRien(): Promise<CarteLivre[]> {
  try {
    return await lireMesLectures();
  } catch (erreur) {
    console.error("Lecture de « Continuer la lecture » impossible :", erreur instanceof Error ? erreur.message : erreur);
    return [];
  }
}

/**
 * La page Bibliothèque : un visiteur dans le cadre public, un compte connecté dans la coque de l'appli (avec ses livres
 * commencés). Le catalogue est lu en entier, puis filtré dans le navigateur (filtres de l'adresse au premier affichage).
 * Un formateur, qui n'a pas d'espace étudiant (R1), va à son tableau de bord, comme pour le catalogue des formations.
 */
export async function ContenuBibliotheque({ params }: { params: Record<string, string | string[] | undefined> }) {
  const compte = await compteConnecte();
  await renvoyerFormateur(compte);
  const [catalogue, lectures] = await Promise.all([lireCatalogue(), compte ? lecturesOuRien() : Promise.resolve([])]);
  if (!catalogue) return <BibliothequeAbsente equipe={estEquipe(compte)} />;
  const filtres = lireFiltresBibliotheque(params);
  // La clé suit les filtres de l'adresse : « Bibliothèque » dans le menu repart de zéro au lieu de garder l'état précédent.
  return (
    <PageBibliotheque
      key={ecrireFiltresBibliotheque(filtres) || "tous"}
      variante={compte ? "connecte" : "public"}
      catalogue={catalogue}
      filtresInitiaux={filtres}
      lectures={lectures}
    />
  );
}

/** La fiche d'un livre : introuvable s'il n'existe pas ou n'est pas publié (un brouillon s'ouvre pour l'équipe seule). */
export async function ContenuFicheLivre({ slug }: { slug: string }) {
  const [compte, fiche] = await Promise.all([compteConnecte(), lireFicheLivre(slug)]);
  await renvoyerFormateur(compte);
  if (fiche === "absente") return <BibliothequeAbsente equipe={estEquipe(compte)} />;
  if (!fiche) notFound();
  return <FicheDeLivre fiche={fiche} variante={compte ? "connecte" : "public"} />;
}

/**
 * Le lecteur, pour un compte qui a l'accès au livre : à la page de l'adresse (« Relire » : `?page=1`), sinon à la
 * dernière page lue. Sans accès (visiteur, sans abonnement, compte suspendu) ou sans la 0074 : retour à la fiche, qui
 * dit quoi faire. Un livre inconnu : page introuvable.
 */
export async function ContenuLecteur({ slug, params }: { slug: string; params: Record<string, string | string[] | undefined> }) {
  const [compte, fiche] = await Promise.all([compteConnecte(), lireFicheLivre(slug)]);
  await renvoyerFormateur(compte);
  if (fiche === null) notFound();
  if (fiche === "absente" || fiche.accesEtat !== "ouvert") redirect(adresseLivre(slug));
  const brute = Array.isArray(params.page) ? params.page[0] : params.page;
  const demandee = brute && /^\d{1,6}$/.test(brute) ? Number(brute) : null;
  return (
    <LecteurLivre
      livre={{ id: fiche.id, slug: fiche.slug, titre: fiche.titre, telechargeable: fiche.telechargeable }}
      pageDepart={demandee ?? fiche.lecture?.dernierePage ?? 1}
    />
  );
}
