import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { versFil, versGroupe, versGroupeDeFormation, versResume } from "./conversion";
import type { FilGroupe, Groupe, GroupeDeFormation, MessageGroupe, ResumeGroupe } from "./types";

// Les lectures des groupes (migration 0075), côté serveur. La base vérifie tout : on ne lit que ses groupes. Les images
// (espace privé « groupes ») reçoivent un lien temporaire d'une heure.

type Client = Awaited<ReturnType<typeof createClient>>;
type Erreur = { code?: string; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Pour retrouver le message d'une notification : 10 pages de 50 au plus. */
const PAGES_MAX = 10;

const echec = (quoi: string, error: Erreur) => new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);

/** Les liens temporaires des images et des notes vocales (0076), en un seul appel ; un lien manquant reste null. */
export async function avecImages(supabase: Client, messages: MessageGroupe[]): Promise<MessageGroupe[]> {
  const chemins = [...new Set(messages.flatMap((m) => [m.vocal?.chemin, m.image?.chemin].filter((c): c is string => Boolean(c))))];
  if (chemins.length === 0) return messages;
  const { data, error } = await supabase.storage.from("groupes").createSignedUrls(chemins, 3600);
  const liens = new Map<string, string>();
  if (!error) for (const lien of data ?? []) if (lien.path && lien.signedUrl && !lien.error) liens.set(lien.path, lien.signedUrl);
  return messages.map((m) => ({
    ...m,
    image: m.image ? { ...m.image, url: liens.get(m.image.chemin) ?? null } : null,
    vocal: m.vocal ? { ...m.vocal, url: liens.get(m.vocal.chemin) ?? null } : null,
  }));
}

/** Mes groupes : le Général, ceux de mes parcours, ceux de mes formations. */
export async function lireMesGroupes(): Promise<Lecture<ResumeGroupe[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_groupes");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("des groupes", error);
  }
  return { migrationAbsente: false, donnees: liste(data).map(versResume) };
}

/** Une page du fil (la plus récente, ou celle d'avant le message `avant`), images comprises. */
export async function lirePage(supabase: Client, groupeId: string, avant: string | null): Promise<{ fil: FilGroupe } | { error: Erreur }> {
  const { data, error } = await supabase.rpc("messages_groupe", { p_groupe: groupeId, p_avant: avant, p_limite: 50 });
  if (error) return { error };
  const fil = versFil(data);
  return { fil: { ...fil, messages: await avecImages(supabase, fil.messages) } };
}

/**
 * Un groupe par son adresse et, s'il est ouvert au compte, son fil. `cible` (le message d'une notification) : les pages
 * précédentes sont lues jusqu'à le trouver (10 au plus). Null : le groupe n'existe pas.
 */
export async function lireGroupe(slug: string, cible: string | null = null): Promise<Lecture<{ groupe: Groupe; fil: FilGroupe | null } | null>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("groupe_par_slug", { p_slug: slug });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("du groupe", error);
  }
  const groupe = versGroupe(data);
  if (!groupe) return { migrationAbsente: false, donnees: null };
  if (!groupe.ouvert) return { migrationAbsente: false, donnees: { groupe, fil: null } };
  const premiere = await lirePage(supabase, groupe.id, null);
  if ("error" in premiere) throw echec("des messages", premiere.error);
  const fil = premiere.fil;
  if (cible && UUID.test(cible)) {
    for (let page = 1; page < PAGES_MAX && fil.plusAnciens && !fil.messages.some((m) => m.id === cible); page++) {
      const suite = await lirePage(supabase, groupe.id, fil.messages[0]?.id ?? null);
      if ("error" in suite) break;
      fil.messages = [...suite.fil.messages, ...fil.messages];
      fil.plusAnciens = suite.fil.plusAnciens;
    }
  }
  return { migrationAbsente: false, donnees: { groupe, fil } };
}

/**
 * Le groupe d'une formation (fiche, leçons, réglage). Ce n'est pas l'essentiel de ces pages : une autre erreur que la
 * migration absente donne null (rien n'est affiché), sans faire échouer la page.
 */
export async function lireGroupeFormation(formationId: string): Promise<Lecture<GroupeDeFormation | null>> {
  if (demoModeActive() || !UUID.test(formationId)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("groupe_formation", { p_formation: formationId });
  if (error) return estFonctionAbsente(error) ? { migrationAbsente: true } : { migrationAbsente: false, donnees: null };
  return { migrationAbsente: false, donnees: versGroupeDeFormation(data) };
}

/** Le groupe d'une formation pour la fiche et les leçons : null s'il n'y a rien à montrer. */
export async function groupeDeLaFormation(formationId: string): Promise<GroupeDeFormation | null> {
  try {
    const lu = await lireGroupeFormation(formationId);
    return lu.migrationAbsente ? null : lu.donnees;
  } catch {
    return null;
  }
}
