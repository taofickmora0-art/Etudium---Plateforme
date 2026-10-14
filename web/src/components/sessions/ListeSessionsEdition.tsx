import Link from "next/link";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Section } from "@/components/admin/utilisateurs/Section";
import { Button } from "@/components/ui/Button";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag, type TagTone } from "@/components/ui/Tag";
import type { EspaceEdition } from "@/lib/admin/espace";
import { dateSession, enCours, terminee } from "@/lib/sessions/regles";
import type { LigneSessionEdition, ListeSessionsEdition as Liste } from "@/lib/sessions/types";
import { baseSessions } from "./cadre";

function etat(s: LigneSessionEdition, maintenant: Date): { libelle: string; ton: TagTone } {
  if (s.statut === "annulee") return { libelle: "Annulée", ton: "echoue" };
  if (enCours(s, maintenant)) return { libelle: "En cours", ton: "compteur" };
  if (terminee(s, maintenant)) return { libelle: "Terminée", ton: "enAttente" };
  return { libelle: "Programmée", ton: "valide" };
}

function Tableau({ nom, espace, sessions, maintenant }: { nom: string; espace: EspaceEdition; sessions: LigneSessionEdition[]; maintenant: Date }) {
  const base = baseSessions(espace);
  const colonnes = ["Date", "Titre", "Plateforme", "Inscriptions", "État", ...(espace === "admin" ? ["Animateur"] : [])];
  return (
    <TableauListe nom={nom} nomCadre={`Tableau des ${nom.toLowerCase()}`} colonnes={colonnes} largeurMin={espace === "admin" ? 860 : 720}>
      {sessions.map((s) => {
        const { libelle, ton } = etat(s, maintenant);
        return (
          <tr key={s.id}>
            <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{dateSession(s.debut)}</td>
            <td className={`${CELLULE_TABLEAU} font-medium wrap-anywhere text-encre`}>
              <Link href={`${base}/${s.id}`} className="focus-etudium text-encre no-underline hover:underline">
                {s.titre}
              </Link>
            </td>
            <td className={CELLULE_TABLEAU}>{s.plateforme}</td>
            <td className={CELLULE_TABLEAU}>{s.inscriptions.toLocaleString("fr-FR")}</td>
            <td className={CELLULE_TABLEAU}>
              <Tag tone={ton}>{libelle}</Tag>
            </td>
            {espace === "admin" && <td className={CELLULE_TABLEAU}>{s.animateur}</td>}
          </tr>
        );
      })}
    </TableauListe>
  );
}

/** Les sessions de l'animateur (ou toutes, au back-office) : à venir, puis passées ; et « Nouvelle session ». */
export function ListeSessionsEdition({ espace, liste }: { espace: EspaceEdition; liste: Liste }) {
  const maintenant = new Date();
  return (
    <div className="flex max-w-[1080px] min-w-0 flex-col gap-5">
      <div>
        <Button asChild iconLeft={Add01Icon}>
          <Link href={`${baseSessions(espace)}/nouvelle`}>Nouvelle session</Link>
        </Button>
      </div>
      <Section titre="À venir">
        {liste.aVenir.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée.</p>
        ) : (
          <Tableau nom="Sessions à venir" espace={espace} sessions={liste.aVenir} maintenant={maintenant} />
        )}
      </Section>
      {liste.passees.length > 0 && (
        <Section titre="Passées">
          <Tableau nom="Sessions passées" espace={espace} sessions={liste.passees} maintenant={maintenant} />
        </Section>
      )}
    </div>
  );
}
