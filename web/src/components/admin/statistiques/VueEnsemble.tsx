import Link from "next/link";
import {
  Alert02Icon,
  BookOpen01Icon,
  ChartIncreaseIcon,
  Certificate01Icon,
  Clock01Icon,
  CreditCardIcon,
  CrownIcon,
  RepeatIcon,
  Shield01Icon,
  Target02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Carte, GRILLE_CHIFFRES, RANGEE, Tuile } from "@/components/tableau/Blocs";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { dureeAbonnement, libelleMoyen, libelleStatut, montantFcfa } from "@/lib/abonnement/regles";
import type { ElementPaiement, VueEnsemble as Donnees } from "@/lib/statistiques/types";
import { Barres, Legende, moisCourt, moisLong, Part } from "./Graphiques";

// La vue d'ensemble du back-office (design NdAdmin ; lot 6 A, spec §4.1) : six indicateurs, les abonnements par mois,
// les formules les plus choisies, ce qui est à traiter, les dernières inscriptions et les derniers paiements.

const chiffre = (n: number) => n.toLocaleString("fr-FR");
const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Porto-Novo" });
const SERIES = [
  { nom: "Nouveaux", couleur: "bg-bleu" },
  { nom: "Renouvellements", couleur: "bg-premium-texte" },
];
const moyen = (p: ElementPaiement) => libelleMoyen({ montant: 1, operateur: p.operateur, moyenManuel: p.moyenManuel });
const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");

function evolution(actifs: number, avant: number): string | undefined {
  if (avant <= 0) return actifs > 0 ? "Nouveau ce mois" : undefined;
  const ecart = Math.round((100 * (actifs - avant)) / avant);
  return `${ecart >= 0 ? "+" : "−"}${Math.abs(ecart)} %`;
}

function ATraiter({ href, icon, fond, titre, detail }: { href: string; icon: IconSvgElement; fond: string; titre: string; detail: string }) {
  return (
    <Link href={href} className="focus-etudium flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-encre no-underline hover:bg-page">
      <span className={`flex size-11 flex-none items-center justify-center rounded-[13px] ${fond}`}>
        <Icon icon={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] leading-[22px] font-medium">{titre}</span>
        <span className="text-[13px] leading-5 text-discret">{detail}</span>
      </span>
    </Link>
  );
}

function ToutVoir({ href }: { href: string }) {
  return (
    <Link href={href} className="focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
      Tout voir
    </Link>
  );
}

