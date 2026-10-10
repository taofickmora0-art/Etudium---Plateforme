import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CourseIllustration, type Parcours } from "@/components/ui/CourseIllustration";

export const metadata: Metadata = { title: "Page introuvable · Étudium" };

// Trois tuiles inclinées aux couleurs des parcours (Nd404).
const TUILES: { parcours: Parcours; rotation: string }[] = [
  { parcours: "academique", rotation: "-rotate-[7deg]" },
  { parcours: "digital", rotation: "rotate-[4deg] -ml-[13px]" },
  { parcours: "business", rotation: "-rotate-[3deg] -ml-[13px]" },
];

/**
 * Page introuvable (Nd404), pour toute adresse inconnue. Les liens publics de l'en-tête du design
 * (Parcours, Formations, Tarifs, Communauté, Vérifier un certificat, Se connecter, Créer un compte)
 * arriveront avec leurs pages ; en attendant, le logo et le bouton ramènent au départ.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-page px-5 pb-5">
      <header className="flex items-center py-5 pr-1">
        <Link
          href="/"
          aria-label="Étudium, accueil"
          className="focus-etudium flex h-[49px] items-center rounded-bouton bg-coque pr-4 pl-[9px] no-underline"
        >
          <Logo />
        </Link>
      </header>
      <div className="flex flex-1 flex-col gap-5 rounded-coque bg-coque p-5">
        <section
          className="trame-points flex flex-1 items-center justify-center rounded-panneau bg-bleu p-[clamp(28px,5vw,64px)] text-white"
        >
          <div className="flex max-w-[640px] flex-col items-center gap-[18px] text-center">
            <div aria-hidden="true" className="flex items-center">
              {TUILES.map((t) => (
                <span
                  key={t.parcours}
                  className={`flex size-[84px] items-center justify-center rounded-bloc bg-white shadow-[0_10px_28px_rgba(4,10,80,0.22)] ${t.rotation}`}
                >
                  <CourseIllustration parcours={t.parcours} size={52} />
                </span>
              ))}
            </div>
            <span aria-hidden="true" className="mt-2 text-[clamp(110px,17vw,220px)] leading-[0.9] font-semibold tracking-[-0.06em]">
              404
            </span>
            <span className="inline-flex items-center rounded-full bg-white/14 px-[13px] py-1.5 text-[13px] leading-[18px] font-semibold">
              Erreur 404
            </span>
            <h1 className="m-0 text-[clamp(30px,3.6vw,46px)] leading-[1.1] font-medium tracking-[-0.028em] text-balance">Page introuvable</h1>
            <p className="m-0 max-w-[440px] text-[17px] leading-[27px] text-pretty text-bleu-pale">
              Cette page n’existe pas ou a été déplacée. Vérifiez l’adresse, ou repartez de l’accueil.
            </p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="inline-flex h-[52px] items-center justify-center rounded-bouton bg-white px-[22px] text-base font-semibold whitespace-nowrap text-bleu no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Retour à l’accueil
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
