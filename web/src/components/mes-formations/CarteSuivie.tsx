import { CourseCard } from "@/components/ui/CourseCard";
import type { TagTone } from "@/components/ui/Tag";
import type { Parcours } from "@/components/ui/CourseIllustration";
import { parcoursPrincipal } from "@/lib/catalogue/regles";
import { urlCouverture } from "@/lib/couvertures/adresse";
import type { EtatSuivi, FormationSuivie } from "@/lib/mes-formations/regles";

/** Ce qu'une carte de formation suivie affiche (données simples, transmises aux composants du navigateur). */
export type VueCarteSuivie = {
  id: string;
  titre: string;
  resume: string;
  parcours: Parcours;
  /** Le nom court du parcours, pour son badge (« Académique ») ; absent : pas de badge. */
  parcoursNom?: string | null;
  pourcentage: number;
  temps: string;
  etat: EtatSuivi;
  /** Désactivée par l'équipe : « Indisponible » au lieu de « Verrouillée ». */
  indisponible?: boolean;
  href: string | null;
  favori: boolean;
  /** Adresse de l'image de couverture ; null : couverture par défaut du parcours. */
  couverture: string | null;
};

export function versVueCarte(s: FormationSuivie): VueCarteSuivie {
  return {
    id: s.fiche.id,
    titre: s.fiche.titre,
    resume: s.fiche.resume,
    parcours: parcoursPrincipal(s.fiche),
    parcoursNom: [...s.fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0]?.nomCourt ?? null,
    pourcentage: s.progression.pourcentage,
    temps: s.temps,
    etat: s.etat,
    indisponible: s.indisponible,
    href: s.href,
    favori: s.favori,
    couverture: urlCouverture(s.fiche.couverture),
  };
}

/**
 * Carte d'une formation suivie (NdMesFormations) : progression et temps ; toute la carte mène à la leçon où reprendre.
 * Une formation verrouillée porte le badge « Verrouillée » et mène à sa fiche ; archivée, elle n'est plus un lien ;
 * désactivée par l'équipe, elle porte « Indisponible », sans lien.
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
      lockLabel={vue.indisponible ? "Indisponible" : undefined}
      titleAs="h2"
      sansEtiquette={sansEtiquette}
      // Le badge du parcours (liste du 31 octobre 2026, tâche 15).
      parcoursTag={vue.parcoursNom && !sansEtiquette ? { tone: vue.parcours as TagTone, label: vue.parcoursNom } : undefined}
      couverture={vue.couverture}
    />
  );
}
