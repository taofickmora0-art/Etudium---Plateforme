import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import type { Annonce, AnnonceEquipe } from "./types";

// L'annonce épinglée en tête des Actualités (spec du fil « Actualités », §2 ; migration 0021). La base ne la rend qu'aux
// comptes qui y ont droit ; l'affiche reçoit ici un lien temporaire (1 h).

const DUREE_LIEN = 3600;
type Client = Awaited<ReturnType<typeof createClient>>;
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const media = (valeur: unknown): Annonce["media"] => (valeur === "youtube" || valeur === "image" ? valeur : null);

async function lienAffiche(supabase: Client, chemin: string | null): Promise<string | null> {
  if (!chemin) return null;
  const { data, error } = await supabase.storage.from("communaute").createSignedUrl(chemin, DUREE_LIEN);
  return error ? null : (data?.signedUrl ?? null);
}

async function versAnnonce(supabase: Client, l: Ligne): Promise<Annonce> {
  const type = media(l.media);
  return {
    titre: texte(l.titre),
    texte: texte(l.texte),
    media: type,
    youtubeId: type === "youtube" ? texteOuNull(l.youtube_id) : null,
    image: type === "image" ? await lienAffiche(supabase, texteOuNull(l.image_chemin)) : null,
  };
}

/** L'annonce que voit le compte connecté ; null s'il n'y en a pas, avant la 0021 ou si la lecture échoue (ce n'est qu'un bandeau). */
export async function lireAnnonce(): Promise<Annonce | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("annonce_communaute");
  const l = error ? null : un(data);
  return l ? versAnnonce(supabase, l) : null;
}

/** Le réglage complet, pour le back-office ; l'affiche actuelle avec un lien temporaire pour l'aperçu. */
export async function lireAnnonceEquipe(): Promise<Lecture<AnnonceEquipe>> {
  const vide: AnnonceEquipe = { active: false, titre: "", texte: "", media: null, youtubeId: null, image: null, imageChemin: null, public: "tous", parcoursId: null };
  if (demoModeActive()) return { migrationAbsente: false, donnees: vide };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("annonce_equipe");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture de l’annonce impossible : ${error.message ?? error.code}`);
  }
  const l = un(data);
  if (!l) return { migrationAbsente: false, donnees: vide };
  const type = media(l.media);
  return {
    migrationAbsente: false,
    donnees: {
      ...(await versAnnonce(supabase, l)),
      active: l.active === true,
      imageChemin: type === "image" ? texteOuNull(l.image_chemin) : null,
      public: l.public === "parcours" ? "parcours" : "tous",
      parcoursId: texteOuNull(l.parcours_id),
    },
  };
}
