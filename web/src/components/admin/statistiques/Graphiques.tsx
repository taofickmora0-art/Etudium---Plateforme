// Les petits graphiques des statistiques (design NdAdmin) : des barres côte à côte par période, et la part de chaque
// formule. Une seule image accessible par graphique, qui dit ses valeurs.

type Serie = { nom: string; couleur: string };
type Colonne = { cle: string; court: string; long: string; valeurs: number[] };

/** Barres côte à côte, hauteur relative à la plus grande valeur. */
export function Barres({ titre, series, colonnes, format = (n) => n.toLocaleString("fr-FR") }: { titre: string; series: Serie[]; colonnes: Colonne[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...colonnes.flatMap((c) => c.valeurs));
  const description = `${titre} : ${colonnes
    .map((c) => `${c.long}, ${series.map((s, i) => `${s.nom.toLowerCase()} ${format(c.valeurs[i] ?? 0)}`).join(", ")}`)
    .join(" ; ")}.`;
  return (
    <div role="img" aria-label={description}>
      <div className="flex h-40 items-end border-b border-bordure-champ">
        {colonnes.map((c) => (
          <span key={c.cle} className="flex h-full flex-1 items-end justify-center gap-0.5">
            {c.valeurs.map((v, i) => (
              <span
                key={series[i]?.nom ?? i}
                className={`w-5 max-w-[40%] rounded-t-[4px] ${series[i]?.couleur ?? "bg-bleu"}`}
                style={{ height: `${v > 0 ? Math.max(3, Math.round((100 * v) / max)) : 0}%` }}
              />
            ))}
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex">
        {colonnes.map((c, i) => (
          // Plus de 7 colonnes : sur téléphone, un libellé sur deux (sinon ils se chevauchent).
          <span key={c.cle} className={`flex-1 text-center text-xs leading-[18px] text-discret ${colonnes.length > 7 && i % 2 === 1 ? "max-sm:invisible" : ""}`}>
            {c.court}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Legende({ series }: { series: Serie[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      {series.map((s) => (
        <span key={s.nom} className="flex items-center gap-1.5 text-xs leading-[18px] text-discret">
          <span aria-hidden="true" className={`size-2.5 rounded-[4px] ${s.couleur}`} />
          {s.nom}
        </span>
      ))}
    </div>
  );
}

/** Une ligne « Standard … 52 % » et sa barre. */
export function Part({ nom, part, libelle }: { nom: string; part: number; libelle?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm leading-5 font-medium text-encre">{nom}</span>
        <span className="text-sm leading-5 text-texte">{libelle ?? `${part} %`}</span>
      </div>
      <div role="progressbar" aria-label={`Part de la formule ${nom}`} aria-valuenow={part} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-inactif">
        <div className="h-full rounded-full bg-bleu" style={{ width: `${Math.min(100, Math.max(0, part))}%` }} />
      </div>
    </div>
  );
}

const MOIS_COURT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const MOIS_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** « 2026-11 » : « nov. » et « novembre 2026 ». */
export const moisCourt = (cle: string) => MOIS_COURT.format(new Date(`${cle.slice(0, 7)}-15T12:00:00Z`));
export const moisLong = (cle: string) => MOIS_LONG.format(new Date(`${cle.slice(0, 7)}-15T12:00:00Z`));
/** « 2026-11-02 » : « 2 nov. » (le début d'une semaine). */
export const jourCourt = (cle: string) => JOUR.format(new Date(`${cle}T12:00:00Z`));
