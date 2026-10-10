import { Certificate01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { Icon } from "@/components/ui/Icon";
import { IconTile } from "@/components/ui/IconTile";
import { ProgressBar, ProgressMeta } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";

export type AuthAsideVariant = "connexion" | "inscription" | "compte";

const TEXTES: Record<AuthAsideVariant, { pastille: string; phrase: string }> = {
  connexion: { pastille: "Formation · Pratique · Accompagnement", phrase: "Les compétences qui comptent, pendant vos études et après." },
  inscription: { pastille: "Compte gratuit", phrase: "Apprenez, pratiquez, faites-vous accompagner." },
  compte: { pastille: "Votre compte", phrase: "Votre progression est enregistrée." },
};

const AVANTAGES = [
  "Des formations gratuites dès la création du compte",
  "Votre progression sauvegardée sur tous vos appareils",
  "Des certificats vérifiables par QR Code",
];

/** Illustration décorative du bas : une carte de formation inclinée et la pastille « Certificat obtenu ». */
function Illustration() {
  return (
    <div aria-hidden="true" className="flex justify-center px-3">
      <div className="relative w-full max-w-[380px] pb-11">
        <div className="-rotate-2 rounded-carte shadow-[0_24px_60px_rgba(4,10,80,0.35)]">
          <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-[22px] pb-[17px]">
            <div className="flex items-start justify-between gap-2">
              <span className="ml-1">
                <CourseIllustration parcours="academique" />
              </span>
              <Tag tone="academique">Académique</Tag>
            </div>
            <p className="mt-[21px] mb-0 truncate text-base leading-6 font-semibold text-encre">Maîtriser Microsoft Excel</p>
            <p className="mt-[11px] mb-0 h-10 overflow-hidden text-xs leading-5 text-discret">Module 3 : les tableaux croisés dynamiques</p>
            <ProgressBar value={68} className="mt-[17px] -ml-px" />
            <ProgressMeta value={68} timeLabel="2 h restantes" className="mt-2 flex-nowrap" />
          </div>
        </div>
        <div className="absolute -right-3 bottom-0 flex rotate-2 items-center gap-3 rounded-carte bg-panneau py-2.5 pr-4 pl-2.5 shadow-[0_16px_40px_rgba(4,10,80,0.3)]">
          <IconTile icon={Certificate01Icon} tone="reussite" />
          <span className="flex flex-col">
            <span className="text-sm leading-5 font-semibold text-encre">Certificat obtenu</span>
            <span className="text-xs leading-[18px] text-discret">Vérifiable par QR Code</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Bannière bleue des écrans de compte sur ordinateur (NdConnexion, NdInscription, NdMotDePasse). */
export function AuthAside({ variant }: { variant: AuthAsideVariant }) {
  const { pastille, phrase } = TEXTES[variant];
  return (
    <aside className="trame-points box-border hidden min-w-0 flex-[1_1_400px] flex-col justify-between gap-10 rounded-panneau bg-bleu p-[clamp(28px,4vw,56px)] text-white lg:flex">
      <div className="flex flex-col gap-[18px]">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/14 px-[13px] py-1.5 text-[13px] leading-[18px] font-semibold">
          {pastille}
        </span>
        <p className="m-0 max-w-[520px] text-[clamp(28px,3.2vw,42px)] leading-[1.1] font-medium tracking-[-0.028em] text-balance">{phrase}</p>
        {variant === "inscription" && (
          <ul className="m-0 mt-2 flex list-none flex-col gap-3.5 p-0">
            {AVANTAGES.map((a) => (
              <li key={a} className="flex items-center gap-3 text-base leading-6">
                <span className="flex size-[30px] flex-none items-center justify-center rounded-puce bg-white/16">
                  <Icon icon={Tick02Icon} size={18} />
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        )}
        {variant === "compte" && (
          <p className="m-0 max-w-[480px] text-base leading-[26px] text-pretty text-bleu-pale">
            Vos formations, votre progression et vos certificats restent sur votre compte.
          </p>
        )}
      </div>
      <Illustration />
    </aside>
  );
}
