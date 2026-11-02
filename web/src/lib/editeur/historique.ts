import { dateLongue } from "@/lib/abonnement/regles";
import { FUSEAU_BENIN, formatDe } from "@/lib/dates/fuseau";

// Les libellés de l'historique des versions (fin du lot 4, spec §3) : à l'heure du Bénin, la même au serveur et dans
// le navigateur.

const JOUR = (iso: string | Date) => formatDe("jour-version", FUSEAU_BENIN, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(new Date(iso));

/** « aujourd’hui », « hier », sinon « 1er octobre 2026 ». */
export function quandVersion(iso: string, maintenant: Date): string {
  const jour = JOUR(iso);
  if (jour === JOUR(maintenant)) return "aujourd’hui";
  if (jour === JOUR(new Date(maintenant.getTime() - 24 * 60 * 60 * 1000))) return "hier";
  return dateLongue(iso);
}

/** « 1er novembre 2026 à 14 h 32 ». */
export function dateHeureVersion(iso: string): string {
  const [h, m] = formatDe("heure-version", FUSEAU_BENIN, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "fr-FR").format(new Date(iso)).split(":");
  return `${dateLongue(iso)} à ${Number(h)} h ${m}`;
}

const nombre = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`;

/** Le message après une restauration : ce qui revient dans le brouillon. */
/** `enLigne` faux : une formation pas encore en ligne n'a pas de brouillon, la restauration s'est écrite directement. */
export function messageRestauration(r: { numero: number; infos: boolean; leconsModifiees: number; leconsRecreees: number; enLigne?: boolean }): string {
  const parties = [
    r.infos && "informations générales",
    r.leconsModifiees > 0 && nombre(r.leconsModifiees, "leçon modifiée", "leçons modifiées"),
    r.leconsRecreees > 0 && nombre(r.leconsRecreees, "leçon recréée (non publiée)", "leçons recréées (non publiées)"),
  ].filter(Boolean);
  if (parties.length === 0) return `La version ${r.numero} est déjà le contenu actuel : rien à restaurer.`;
  if (r.enLigne === false) return `Version ${r.numero} restaurée : ${parties.join(", ")}.`;
  return `Version ${r.numero} restaurée dans le brouillon : ${parties.join(", ")}. Relisez, puis publiez.`;
}