export function VueEnsemble({ donnees: d }: { donnees: Donnees }) {
  const aTraiter = [
    ...(d.aTraiter.aExaminer > 0
      ? [{ href: "/admin/moderation", icon: Shield01Icon, fond: "bg-attention-fond", titre: `${chiffre(d.aTraiter.aExaminer)} contenu${d.aTraiter.aExaminer > 1 ? "s" : ""} à examiner`, detail: "Signalés par l’analyse ou par les membres" }]
      : []),
    ...d.aTraiter.paiementsEchoues.map((p) => ({ href: "/admin/paiements", icon: Alert02Icon, fond: "bg-erreur-fond", titre: "Paiement échoué", detail: `${p.nom} · ${p.formule} · ${moyen(p)}` })),
    ...d.aTraiter.paiementsEnAttente.map((p) => ({ href: "/admin/paiements", icon: Clock01Icon, fond: "bg-fond-doux", titre: "Paiement en attente", detail: `${p.nom} · ${p.formule} · ${moyen(p)}` })),
    ...d.aTraiter.finsProches.map((f) => ({
      href: `/admin/utilisateurs/${f.profilId}`,
      icon: CrownIcon,
      fond: "bg-premium-fond",
      titre: "Abonnement bientôt expiré",
      detail: `${f.nom} · ${f.formule} · expire dans ${f.jours} jour${f.jours > 1 ? "s" : ""}`,
    })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className={GRILLE_CHIFFRES}>
        <Tuile icon={UserMultipleIcon} tone="information" label="Utilisateurs" value={chiffre(d.utilisateurs.total)} hint={`+${chiffre(d.utilisateurs.ceMois)} ce mois`} />
        <Tuile icon={CrownIcon} tone="attention" label="Abonnés actifs" value={chiffre(d.abonnes.actifs)} hint={evolution(d.abonnes.actifs, d.abonnes.moisPrecedent)} />
        <Tuile icon={CreditCardIcon} tone="reussite" label="Revenus du mois" value={montantFcfa(d.revenusMois)} />
        <Tuile icon={BookOpen01Icon} label="Formations" value={chiffre(d.formations.total)} hint={`${chiffre(d.formations.brouillons)} en brouillon`} />
        <Tuile icon={Certificate01Icon} label="Certificats" value={chiffre(d.certificats)} hint="Depuis le lancement" />
        <Tuile icon={Target02Icon} label="Taux de complétion" value={d.tauxCompletion === null ? "—" : `${d.tauxCompletion} %`} hint="Moyenne" />
        {d.complements && (
          <>
            <Tuile
              icon={ChartIncreaseIcon}
              tone="information"
              label="Taux de conversion"
              value={d.complements.conversion.taux === null ? "—" : `${d.complements.conversion.taux} %`}
              hint={`${chiffre(d.complements.conversion.abonnes)} abonné${d.complements.conversion.abonnes > 1 ? "s" : ""} sur ${chiffre(d.complements.conversion.inscrits)} inscrit${d.complements.conversion.inscrits > 1 ? "s" : ""}`}
            />
            <Tuile
              icon={RepeatIcon}
              tone="attention"
              label="Abonnements à renouveler"
              value={chiffre(d.complements.aRenouveler.total)}
              hint={
                d.complements.aRenouveler.renouveles > 0
                  ? `Dans les 7 jours, dont ${chiffre(d.complements.aRenouveler.renouveles)} déjà renouvelé${d.complements.aRenouveler.renouveles > 1 ? "s" : ""}`
                  : "Dans les 7 prochains jours"
              }
            />
          </>
        )}
      </div>

      <div className={RANGEE}>
        <Carte titre="Abonnements actifs par mois" className="flex-[999_1_420px]">
          <Legende series={SERIES} />
          <Barres
            titre="Abonnements actifs par mois"
            series={SERIES}
            colonnes={d.abonnementsParMois.map((m) => ({ cle: m.mois, court: moisCourt(m.mois), long: moisLong(m.mois), valeurs: [m.nouveaux, m.renouvellements] }))}
          />
        </Carte>
        <Carte titre="Formules les plus choisies" className="flex-[1_1_280px]">
          <div className="flex min-w-0 flex-col gap-[18px]">
            {[...d.formules].sort((a, b) => b.part - a.part).map((f) => (
              <Part key={f.code} nom={f.nom} part={f.part} />
            ))}
          </div>
        </Carte>
      </div>

      <div className={RANGEE}>
        <Carte titre="À traiter" className="flex-[999_1_420px]">
          {aTraiter.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Rien à traiter pour le moment.</p>
          ) : (
            <div className="flex flex-col divide-y divide-bordure-carte">
              {aTraiter.map((a, i) => (
                <ATraiter key={`${a.href}-${i}`} {...a} />
              ))}
            </div>
          )}
        </Carte>
        <Carte titre="Dernières inscriptions" className="flex-[1_1_280px]">
          <div className="-mt-1 flex justify-end">
            <ToutVoir href="/admin/utilisateurs" />
          </div>
          {d.dernieresInscriptions.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune inscription pour le moment.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {d.dernieresInscriptions.map((i) => (
                <li key={i.id} className="flex min-w-0 items-center gap-3">
                  <Avatar initials={initiales(i.nom)} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm leading-5 font-medium text-encre">{i.nom}</span>
                    <span className="text-[13px] leading-5 text-discret">{`Le ${DATE.format(new Date(i.creeLe))}`}</span>
                  </span>
                  <Tag tone="enAttente">{i.formule ?? "Gratuit"}</Tag>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <section aria-labelledby="derniers-paiements" className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="derniers-paiements" className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg">
            Derniers paiements
          </h2>
          <ToutVoir href="/admin/paiements" />
        </div>
        {d.derniersPaiements.length === 0 ? (
          <p className="m-0 rounded-carte border border-bordure-carte bg-panneau px-5 py-6 text-sm leading-[22px] text-discret">Aucun paiement pour le moment.</p>
        ) : (
          <TableauListe nom="Derniers paiements" nomCadre="Tableau des derniers paiements" colonnes={["Utilisateur", "Objet", "Moyen", "Montant", "Statut", "Date"]} largeurMin={780}>
            {d.derniersPaiements.map((p) => {
              const statut = libelleStatut(p.statut);
              return (
                <tr key={p.id} className="border-t border-bordure-carte">
                  <td className={`${CELLULE_TABLEAU} font-medium text-encre`}>{p.nom}</td>
                  <td className={CELLULE_TABLEAU}>{`${p.formule} · ${dureeAbonnement(p.dureeMois)}`}</td>
                  <td className={CELLULE_TABLEAU}>{libelleMoyen({ montant: p.montant, operateur: p.operateur, moyenManuel: p.moyenManuel })}</td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{montantFcfa(p.montant)}</td>
                  <td className={CELLULE_TABLEAU}>
                    <Tag tone={statut.ton}>{statut.libelle}</Tag>
                  </td>
                  <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{DATE_HEURE.format(new Date(p.date))}</td>
                </tr>
              );
            })}
          </TableauListe>
        )}
      </section>
    </div>
  );
}
