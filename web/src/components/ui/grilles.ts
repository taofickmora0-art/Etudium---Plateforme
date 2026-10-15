// Grilles de cartes du design : des colonnes aussi larges que possible, jamais plus étroites que leur minimum.

/** Trois colonnes au plus, puis deux, puis une (annexe 1.9 §0.2, GRILLE-3). */
export const GRILLE_CARTES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(232px,calc((100%-40px)/3))),1fr))] gap-5";

