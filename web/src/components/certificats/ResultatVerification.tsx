import { AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Certificat } from "@/lib/certificats/types";
import { dateLongue } from "./dates";

/**
 * Le résultat de la vérification (NdVerificationValide) : « Certificat authentique. » et ce que montre le certificat,
 * ou « Aucun certificat trouvé. ». Rien d'autre n'est montré (ni compte, ni contact).
 */
export function ResultatVerification({ certificat }: { certificat: Certificat | null }) {
  const lignes: [string, string][] = certificat
    ? ([
        ["Titulaire", certificat.titulaire],
        ["Formation", certificat.formation],
        ["Date d’obtention", dateLongue(certificat.delivreLe)],
        ["Identifiant", certificat.identifiant],
        ["Parcours", certificat.parcours],
        ["Formation animée par", certificat.formateur],
      ].filter(([, valeur]) => valeur) as [string, string][])
    : [];
  return (
    <section
      aria-label="Résultat de la vérification"
      className={cn("flex min-w-0 flex-col gap-4 rounded-carte border p-6 max-sm:p-4", certificat ? "border-reussite-texte/30 bg-reussite-fond" : "border-bordure-carte bg-panneau")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex flex-none", certificat ? "text-reussite-texte" : "text-discret")}>
          <Icon icon={certificat ? CheckmarkCircle02Icon : AlertCircleIcon} size={24} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="m-0 text-lg leading-7 font-semibold text-encre">{certificat ? "Certificat authentique." : "Aucun certificat trouvé."}</p>
          <p className="m-0 text-sm leading-[22px] text-texte">
            {certificat ? "Ce certificat a bien été délivré par Étudium." : "Vérifiez l’identifiant (lettres et chiffres) ou scannez à nouveau le QR Code."}
          </p>
        </div>
      </div>
      {certificat && (
        <dl className="m-0 grid min-w-0 gap-x-6 gap-y-3 rounded-champ bg-panneau p-4 sm:grid-cols-2">
          {lignes.map(([terme, valeur]) => (
            <div key={terme} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[13px] leading-5 text-discret">{terme}</dt>
              <dd className="m-0 text-[15px] leading-[22px] font-medium break-words text-encre">{valeur}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
