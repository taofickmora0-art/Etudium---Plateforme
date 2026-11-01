import { demoModeActive } from "@/lib/auth/current-user";
import { videoRangee } from "@/lib/communaute/video";
import { estFonctionAbsente, liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import type { LigneSessionEdition, ListeSessionsEdition, ProchaineSession, SessionCarte, SessionDetail, StatutSession, VueSessions } from "./types";

// Lectures des sessions live (migration 0018). La base ne livre le lien que dans sa fenêtre, et jamais d'adresse e-mail.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nombre = (valeur: unknown) => Number(valeur) || 0;
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const statut = (valeur: unknown): StatutSession => (valeur === "annulee" ? "annulee" : "programmee");
function parcours(valeur: unknown) {
  const p = un(valeur);
  return p ? { nomCourt: texte(p.nom_court), couleur: texte(p.couleur) } : null;
}

export function versCarte(l: Ligne): SessionCarte {
  return {
    id: texte(l.id),
    titre: texte(l.titre),
    description: texte(l.description),
    debut: texte(l.debut),
    dureeMinutes: nombre(l.duree_minutes),
    plateforme: texte(l.plateforme),
    lien: texteOuNull(l.lien),
    parcours: parcours(l.parcours),
    animateur: texte(l.animateur),
    inscriptions: nombre(l.inscriptions),
    inscrit: l.inscrit === true,
    statut: statut(l.statut),
    // Réservée aux abonnés (0050) : la clé n'apparaît que pour un live fermé au compte.
    ...(l.reservee === true ? { reservee: true } : {}),
  };
}

function versLigne(l: Ligne): LigneSessionEdition {
  return {
    id: texte(l.id),
    titre: texte(l.titre),
    debut: texte(l.debut),
    dureeMinutes: nombre(l.duree_minutes),
    plateforme: texte(l.plateforme),
    statut: statut(l.statut),
    inscriptions: nombre(l.inscriptions),
    parcours: parcours(l.parcours),
    animateur: texte(l.animateur),
  };
}

function versListe(data: unknown): ListeSessionsEdition {
  const brut = un(data);
  return { aVenir: liste(brut?.a_venir).map(versLigne), passees: liste(brut?.passees).map(versLigne) };
}

function versDetail(l: Ligne): SessionDetail {
  const p = un(l.parcours);
  return {
    id: texte(l.id),
    titre: texte(l.titre),
    description: texte(l.description),
    debut: texte(l.debut),
    dureeMinutes: nombre(l.duree_minutes),
    plateforme: texte(l.plateforme),
    lien: texteOuNull(l.lien),
    parcours: p ? { id: texte(p.id), nomCourt: texte(p.nom_court), couleur: texte(p.couleur) } : null,
    formateurId: texteOuNull(l.formateur_id),
    animateur: texte(l.animateur),
    statut: statut(l.statut),
    annuleeLe: texteOuNull(l.annulee_le),
    inscrits: liste(l.inscrits).map((i) => ({ prenom: texte(i.prenom), nom: texte(i.nom) })),
    promoImage: versAffiche(l.promo_image),
    promoVideo: videoRangee(l.promo_video),
  };
}

function versAffiche(valeur: unknown): SessionDetail["promoImage"] {
  const a = un(valeur);
  const chemin = texteOuNull(a?.chemin);
  if (!a || !chemin) return null;
  return { chemin, nom: texte(a.nom), type: texte(a.type), taille: nombre(a.taille), url: null };
}

type Erreur = { code?: string; message?: string };

/** Rend la lecture, migrationAbsente sans la 0018, et relance toute autre erreur. */
function lecture<T>(quoi: string, error: Erreur | null, convertir: () => T): Lecture<T> {
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: convertir() };
}

/** Un onglet de la page Événements. */
export async function lireSessions(vue: VueSessions): Promise<Lecture<SessionCarte[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sessions_live", { p_vue: vue });
  return lecture("des sessions", error, () => liste(data).map(versCarte));
}

/** La carte de l'accueil ; null sans session à venir. */
export async function lireProchaineSession(): Promise<Lecture<ProchaineSession | null>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prochaine_session");
  return lecture("de la prochaine session", error, () => {
    const l = un(data);
    return l ? { ...versCarte(l), initiales: liste(l.initiales).map((i) => texte(i)) } : null;
  });
}

/** Les sessions du formateur connecté. */
export async function lireSessionsAnimees(): Promise<Lecture<ListeSessionsEdition>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sessions_animees");
  return lecture("des sessions du formateur", error, () => versListe(data));
}

/** Toutes les sessions, pour l'équipe. */
export async function lireSessionsEquipe(): Promise<Lecture<ListeSessionsEdition>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sessions_equipe");
  return lecture("des sessions", error, () => versListe(data));
}

/** La fiche d'une session, pour son animateur et l'équipe ; null sinon, ou pour un identifiant mal formé. */
export async function lireSessionDetail(id: string): Promise<Lecture<SessionDetail | null>> {
  if (!UUID.test(id)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("session_detail", { p_session: id });
  const lu = lecture("de la session", error, () => {
    const l = un(data);
    return l ? versDetail(l) : null;
  });
  // L'affiche, dans l'espace privé « communaute » : un lien temporaire (1 h) pour le formulaire.
  const affiche = "donnees" in lu ? lu.donnees?.promoImage : null;
  if (affiche) {
    const { data: lien } = await supabase.storage.from("communaute").createSignedUrl(affiche.chemin, 3600);
    affiche.url = lien?.signedUrl ?? null;
  }
  return lu;
}
