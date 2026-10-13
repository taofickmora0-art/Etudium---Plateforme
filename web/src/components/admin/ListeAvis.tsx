"use client";

import { useState } from "react";
import Link from "next/link";
import { StarIcon } from "@hugeicons/core-free-icons";
import { EtoilesNote } from "@/components/avis/EtoilesNote";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { masquerAvis } from "@/lib/avis/actions";
import type { AvisEquipe } from "@/lib/avis/types";

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Les avis des étudiants, du plus récent au plus ancien (spec §10, `/admin/avis`) : l'équipe masque un avis, ou le
 * réaffiche. Un avis masqué n'est plus visible sur la fiche et ne compte plus dans la note.
 */
export function ListeAvis({ avis }: { avis: AvisEquipe[] }) {
  const { toast } = useToast();
  const [masques, setMasques] = useState<ReadonlyMap<string, boolean>>(new Map(avis.map((a) => [a.id, a.masque])));
  const [enCours, setEnCours] = useState<string | null>(null);

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

  return (
    <ul aria-label="Avis des étudiants" className="m-0 flex max-w-[760px] list-none flex-col gap-3 p-0">
      {avis.map((a) => {
        const masque = masques.get(a.id) ?? false;
        return (
          <li key={a.id} className="box-border flex min-w-0 flex-col gap-2.5 rounded-carte border border-bordure-carte bg-panneau px-[18px] pt-4 pb-[18px]">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/formations/${a.formationSlug}`} className="focus-etudium text-[15px] leading-[22px] font-semibold text-encre no-underline wrap-anywhere hover:underline">
                    {a.formationTitre}
                  </Link>
                  {masque && <Tag tone="enAttente">Masqué</Tag>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-discret">
                  <EtoilesNote note={a.note} />
                  <span>{`${a.note} sur 5 · ${a.auteur} · ${date(a.creeLe)}`}</span>
                </div>
              </div>
              <Button variant={masque ? "contour" : "dangerDoux"} size="sm" loading={enCours === a.id} onClick={() => basculer(a)}>
                {masque ? "Réafficher" : "Masquer"}
              </Button>
            </div>
            {a.commentaire && <p className="m-0 text-sm leading-[22px] text-pretty whitespace-pre-line text-texte wrap-anywhere">{a.commentaire}</p>}
          </li>
        );
      })}
    </ul>
  );
}
