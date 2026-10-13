// Grilles de cartes du design : des colonnes aussi larges que possible, jamais plus étroites que leur minimum.

/** Trois colonnes au plus, puis deux, puis une (annexe 1.9 §0.2, GRILLE-3). */
export const GRILLE_CARTES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(232px,calc((100%-40px)/3))),1fr))] gap-5";

/** Deux colonnes au plus, puis une (tuiles du tableau de bord au lot 1, plan 1.10 Q1). */
export const GRILLE_DEUX = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(228px,calc((100%-20px)/2))),1fr))] gap-5";
