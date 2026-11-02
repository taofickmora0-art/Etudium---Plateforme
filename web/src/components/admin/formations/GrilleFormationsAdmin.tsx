import { StarIcon, UserIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { CardShell } from "@/components/ui/CourseCard";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { noteLisible, type ChiffresFormations } from "@/lib/admin/cartes-chiffres";
import { compter } from "@/lib/admin/parcours-chiffres";
import type { FormationResume } from "@/lib/admin/types";
import { ETATS, TON_ETAT } from "@/lib/contenus/etat";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { dateCourte } from "@/lib/utilisateurs/regles";

// Les formations du back-office au style de l'espace étudiant (demande du 2 novembre 2026) : la carte du catalogue, sa
// couverture, son parcours et son état posés dessus ; dessous, ses leçons, ses apprenants, ses certificats, sa note, son
// formateur, et ce qui l'attend (modifications à publier, exercices à corriger).

const TONS_PARCOURS: Record<CouleurParcours, TagTone> = { academique: "academique", digital: "digital", business: "business" };

/** Les chiffres du haut de la page : les formations publiées, en attente de validation, en brouillon. */
export function chiffresDesEtats(formations: FormationResume[]): { publiees: number; enAttente: number; brouillons: number } {
  return {
    publiees: formations.filter((f) => f.etat === "publiee").length,
    enAttente: formations.filter((f) => f.etat === "en_attente").length,
    brouillons: formations.filter((f) => f.etat === "brouillon" || f.etat === "a_corriger").length,
  };
}

function CarteFormationAdmin({ formation: f, chiffres }: { formation: FormationResume; chiffres: ChiffresFormations | null }) {
  const c = chiffres?.parFormation[f.id];
  const meta = [compter(f.nbLecons, "leçon"), c && compter(c.apprenants, "apprenant"), c && compter(c.certificats, "certificat")].filter(Boolean).join(" · ");
  const avecNote = f.note !== null && f.note !== undefined && (f.nbAvis ?? 0) > 0;
  const alertes: { tone: TagTone; label: string }[] = [];
  if (f.modificationsNonPubliees) alertes.push({ tone: "aCorriger", label: "Modifications non publiées" });
  if (c && c.aCorriger > 0) alertes.push({ tone: "populaire", label: `${c.aCorriger} exercice${c.aCorriger > 1 ? "s" : ""} à corriger` });
  if (f.modifieeParFormateurLe) alertes.push({ tone: "enAttente", label: `Modifiée par le formateur le ${dateCourte(f.modifieeParFormateurLe)}` });
  return (
    <CardShell
      href={`/admin/formations/${f.id}`}
      title={f.titre}
      description={f.resume || "Pas encore de résumé."}
      parcours={f.couleur ?? "academique"}
      couverture={urlCouverture(f.couverture ?? null)}
      parcoursTag={{ tone: f.couleur ? TONS_PARCOURS[f.couleur] : "enAttente", label: f.parcours[0] ?? "Sans parcours" }}
      tag={{ tone: TON_ETAT[f.etat], label: ETATS[f.etat] }}
      titleAs="h2"
    >
      <div aria-hidden="true" className="mt-4 h-px bg-bordure-carte" />
      <p data-testid="meta-formation" className="m-0 mt-3 text-xs leading-[18px] text-discret">
        {meta}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-[18px] text-discret">
        <span className="flex items-center gap-1">
          <Icon icon={StarIcon} size={16} className="-mx-px" />
          {avecNote ? `${noteLisible(f.note as number)} (${f.nbAvis})` : "Pas encore d’avis"}
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <Icon icon={UserIcon} size={16} className="-mx-px flex-none" />
          <span className="truncate">{f.formateur ?? "Sans formateur"}</span>
        </span>
      </div>
      {alertes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alertes.map((a) => (
            <Tag key={a.label} tone={a.tone}>
              {a.label}
            </Tag>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function GrilleFormationsAdmin({ formations, chiffres }: { formations: FormationResume[]; chiffres: ChiffresFormations | null }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5 p-0">
      {formations.map((f) => (
        <li key={f.id} className="flex min-w-0 [&>*]:flex-1">
          <CarteFormationAdmin formation={f} chiffres={chiffres} />
        </li>
      ))}
    </ul>
  );
}
