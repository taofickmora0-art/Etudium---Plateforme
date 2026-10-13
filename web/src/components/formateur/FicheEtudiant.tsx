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

const ETUDIANTS = { label: "Étudiants", href: "/formateur/etudiants" };

const etatLecon = (l: LeconSuivie) =>
  l.etat === "terminee" && l.termineeLe ? `Terminée le ${dateCourte(l.termineeLe)}` : l.etat === "non_ouverte" ? "Pas encore ouverte" : l.etat === "terminee" ? "Terminée" : "Ouverte";

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
              <div key={m.titre} className="flex flex-col gap-2">
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
            <p className="m-0 text-[13px] leading-5 text-discret">Quiz, exercices et certificat : disponibles au lot 3.</p>
          </Section>
        ))}
        <Section titre="Remarque privée">
          <RemarqueEtudiant etudiantId={etudiant.id} remarque={etudiant.remarque} />
        </Section>
      </div>
    </PageAdmin>
  );
}
