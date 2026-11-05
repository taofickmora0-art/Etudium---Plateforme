import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { clientResultats } from "./acces";
import { COLONNES_PARCOURS, versEtat, versParcoursComplet } from "./conversion";
import type { EtatResultats, ParcoursComplet } from "./types";

// Les lectures de « Mes résultats » (migration 0077), côté serveur, avec le jeton de déverrouillage : la base ne rend
// rien d'autre que les résultats du compte, et rien du tout si l'espace est verrouillé.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const echec = (quoi: string, e: { code?: string; message?: string }) => new Error(`Lecture ${quoi} impossible : ${e.message ?? e.code}`);
const tableAbsente = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";

/** L'état de l'espace (code, ouverture, blocage, proposition vue) ; null avant la 0077. Ouvert, il se prolonge. */
export async function lireEtatResultats(): Promise<EtatResultats | null> {
  if (demoModeActive()) return { pin: false, ouvert: true, bloqueJusqua: null, propose: true };
  const { data, error } = await (await clientResultats()).rpc("etat_resultats");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw echec("de l'état des résultats", error);
  }
  return versEtat(data);
}

/** Tous les parcours du compte, chacun avec son contenu (pour leurs moyennes et leurs crédits). */
export async function lireParcoursComplets(): Promise<ParcoursComplet[]> {
  if (demoModeActive()) return [];
  const { data, error } = await (await clientResultats()).from("parcours_scolaires").select(COLONNES_PARCOURS).order("ordre");
  if (error) {
    if (tableAbsente(error)) return [];
    throw echec("des parcours", error);
  }
  return (Array.isArray(data) ? data : []).map(versParcoursComplet).filter((p): p is ParcoursComplet => p !== null);
}

/** Un parcours du compte ; null s'il n'existe pas (ou pas pour ce compte). */
export async function lireParcoursComplet(id: string): Promise<ParcoursComplet | null> {
  if (demoModeActive() || !UUID.test(id)) return null;
  const { data, error } = await (await clientResultats()).from("parcours_scolaires").select(COLONNES_PARCOURS).eq("id", id).maybeSingle();
  if (error) {
    if (tableAbsente(error)) return null;
    throw echec("du parcours", error);
  }
  return versParcoursComplet(data);
}
