"use server";

import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { INDISPONIBLE } from "@/lib/indisponible";
import { createClient } from "@/lib/supabase/server";
import { ESPACE_LIVRES, estUuid } from "./regles";

// Les actions du lecteur des étudiants (étape B ; migration 0074). La base décide de l'accès : chemin_livre ne donne le
// chemin du PDF qu'à qui peut lire le livre, la règle de l'espace « bibliotheque » le revérifie au moment de signer, et
// noter_telechargement refuse un livre non téléchargeable. Aucun texte de migration ici : ces actions servent aux
// étudiants (message neutre si la base n'a pas encore la Bibliothèque).

const INACCESSIBLE = "Ce livre n’est pas accessible.";
const LIEN_ECHEC = "Le lien du livre n’a pas pu être préparé. Réessayez.";
/** Le lien signé sert au téléchargement du fichier, en une fois : deux minutes suffisent même pour 50 Mo à démarrer. */
const DUREE_LIEN = 120;

type ErreurBase = { code?: string; message?: string } | null;
const typographie = (message: string) => message.replace(/'/g, "’");
/** Le message d'un refus de la base (accès, téléchargement, débit), ou un message neutre. */
function messageRefus(e: ErreurBase, defaut: string): string {
  if (estFonctionAbsente(e)) return INDISPONIBLE;
  if ((e?.code === "P0001" || e?.code === "42501") && e.message && !/permission denied|row-level/i.test(e.message)) return typographie(e.message);
  return defaut;
}

async function lienSigne(livreId: string): Promise<{ url: string } | { erreur: string }> {
  const supabase = await createClient();
  const { data: chemin, error } = await supabase.rpc("chemin_livre", { p_livre: livreId });
  if (error || typeof chemin !== "string" || !chemin) return { erreur: messageRefus(error, INACCESSIBLE) };
  const lien = await supabase.storage.from(ESPACE_LIVRES).createSignedUrl(chemin, DUREE_LIEN);
  const url = lien.error ? "" : (lien.data?.signedUrl ?? "");
  return url ? { url } : { erreur: LIEN_ECHEC };
}

/** Le lien de lecture (lecteur intégré, pdf.js) : le PDF est lu une fois, à l'ouverture du livre. */
export async function lienLectureLivre(livreId: string): Promise<{ url: string } | { erreur: string }> {
  if (!estUuid(livreId)) return { erreur: INACCESSIBLE };
  try {
    return await lienSigne(livreId);
  } catch {
    return { erreur: LIEN_ECHEC };
  }
}

/** Le lien de téléchargement d'un livre téléchargeable : noté par la base, puis signé avec le titre comme nom du fichier. */
export async function lienTelechargementLivre(livreId: string, titre: string): Promise<{ url: string } | { erreur: string }> {
  if (!estUuid(livreId)) return { erreur: INACCESSIBLE };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("noter_telechargement", { p_livre: livreId });
    if (error) return { erreur: messageRefus(error, INACCESSIBLE) };
    const lien = await lienSigne(livreId);
    if ("erreur" in lien) return lien;
    // Le nom est ajouté ici : passé en option, la bibliothèque l'encoderait deux fois (comme lienRessource).
    const nom = `${(String(titre ?? "").trim() || "livre").replace(/[/\\]/g, "-").slice(0, 150)}.pdf`;
    return { url: `${lien.url}&download=${encodeURIComponent(nom)}` };
  } catch {
    return { erreur: LIEN_ECHEC };
  }
}

/** Note la page lue (le lecteur l'appelle quand la page change, pas à chaque défilement) ; rend l'état de la lecture. */
export async function noterLecture(
  livreId: string,
  page: number,
  total: number,
): Promise<{ ok: true; lecture: { dernierePage: number; nbPages: number; pourcentage: number; terminee: boolean } } | { ok: false; erreur: string }> {
  if (!estUuid(livreId) || !Number.isInteger(page) || !Number.isInteger(total)) return { ok: false, erreur: INACCESSIBLE };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("noter_lecture", { p_livre: livreId, p_page: page, p_total: total });
    if (error) return { ok: false, erreur: messageRefus(error, INACCESSIBLE) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      lecture: {
        dernierePage: Number(r.derniere_page) || 1,
        nbPages: Number(r.nb_pages) || total,
        pourcentage: Number(r.pourcentage) || 0,
        terminee: r.terminee === true,
      },
    };
  } catch {
    return { ok: false, erreur: INACCESSIBLE };
  }
}
