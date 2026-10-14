import { initiales, tonAvatar } from "@/components/communaute/outils";
import { TexteMisEnForme } from "@/components/communaute/TexteMisEnForme";
import { VideoIntegree } from "@/components/communaute/VideoIntegree";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import type { MoiCommunaute } from "@/lib/communaute/types";
import type { Video } from "@/lib/communaute/video";
import type { SessionPublication } from "@/lib/sessions/types";
import { BlocSession } from "./BlocSession";

type Props = {
  moi: MoiCommunaute;
  /** « Formateur » ou « Équipe Étudium », comme sur les cartes de la communauté. */
  role: "formateur" | "equipe";
  espaceNom: string;
  titre: string;
  description: string;
  affiche: string | null;
  video: Video | null;
  /** Null tant que la date et l'heure ne sont pas choisies. */
  session: SessionPublication | null;
  maintenant: Date;
};

/**
 * La publication d'une session telle qu'elle paraîtra dans la communauté (spec promotion des sessions live, §1) : mise
 * à jour à chaque frappe du formulaire. Une vue seule : ni J’aime, ni commentaires, ni menu.
 */
export function ApercuSessionCommunaute({ moi, role, espaceNom, titre, description, affiche, video, session, maintenant }: Props) {
  const nom = `${moi.prenom} ${moi.nom}`.trim() || "Membre d’Étudium";
  return (
    <div className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-5 pt-[18px] pb-4 max-sm:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar initials={initiales(moi.prenom, moi.nom)} size={44} tone={tonAvatar(nom)} src={moi.photoUrl} className="max-sm:size-10 max-sm:text-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre max-sm:text-sm max-sm:leading-5">{nom}</span>
            {role === "formateur" ? <Tag tone="complementaire">Formateur</Tag> : <Tag tone="nouveau">Équipe Étudium</Tag>}
          </div>
          <span className="text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">à l’instant · Publié dans {espaceNom}</span>
        </div>
      </div>
      {titre.trim() ? (
        <h3 className="m-0 mt-3.5 text-[17px] leading-[25px] font-semibold wrap-anywhere text-encre max-sm:mt-3 max-sm:text-base max-sm:leading-6">{titre.trim()}</h3>
      ) : (
        <p className="m-0 mt-3.5 text-[15px] leading-6 text-discret italic">Le titre de la session</p>
      )}
      <TexteMisEnForme
        texte={description.trim() || "Session live programmée."}
        className="mt-1.5 text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]"
      />
      {affiche && (
        <span className="mt-3.5 inline-block max-w-full self-start overflow-hidden rounded-[14px] border border-bordure-carte">
          {/* Une image choisie dans le navigateur (adresse blob:) ou un lien temporaire : pas d'optimisation de Next. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={affiche} alt="Affiche de la session" className="block h-auto max-h-[420px] max-w-full" />
        </span>
      )}
      {video && <VideoIntegree video={video} className="mt-3.5 rounded-[14px]" />}
      {session ? (
        <BlocSession session={session} maintenant={maintenant} apercu />
      ) : (
        <p className="m-0 mt-3.5 rounded-[14px] border border-dashed border-bordure-champ px-3.5 py-3 text-[13px] leading-5 text-discret">
          Choisissez la date et l’heure : le bloc de la session (date, plateforme, « Voir la session ») paraîtra ici.
        </p>
      )}
    </div>
  );
}
