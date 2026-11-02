// Les chiffres clés des pages Avis, Corrections et Annonces du back-office (demande du 2 novembre 2026 : le style de
// l'espace étudiant). Calculés à partir des listes déjà lues : ni migration, ni accès au serveur.

const JOUR = 86_400_000;
const depuis = (iso: string, maintenant: Date) => (maintenant.getTime() - new Date(iso).getTime()) / JOUR;

export type ChiffresAvis = { noteMoyenne: number | null; visibles: number; nouveaux: number; masques: number };

/** La note moyenne des avis visibles (au dixième), leur nombre, les avis des 30 derniers jours, les avis masqués. */
export function chiffresAvis(avis: { note: number; masque: boolean; creeLe: string }[], maintenant: Date): ChiffresAvis {
  const visibles = avis.filter((a) => !a.masque);
  const somme = visibles.reduce((total, a) => total + a.note, 0);
  return {
    noteMoyenne: visibles.length > 0 ? Math.round((somme / visibles.length) * 10) / 10 : null,
    visibles: visibles.length,
    nouveaux: avis.filter((a) => depuis(a.creeLe, maintenant) <= 30).length,
    masques: avis.length - visibles.length,
  };
}

export type ChiffresCorrections = { aCorriger: number; enRetard: number; formations: number; plusAncienJours: number | null };

/** Les travaux à corriger, ceux qui attendent depuis plus de 7 jours, les formations concernées, le plus ancien dépôt. */
export function chiffresCorrections(corrections: { formationId: string; deposeLe: string }[], maintenant: Date): ChiffresCorrections {
  const attentes = corrections.map((c) => depuis(c.deposeLe, maintenant));
  return {
    aCorriger: corrections.length,
    enRetard: attentes.filter((jours) => jours > 7).length,
    formations: new Set(corrections.map((c) => c.formationId)).size,
    plusAncienJours: attentes.length > 0 ? Math.max(0, Math.floor(Math.max(...attentes))) : null,
  };
}

export type ChiffresAnnonces = { envoyees: number; sur30Jours: number; derniere: { titre: string; creeLe: string; destinataires: number } | null };

/** Les annonces envoyées, celles des 30 derniers jours, la plus récente et le nombre de comptes qu'elle a touchés. */
export function chiffresAnnonces(annonces: { titre: string; creeLe: string; destinataires: number }[], maintenant: Date): ChiffresAnnonces {
  const recente = annonces.reduce<(typeof annonces)[number] | null>((plus, a) => (!plus || Date.parse(a.creeLe) > Date.parse(plus.creeLe) ? a : plus), null);
  return {
    envoyees: annonces.length,
    sur30Jours: annonces.filter((a) => depuis(a.creeLe, maintenant) <= 30).length,
    derniere: recente && { titre: recente.titre, creeLe: recente.creeLe, destinataires: recente.destinataires },
  };
}
