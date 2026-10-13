import { cache } from "react";
import { demoModeActive } from "@/lib/auth/current-user";
import type { Badge, CouleurParcours, Niveau } from "@/lib/contenus/libelles";
import { estColonneAbsente, liste, parOrdre, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { CarteCatalogue, FicheFormation, LeconFiche, ModuleFiche, ParcoursCatalogue } from "./types";

// Lecture du catalogue : formations publiées seulement, même pour l'équipe (les brouillons se voient au back-office).
// Les règles d'accès de la 0004 s'appliquent (un visiteur est « anon ») ; le contenu des leçons (vidéo) n'est jamais lu ici.

/** Forme d'une adresse de formation (spec §2) : sinon, page introuvable sans interroger la base. */
const ADRESSE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const COLONNES_PARCOURS = "slug, nom, nom_court, couleur, ordre, actif";
const COLONNES_CARTE =
  "id, slug, titre, resume, niveau, gratuite, achat_separe, badge, publiee_le, " + `formations_parcours(ordre, parcours(${COLONNES_PARCOURS}))`;

// Note moyenne et nombre d'avis (migration 0010). Sans la 0010, la colonne manque (42703) : on relit sans elles.
const COLONNES_NOTE = ", note_moyenne, nb_avis";
type Reponse = { data: unknown; error: { code?: string; message?: string } | null };

async function avecNotes(lire: (notes: string) => PromiseLike<Reponse>): Promise<unknown> {
  const reponse = await lire(COLONNES_NOTE);
  if (estColonneAbsente(reponse.error)) return verifier(await lire(""));
  return verifier(reponse);
}

const versParcours = (p: Ligne): ParcoursCatalogue => ({
  slug: texte(p.slug),
  nom: texte(p.nom),
  nomCourt: texte(p.nom_court),
  couleur: p.couleur as CouleurParcours,
  ordre: Number(p.ordre ?? 0),
});

/** Les champs communs à la carte et à la fiche ; `lecons` donne la durée et le nombre de leçons. */
function versCarte(f: Ligne, lecons: Ligne[]): CarteCatalogue {
  const parcours = liste(f.formations_parcours)
    .map((lien) => ({ lien, p: un(lien.parcours) }))
    .filter(({ p }) => p && p.actif !== false)
    .map(({ lien, p }) => ({ ...versParcours(p as Ligne), position: Number(lien.ordre ?? 0) }))
    .sort(parOrdre);
  return {
    id: String(f.id),
    slug: texte(f.slug),
    titre: texte(f.titre),
    resume: texte(f.resume),
    niveau: f.niveau as Niveau,
    gratuite: f.gratuite === true,
    achatSepare: f.achat_separe === true,
    badge: (f.badge as Badge | null) ?? null,
    publieeLe: texte(f.publiee_le),
    dureeSecondes: lecons.reduce((total, l) => total + Number(l.duree_secondes ?? 0), 0),
    nbLecons: lecons.length,
    parcours,
    note: f.note_moyenne === null || f.note_moyenne === undefined ? null : Number(f.note_moyenne),
    nbAvis: Number(f.nb_avis ?? 0),
  };
}

export async function listCatalogue(): Promise<CarteCatalogue[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = (await avecNotes((notes) =>
    supabase.from("formations").select(`${COLONNES_CARTE}${notes}, modules(lecons(duree_secondes))`).eq("statut", "publiee"),
  )) as Ligne[] | null;
  return (lignes ?? []).map((f) => versCarte(f, liste(f.modules).flatMap((m) => liste(m.lecons))));
}

export async function listParcoursCatalogue(): Promise<ParcoursCatalogue[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("parcours").select(`${COLONNES_PARCOURS}, description`).eq("actif", true).order("ordre")) as Ligne[] | null;
  return (lignes ?? []).map((p) => ({ ...versParcours(p), description: texte(p.description) }));
}

const versLecon = (l: Ligne): LeconFiche & { ordre: number } => ({
  id: String(l.id),
  titre: texte(l.titre),
  titreCourt: texte(l.titre_court) || null,
  dureeSecondes: Number(l.duree_secondes ?? 0),
  apercu: l.apercu === true,
  accessible: l.accessible === true,
  ordre: Number(l.ordre ?? 0),
});

const colonnesFiche = (notes: string) =>
  `${COLONNES_CARTE}${notes}, description, seuil_video, objectifs, competences, formateurs(nom, titre, domaine, presentation), ` +
  "modules(id, titre, ordre, lecons(id, titre, titre_court, duree_secondes, apercu, ordre, accessible))";

/** Une ligne de formation (avec son programme) → fiche : modules et leçons dans l'ordre. */
function versFiche(f: Ligne): FicheFormation {
  const modules = liste(f.modules)
    .map((m) => ({ id: String(m.id), titre: texte(m.titre), ordre: Number(m.ordre ?? 0), lecons: liste(m.lecons).map(versLecon).sort(parOrdre) }))
    .sort(parOrdre);
  const formateur = un(f.formateurs);
  return {
    ...versCarte(
      f,
      modules.flatMap((m) => m.lecons.map((l) => ({ duree_secondes: l.dureeSecondes }))),
    ),
    description: texte(f.description),
    seuilVideo: Number(f.seuil_video ?? 90),
    objectifs: textes(f.objectifs),
    competences: textes(f.competences),
    formateur: formateur
      ? { nom: texte(formateur.nom), titre: texte(formateur.titre), domaine: texte(formateur.domaine), presentation: texte(formateur.presentation) }
      : null,
    modules: modules.map(
      (m): ModuleFiche => ({
        id: m.id,
        titre: m.titre,
        lecons: m.lecons.map((l) => ({ id: l.id, titre: l.titre, titreCourt: l.titreCourt, dureeSecondes: l.dureeSecondes, apercu: l.apercu, accessible: l.accessible })),
      }),
    ),
  };
}

/**
 * La fiche d'une formation publiée, avec son programme dans l'ordre ; null si l'adresse ne correspond à rien.
 * Lue une seule fois par requête : la page et ses métadonnées (aperçu du lien) la demandent toutes deux.
 */
export const getFiche = cache(async (slug: string): Promise<FicheFormation | null> => {
  if (demoModeActive() || !ADRESSE.test(slug)) return null;
  const supabase = await createClient();
  const f = (await avecNotes((notes) => supabase.from("formations").select(colonnesFiche(notes)).eq("statut", "publiee").eq("slug", slug).maybeSingle())) as Ligne | null;
  return f ? versFiche(f) : null;
});

export type StatutFiche = "publiee" | "archivee" | "brouillon";

/**
 * Les fiches de plusieurs formations (Mes formations, Favoris), quel que soit leur statut : les règles de la base
 * décident (une formation archivée reste visible pour qui l'a commencée, migration 0009).
 */
export async function listFiches(ids: string[]): Promise<(FicheFormation & { statut: StatutFiche })[]> {
  if (demoModeActive() || ids.length === 0) return [];
  const supabase = await createClient();
  const lignes = (await avecNotes((notes) => supabase.from("formations").select(`${colonnesFiche(notes)}, statut`).in("id", ids))) as Ligne[] | null;
  return liste(lignes).map((f) => ({ ...versFiche(f), statut: (texte(f.statut) || "publiee") as StatutFiche }));
}
