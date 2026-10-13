import { CourseCard } from "@/components/ui/CourseCard";
import type { Parcours } from "@/components/ui/CourseIllustration";
import { parcoursPrincipal } from "@/lib/catalogue/regles";
import type { EtatSuivi, FormationSuivie } from "@/lib/mes-formations/regles";

/** Ce qu'une carte de formation suivie affiche (données simples, transmises aux composants du navigateur). */
export type VueCarteSuivie = {
  id: string;
  titre: string;
  resume: string;
  parcours: Parcours;
  pourcentage: number;
  temps: string;
  etat: EtatSuivi;
  href: string | null;
  favori: boolean;
};

export function versVueCarte(s: FormationSuivie): VueCarteSuivie {
  return {
    id: s.fiche.id,
    titre: s.fiche.titre,
    resume: s.fiche.resume,
    parcours: parcoursPrincipal(s.fiche),
    pourcentage: s.progression.pourcentage,
    temps: s.temps,
    etat: s.etat,
    href: s.href,
    favori: s.favori,
  };
}

/**
 * Carte d'une formation suivie (NdMesFormations) : progression et temps ; toute la carte mène à la leçon où reprendre.
 * Une formation verrouillée porte le badge « Verrouillée » et mène à sa fiche ; archivée, elle n'est plus un lien.
 */
export function CarteSuivie({ vue, sansEtiquette = false }: { vue: VueCarteSuivie; sansEtiquette?: boolean }) {
  const state = vue.etat === "verrouillee" ? "verrouillee" : vue.etat === "terminee" ? "terminee" : vue.pourcentage === 0 ? "aCommencer" : "enCours";
  return (
    <CourseCard
      href={vue.href}
      title={vue.titre}
      description={vue.resume}
      parcours={vue.parcours}
      progress={vue.pourcentage}
      timeLabel={vue.temps}
      state={state}
      titleAs="h2"
      sansEtiquette={sansEtiquette}
    />
  );
}
