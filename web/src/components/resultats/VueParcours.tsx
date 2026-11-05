"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Add01Icon, ArrowDown02Icon, ArrowLeft01Icon, ArrowUp02Icon, Delete02Icon, MoreVerticalIcon, PencilEdit02Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuEntry } from "@/components/ui/Menu";
import { Heading } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { bilanAnnees, detailBareme, formaterNombre } from "@/lib/resultats/affichage";
import { formaterNote, resultatParcours } from "@/lib/resultats/calcul";
import type { ParcoursComplet } from "@/lib/resultats/types";
import { CarteUe } from "./CarteUe";
import { FenetresResultats, type Fenetre } from "./FenetresResultats";
import { SecuriteResultats } from "./SecuriteResultats";
import { Tuile } from "./Tuile";
import { useDeplacer } from "./useDeplacer";

const moyenneOuTiret = (m: number | null) => (m === null ? "—" : formaterNote(m));
const sur = (acquis: number, total: number) => `${formaterNombre(acquis)} / ${formaterNombre(total)}`;

type VueParcoursProps = {
  complet: ParcoursComplet;
  /** Le semestre affiché (?semestre=) ; sinon le premier. */
  semestreId: string | undefined;
  pin: boolean;
};

/** Un parcours : son bilan (moyenne générale, crédits, années), ses semestres en onglets, et les UE du semestre affiché. */
export function VueParcours({ complet, semestreId, pin }: VueParcoursProps) {
  const router = useRouter();
  const deplacer = useDeplacer();
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const { parcours, semestres, ues, notes } = complet;
  const bilan = resultatParcours(complet);
  const annees = bilanAnnees(semestres, bilan.semestres);
  const provisoire = bilan.semestres.some((s) => s.provisoire);
  const indexCourant = Math.max(0, semestres.findIndex((s) => s.id === semestreId));
  const courant = semestres[indexCourant];
  const resultat = courant ? bilan.semestres[indexCourant] : null;
  const uesDuSemestre = courant ? ues.filter((u) => u.semestreId === courant.id) : [];
  const base = `/mes-resultats/${parcours.id}`;

  const actionsParcours: MenuEntry[] = [
    {
      label: "Supprimer le parcours",
      icon: Delete02Icon,
      danger: true,
      onSelect: () =>
        setFenetre({
          quoi: "supprimer",
          type: "parcours",
          id: parcours.id,
          titre: `Supprimer « ${parcours.nom} » ?`,
          description: "Ses semestres, ses UE et toutes leurs notes seront supprimés.",
          apres: () => router.push("/mes-resultats"),
        }),
    },
  ];
  const actionsSemestre: MenuEntry[] = courant
    ? [
        { label: "Modifier le semestre", icon: PencilEdit02Icon, onSelect: () => setFenetre({ quoi: "semestre", semestre: courant }) },
        ...(indexCourant > 0 ? [{ label: "Monter", icon: ArrowUp02Icon, onSelect: () => void deplacer("semestre", courant.id, -1) }] : []),
        ...(indexCourant < semestres.length - 1 ? [{ label: "Descendre", icon: ArrowDown02Icon, onSelect: () => void deplacer("semestre", courant.id, 1) }] : []),
        { separator: true },
        {
          label: "Supprimer le semestre",
          icon: Delete02Icon,
          danger: true,
          onSelect: () =>
            setFenetre({
              quoi: "supprimer",
              type: "semestre",
              id: courant.id,
              titre: `Supprimer « ${courant.nom} » ?`,
              description: "Ses UE, leurs ECUE et leurs notes seront supprimées.",
              apres: () => router.push(base),
            }),
        },
      ]
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-6 max-sm:gap-5">
      <Link href="/mes-resultats" className="focus-etudium inline-flex items-center gap-1.5 self-start rounded-puce text-sm font-medium text-bleu hover:underline">
        <Icon icon={ArrowLeft01Icon} size={16} />
        Tous mes parcours
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[240px]">
          <Heading level="section" as="h2" className="text-pretty">
            {parcours.nom}
          </Heading>
          <p className="mt-1 mb-0 text-sm leading-[22px] text-discret">
            {[parcours.etablissement, detailBareme(parcours.regles.categories)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecuriteResultats pin={pin} />
          <Button variant="contour" iconLeft={Settings02Icon} onClick={() => setFenetre({ quoi: "parcours" })}>
            Règles
          </Button>
          <Menu label={`Actions sur « ${parcours.nom} »`} trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${parcours.nom} »`} variant="contour" />} items={actionsParcours} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-sm:gap-2.5">
        <Tuile label="Moyenne générale" valeur={moyenneOuTiret(bilan.moyenne)} aide={provisoire ? "Provisoire" : undefined} />
        <Tuile label="Crédits cumulés" valeur={sur(bilan.creditsAcquis, bilan.credits)} />
      </div>
      {annees.length > 0 && (
        <ul className="-mt-2 m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm leading-[22px] text-texte max-sm:-mt-1">
          {annees.map((a) => (
            <li key={a.annee}>
              {a.annee} : <strong className="font-semibold">{moyenneOuTiret(a.moyenne)}</strong> <span className="text-discret">· {sur(a.creditsAcquis, a.credits)} crédits</span>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Semestres" className="flex flex-wrap items-center gap-2">
        {semestres.map((s, i) => (
          <Link
            key={s.id}
            href={`${base}?semestre=${s.id}`}
            scroll={false}
            aria-current={i === indexCourant ? "page" : undefined}
            className={cn(
              "focus-etudium rounded-full px-3.5 py-1.5 text-sm leading-5 font-medium transition-colors",
              i === indexCourant ? "bg-bleu text-white" : "bg-coque text-texte hover:bg-coque-survol",
            )}
          >
            {s.nom}
          </Link>
        ))}
        <Button variant="discret" size="sm" iconLeft={Add01Icon} onClick={() => setFenetre({ quoi: "semestre" })}>
          Ajouter un semestre
        </Button>
      </nav>

      {!courant || !resultat ? (
        <EmptyState
          title="Ajoute ton premier semestre"
          description="Puis ses UE et leurs ECUE."
          action={
            <Button iconLeft={Add01Icon} onClick={() => setFenetre({ quoi: "semestre" })}>
              Ajouter un semestre
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="semestre-courant" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h3 id="semestre-courant" className="m-0 min-w-0 flex-1 text-lg leading-[26px] font-semibold text-encre">
              {courant.nom}
              {courant.annee && <span className="font-normal text-discret"> · {courant.annee}</span>}
            </h3>
            <Menu label={`Actions sur « ${courant.nom} »`} trigger={<IconButton icon={MoreVerticalIcon} label={`Actions sur « ${courant.nom} »`} variant="discret" size="sm" />} items={actionsSemestre} />
          </div>
          <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2 max-sm:gap-2.5">
            <Tuile label="Moyenne du semestre" valeur={moyenneOuTiret(resultat.moyenne)} aide={resultat.provisoire ? "Provisoire" : resultat.valide ? "Semestre validé" : undefined} />
            <Tuile label="Crédits" valeur={sur(resultat.creditsAcquis, resultat.credits)} />
            <Tuile label="UE validées" valeur={`${resultat.uesValidees} / ${uesDuSemestre.length}`} />
            <Tuile label="Mention" valeur={resultat.mention ?? "—"} />
          </div>
          {resultat.compense && (
            <Banner tone="reussite" title="Semestre acquis par compensation.">
              Sa moyenne atteint {formaterNombre(parcours.regles.seuilSemestre)}/20 : toutes ses UE sont acquises.
            </Banner>
          )}
          {resultat.ues.length === 0 ? (
            <EmptyState
              title="Ajoute la première UE"
              description="Avec ses crédits, puis ses ECUE."
              action={
                <Button iconLeft={Add01Icon} onClick={() => setFenetre({ quoi: "ue", semestreId: courant.id })}>
                  Ajouter une UE
                </Button>
              }
            />
          ) : (
            <>
              {resultat.ues.map((r, i) => (
                <CarteUe
                  key={r.ue.id}
                  resultat={r}
                  notes={notes}
                  regles={parcours.regles}
                  compensee={resultat.compense}
                  premier={i === 0}
                  dernier={i === resultat.ues.length - 1}
                  ouvrir={setFenetre}
                />
              ))}
              <Button variant="contour" iconLeft={Add01Icon} className="self-start" onClick={() => setFenetre({ quoi: "ue", semestreId: courant.id })}>
                Ajouter une UE
              </Button>
            </>
          )}
        </section>
      )}

      <FenetresResultats fenetre={fenetre} onFermer={() => setFenetre(null)} parcours={parcours} nbSemestres={semestres.length} />
    </div>
  );
}
