// Grilles de cartes du design : des colonnes aussi larges que possible, jamais plus étroites que leur minimum.

/** Trois colonnes au plus, puis deux, puis une (annexe 1.9 §0.2, GRILLE-3). */
export const GRILLE_CARTES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(232px,calc((100%-40px)/3))),1fr))] gap-5";


/**
 * Quatre colonnes dès 1060 px de contenu, sinon deux, puis une (« Pour bien commencer » de la landing, annexe 1.12
 * §8.3, corrigée : jamais de colonne vide au-delà de 1330 px, ni de débordement sous 250 px).
 */
export const GRILLE_QUATRE_OU_DEUX =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(250px,clamp(calc((100%-60px)/4),calc((1060px-100%)*999),calc((100%-20px)/2)))),1fr))] gap-5";
