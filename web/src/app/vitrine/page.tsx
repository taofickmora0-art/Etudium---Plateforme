import type { Metadata } from "next";
import { Boutons } from "./sections/Boutons";
import { Fondations } from "./sections/Fondations";

export const metadata: Metadata = {
  title: "Vitrine des composants · Étudium",
  robots: { index: false },
};

const PLANCHES = [
  { id: "fondations", label: "Fondations" },
  { id: "boutons", label: "Boutons" },
];

export default function VitrinePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 py-8 sm:px-14 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="m-0 text-[13.5px] leading-5 font-medium tracking-[0.04em] text-ardoise uppercase">Vitrine · tâche 0.2</p>
        <nav aria-label="Planches" className="flex flex-wrap gap-2">
          {PLANCHES.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="focus-etudium rounded-champ bg-panneau px-3.5 py-2 text-sm font-medium text-texte hover:bg-coque"
            >
              {p.label}
            </a>
          ))}
        </nav>
      </header>
      <Fondations />
      <Boutons />
    </div>
  );
}
