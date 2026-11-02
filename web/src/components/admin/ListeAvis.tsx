"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarAdd01Icon, StarIcon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { EtoilesNote } from "@/components/avis/EtoilesNote";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { chiffresAvis } from "@/lib/admin/chiffres-pages";
import { noteLisible } from "@/lib/admin/cartes-chiffres";
import { masquerAvis } from "@/lib/avis/actions";
import type { AvisEquipe } from "@/lib/avis/types";

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

type Filtre = "tous" | "visibles" | "masques" | "basses";
const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "visibles", label: "Visibles" },
  { value: "masques", label: "Masqués" },
  { value: "basses", label: "Notes basses" },
];
const VIDES: Record<Filtre, string> = { tous: "", visibles: "Aucun avis visible", masques: "Aucun avis masqué", basses: "Aucun avis à 1 ou 2 étoiles" };

/**
 * Les avis des étudiants, du plus récent au plus ancien (spec §10, `/admin/avis`) : l'équipe masque un avis, ou le
 * réaffiche. Un avis masqué n'est plus visible sur la fiche et ne compte plus dans la note. En haut, les chiffres clés
 * et un filtre (demande du 2 novembre 2026 : le style de l'espace étudiant).
 */
export function ListeAvis({ avis, maintenant }: { avis: AvisEquipe[]; maintenant: string }) {
  const { toast } = useToast();
  const [masques, setMasques] = useState<ReadonlyMap<string, boolean>>(new Map(avis.map((a) => [a.id, a.masque])));
  const [enCours, setEnCours] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tous");

  if (avis.length === 0) return <EmptyState icon={StarIcon} title="Aucun avis pour le moment" description="Les avis apparaissent ici dès qu’un étudiant en laisse un." />;

  const basculer = async (a: AvisEquipe) => {
    const voulu = !masques.get(a.id);
    setEnCours(a.id);
    const reponse = await masquerAvis(a.id, voulu);
    setEnCours(null);
    if (!reponse.ok) {
      toast({ tone: "erreur", title: reponse.erreur });
      return;
    }
    setMasques((avant) => new Map(avant).set(a.id, voulu));
    toast({ tone: "reussite", title: voulu ? "Avis masqué." : "Avis réaffiché." });
  };

  const actuels = avis.map((a) => ({ ...a, masque: masques.get(a.id) ?? false }));
  const chiffres = chiffresAvis(actuels, new Date(maintenant));
  const affiches = actuels.filter((a) =>
    filtre === "visibles" ? !a.masque : filtre === "masques" ? a.masque : filtre === "basses" ? a.note <= 2 : true,
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className={GRILLE_CHIFFRES}>
        <Tuile icon={StarIcon} tone="attention" label="Note moyenne" value={chiffres.noteMoyenne !== null ? noteLisible(chiffres.noteMoyenne) : "—"} />
        <Tuile icon={ViewIcon} tone="reussite" label="Avis visibles" value={chiffres.visibles.toLocaleString("fr-FR")} />
        <Tuile icon={CalendarAdd01Icon} tone="information" label="Nouveaux sur 30 jours" value={chiffres.nouveaux.toLocaleString("fr-FR")} />
        <Tuile icon={ViewOffSlashIcon} label="Avis masqués" value={chiffres.masques.toLocaleString("fr-FR")} />
      </div>
      <FilterChips label="Filtrer les avis" options={FILTRES} value={filtre} onValueChange={(v) => setFiltre(v as Filtre)} />
      {affiches.length === 0 ? (
        <EmptyState icon={StarIcon} title={VIDES[filtre]} description="Choisissez un autre filtre, ou « Tous »." />
      ) : (
        <ul aria-label="Avis des étudiants" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4 p-0">
          {affiches.map((a) => (
            <li key={a.id} className="box-border flex min-w-0 flex-col gap-2.5 rounded-carte border border-bordure-carte bg-panneau px-[18px] pt-4 pb-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/formations/${a.formationSlug}`} className="focus-etudium text-[15px] leading-[22px] font-semibold text-encre no-underline wrap-anywhere hover:underline">
                      {a.formationTitre}
                    </Link>
                    {a.masque && <Tag tone="enAttente">Masqué</Tag>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-discret">
                    <EtoilesNote note={a.note} />
                    <span>{`${a.note} sur 5 · ${a.auteur} · ${date(a.creeLe)}`}</span>
                  </div>
                </div>
                <Button variant={a.masque ? "contour" : "dangerDoux"} size="sm" loading={enCours === a.id} onClick={() => basculer(a)}>
                  {a.masque ? "Réafficher" : "Masquer"}
                </Button>
              </div>
              {a.commentaire && <p className="m-0 text-sm leading-[22px] text-pretty whitespace-pre-line text-texte wrap-anywhere">{a.commentaire}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
