import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Environnement node par défaut ; les tests de composants déclarent « // @vitest-environment jsdom ».
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Le banc SQL (PGlite) démarre un vrai Postgres et applique les migrations : plus long quand toute la suite tourne en parallèle.
    hookTimeout: 60_000,
    // Les écrans qui saisissent beaucoup de texte (userEvent) dépassent 5 s quand toute la suite tourne en parallèle.
    testTimeout: 20_000,
  },
});
