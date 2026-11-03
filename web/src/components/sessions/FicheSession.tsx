import Link from "next/link";
import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Section } from "@/components/admin/utilisateurs/Section";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import type { EspaceEdition } from "@/lib/admin/espace";
import { lireSessionDetail } from "@/lib/sessions/data";
import { dureeLisible, enCours, terminee } from "@/lib/sessions/regles";
import { nomAffiche } from "@/lib/utilisateurs/regles";
import { AnnulerSession } from "./AnnulerSession";
import { baseSessions, filSessions, MigrationSessionsAbsente, racineSessions } from "./cadre";
import { QuandSession } from "./QuandSession";

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-sm leading-[22px]">
      <dt className="w-28 flex-none text-discret">{libelle}</dt>
      <dd className="m-0 min-w-0 flex-[1_1_200px] wrap-anywhere text-texte">{children}</dd>
    </div>
  );
}

/**
 * La fiche d'une session, pour son animateur et l'équipe : ses informations, son lien, ses inscriptions (prénom et nom,
 * jamais l'adresse e-mail) ; la modifier ou l'annuler tant qu'elle n'est pas terminée. La page vérifie le rôle avant.
 */
export async function FicheSession({ espace, id }: { espace: EspaceEdition; id: string }) {
  const racine = racineSessions(espace);
  const lecture = await lireSessionDetail(id);
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin titre="Session live" racine={racine} fil={[filSessions(espace), { label: "Session live" }]}>
        <MigrationSessionsAbsente espace={espace} />
      </PageAdmin>
    );
  }
  const s = lecture.donnees;
  if (!s) notFound();
  const maintenant = new Date();
  const modifiable = s.statut === "programmee" && !terminee(s, maintenant);
  const etat =
    s.statut === "annulee" ? <Tag tone="echoue">Annulée</Tag> : enCours(s, maintenant) ? <Tag tone="compteur">En cours</Tag> : terminee(s, maintenant) ? <Tag tone="enAttente">Terminée</Tag> : <Tag tone="valide">Programmée</Tag>;

  return (
    <PageAdmin
      titre={s.titre}
      racine={racine}
      fil={[filSessions(espace), { label: s.titre }]}
      action={
        modifiable ? (
          <Button variant="contour" asChild>
            <Link href={`${baseSessions(espace)}/${s.id}/modifier`}>Modifier</Link>
          </Button>
        ) : undefined
      }
    >
      <div className="flex max-w-[760px] min-w-0 flex-col gap-5">
        <Section titre="La session">
          <dl className="m-0 flex flex-col gap-2">
            <Ligne libelle="État">{etat}</Ligne>
            <Ligne libelle="Date">
              <QuandSession debut={s.debut} />
            </Ligne>
            <Ligne libelle="Durée">{dureeLisible(s.dureeMinutes)}</Ligne>
            <Ligne libelle="Plateforme">{s.plateforme}</Ligne>
            {s.lien && (
              <Ligne libelle="Lien">
                <a href={s.lien} target="_blank" rel="noopener noreferrer" className="focus-etudium break-all text-bleu underline-offset-2 hover:underline">
                  {s.lien}
                </a>
              </Ligne>
            )}
            <Ligne libelle="Parcours">{s.parcours?.nomCourt ?? "Tous les parcours"}</Ligne>
            <Ligne libelle="Animateur">{s.animateur}</Ligne>
          </dl>
          {s.description && <p className="m-0 text-sm leading-[22px] whitespace-pre-line wrap-anywhere text-texte">{s.description}</p>}
        </Section>
        <Section titre="Inscriptions">
          {s.inscrits.length === 0 ? (
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune inscription pour l’instant.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {s.inscrits.map((i, rang) => (
                <li key={`${i.prenom}-${i.nom}-${rang}`} className="border-t border-bordure-carte py-2 text-sm leading-[22px] wrap-anywhere text-texte first:border-t-0">
                  {nomAffiche(i.prenom, i.nom)}
                </li>
              ))}
            </ul>
          )}
        </Section>
        {modifiable && <AnnulerSession id={s.id} inscriptions={s.inscrits.length} />}
      </div>
    </PageAdmin>
  );
}
