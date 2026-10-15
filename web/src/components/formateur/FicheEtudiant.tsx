import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Section } from "@/components/admin/utilisateurs/Section";
import { ProgressBar } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import { lireMaFiche } from "@/lib/formateur/data";
import { dureeVideo, ETATS_SUIVI, TON_SUIVI } from "@/lib/formateur/regles-suivi";
import { lireSuiviEtudiant, type LeconSuivie } from "@/lib/formateur/suivi";
import { dateCourte, nomAffiche } from "@/lib/utilisateurs/regles";
import { MigrationFormateurAbsente, MigrationSuiviAbsente, RACINE_FORMATEUR, SansFiche } from "./cadre";
import { RemarqueEtudiant } from "./RemarqueEtudiant";
import { lireLot3Etudiant } from "@/lib/certificats/data";
import type { Lot3Etudiant } from "@/lib/certificats/types";
import { LIBELLES_STATUT } from "@/lib/exercices/types";

const ETUDIANTS = { label: "Étudiants", href: "/formateur/etudiants" };

const etatLecon = (l: LeconSuivie) =>
  l.etat === "terminee" && l.termineeLe ? `Terminée le ${dateCourte(l.termineeLe)}` : l.etat === "non_ouverte" ? "Pas encore ouverte" : l.etat === "terminee" ? "Terminée" : "Ouverte";

/** Ses quiz (meilleur score), ses exercices (dernier statut) et son certificat, dans une formation (lot 3). */
function SuiviLot3({ titre, suivi }: { titre: string; suivi: Lot3Etudiant | undefined }) {
  if (!suivi) return null;
  const lignes = [
    ...suivi.quiz.map((q) => ({ id: q.id, titre: q.titre, etat: q.meilleur === null ? "Pas encore passé" : `${q.reussi ? "Réussi" : "Pas encore réussi"} · ${q.meilleur} %` })),
    ...suivi.exercices.map((x) => ({ id: x.id, titre: x.titre, etat: x.statut ? LIBELLES_STATUT[x.statut] : "Pas encore rendu" })),
  ];
  return (
    <div className="flex flex-col gap-2">
      {lignes.length > 0 && (
        <ul aria-label={`Quiz et exercices : ${titre}`} className="m-0 flex list-none flex-col p-0">
          {lignes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-bordure-carte py-2.5">
              <span className="min-w-0 text-sm leading-[22px] break-words text-texte">{l.titre}</span>
              <span className="text-[13px] leading-5 text-discret">{l.etat}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-[13px] leading-5 text-discret">{suivi.certificat ? `Certificat ${suivi.certificat} délivré.` : "Pas encore de certificat."}</p>
    </div>
  );
}

/**
 * La fiche d'un étudiant, dans l'espace formateur (spec, §3) : pour chacune des formations du formateur qu'il suit,
 * la progression leçon par leçon et le temps de vidéo ; puis la remarque privée. Un compte qui ne suit aucune de ses
 * formations donne la page introuvable. La page vérifie le rôle avant (requireSpace).
 */
export async function FicheEtudiant({ id }: { id: string }) {
  const fiche = await lireMaFiche();
  const cadre = { titre: "Étudiant", racine: RACINE_FORMATEUR, fil: [ETUDIANTS, { label: "Étudiant" }] };
  if (fiche.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationFormateurAbsente />
      </PageAdmin>
    );
  }
  if (!fiche.fiche) {
    return (
      <PageAdmin {...cadre}>
        <SansFiche />
      </PageAdmin>
    );
  }
  const lecture = await lireSuiviEtudiant(id);
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin {...cadre}>
        <MigrationSuiviAbsente />
      </PageAdmin>
    );
  }
  const etudiant = lecture.donnees;
  if (!etudiant) notFound();
  const nom = nomAffiche(etudiant.prenom, etudiant.nom);
  // Ses quiz, ses exercices et son certificat (0033) : sans eux, la fiche reste celle d'avant.
  const lot3 = (await lireLot3Etudiant(id).catch(() => [])) ?? [];

  return (
    <PageAdmin titre={nom} racine={RACINE_FORMATEUR} fil={[ETUDIANTS, { label: nom }]}>
      <div className="flex max-w-[760px] min-w-0 flex-col gap-5">
        {etudiant.formations.map((f) => (
          <Section key={f.id} titre={f.titre}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm leading-[22px] text-texte">{`${f.terminees} / ${f.total} leçons · ${dureeVideo(f.secondes)}`}</span>
                <Tag tone={TON_SUIVI[f.etat]}>{ETATS_SUIVI[f.etat]}</Tag>
              </div>
              <ProgressBar value={f.total > 0 ? (f.terminees / f.total) * 100 : 0} label={`Progression sur ${f.titre}`} />
              <span className="text-[13px] leading-5 text-discret">{`Dernière activité le ${dateCourte(f.derniereActivite)}`}</span>
            </div>
            {f.modules.map((m) => (
              <div key={m.id} className="flex flex-col gap-2">
                <h3 className="m-0 text-[15px] leading-[22px] font-semibold text-encre">{m.titre}</h3>
                <ul className="m-0 flex list-none flex-col p-0">
                  {m.lecons.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-bordure-carte py-2.5">
                      <span className="min-w-0 text-sm leading-[22px] break-words text-texte">{l.titre}</span>
                      <span className="flex flex-wrap gap-x-2 text-[13px] leading-5 text-discret">
                        <span>{etatLecon(l)}</span>
                        {l.secondes > 0 && <span>{dureeVideo(l.secondes)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <SuiviLot3 titre={f.titre} suivi={lot3.find((s) => s.formationId === f.id)} />
          </Section>
        ))}
        <Section titre="Remarque privée">
          <RemarqueEtudiant etudiantId={etudiant.id} remarque={etudiant.remarque} />
        </Section>
      </div>
    </PageAdmin>
  );
}
