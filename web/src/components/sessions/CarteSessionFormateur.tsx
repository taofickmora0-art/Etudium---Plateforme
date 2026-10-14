import Link from "next/link";
import { Add01Icon, Calendar03Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { dansJours, dateSession } from "@/lib/sessions/regles";
import type { LigneSessionEdition } from "@/lib/sessions/types";
import { initialesCompte } from "@/lib/utilisateurs/regles";

const AVATARS = 5;

/**
 * La carte « Prochaine session live » du formateur (design NdFormateur) : quand, quoi, où, les initiales des premiers
 * inscrits et « Voir la session » ; sans session à venir, « Nouvelle session ».
 */
export function CarteSessionFormateur({ session, inscrits }: { session: LigneSessionEdition | null; inscrits: { prenom: string; nom: string }[] }) {
  if (!session) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée.</p>
        <Button asChild variant="contour" iconLeft={Add01Icon}>
          <Link href="/formateur/sessions/nouvelle">Nouvelle session</Link>
        </Button>
      </div>
    );
  }
  const reste = session.inscriptions - Math.min(inscrits.length, AVATARS);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <Tag tone="compteur">{dansJours(session.debut, new Date())}</Tag>
      </div>
      <span className="text-base leading-6 font-semibold wrap-anywhere text-encre">{session.titre}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-discret">
        <span className="flex items-center gap-1">
          <Icon icon={Calendar03Icon} size={14} />
          {dateSession(session.debut)}
        </span>
        <span className="flex items-center gap-1">
          <Icon icon={Video01Icon} size={14} />
          {session.plateforme}
        </span>
      </span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {inscrits.length > 0 && (
            <span className="flex -space-x-2">
              {inscrits.slice(0, AVATARS).map((i, rang) => (
                <Avatar key={`${i.prenom}-${i.nom}-${rang}`} initials={initialesCompte(i.prenom, i.nom, "?")} size={32} />
              ))}
            </span>
          )}
          {reste > 0 && <span className="text-xs leading-[18px] text-discret">{`+${reste}`}</span>}
        </span>
        <Link
          href={`/formateur/sessions/${session.id}`}
          className="focus-etudium text-sm leading-5 font-medium whitespace-nowrap text-bleu no-underline hover:underline"
        >
          Voir la session
        </Link>
      </div>
    </div>
  );
}
