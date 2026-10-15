import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

/**
 * Colonnes du pied de page (NdLanding §16). Les ancres mènent aux sections de la landing (« Tarifs » : les formules,
 * jusqu'à la page Tarifs du lot 2). « Contact » viendra avec l'adresse e-mail de contact.
 */
const COLONNES = [
  {
    titre: "Plateforme",
    liens: [
      { href: "/formations", label: "Formations" },
      { href: "/#parcours", label: "Parcours" },
      { href: "/#formules", label: "Tarifs" },
    ],
  },
  {
    titre: "Ressources",
    liens: [
      { href: "/#faq", label: "Questions fréquentes" },
      { href: "/verifier", label: "Vérifier un certificat" },
      { href: "/#communaute", label: "Communauté" },
    ],
  },
  {
    titre: "Légal",
    liens: [
      { href: "/conditions", label: "Conditions d’utilisation" },
      { href: "/confidentialite", label: "Confidentialité" },
    ],
  },
];

/** Pied de page public : bleu nuit à motif de points, dernier élément du bloc gris-bleu de la page. */
export function PiedDePagePublic() {
  return (
    <footer className="box-border flex flex-wrap gap-x-12 gap-y-8 rounded-panneau bg-[#060F75] trame-points p-[clamp(28px,4.5vw,56px)] text-[#C2C8FF]">
      <div className="flex max-w-[360px] flex-[1_1_280px] flex-col gap-3.5">
        <span className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em] text-white">
          <LogoMark inverse />
          Étudium
        </span>
        <span className="text-[15px] leading-6">Formation, compétences digitales et accompagnement pour les étudiants et les jeunes diplômés.</span>
      </div>
      {COLONNES.map((colonne) => (
        <nav key={colonne.titre} aria-label={colonne.titre} className="flex flex-[0_1_180px] flex-col gap-1">
          <span className="mb-2 text-[13px] font-semibold tracking-[0.04em] text-[#9DA6FF] uppercase">{colonne.titre}</span>
          {colonne.liens.map((lien) => (
            <Link key={lien.href} href={lien.href} className="focus-blanc flex min-h-[34px] items-center text-[15px] font-medium text-white no-underline hover:underline">
              {lien.label}
            </Link>
          ))}
        </nav>
      ))}
      <div className="flex-[1_1_100%] border-t border-white/16 pt-5 text-[13px] leading-5">© 2026 Étudium. Tous droits réservés.</div>
    </footer>
  );
}
