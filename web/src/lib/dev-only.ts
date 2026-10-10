/** Pages réservées au développement (vitrine des composants) : visibles sur l'ordinateur, jamais sur le site en ligne. */
export function devOnlyPagesVisible(): boolean {
  return process.env.NODE_ENV !== "production";
}
