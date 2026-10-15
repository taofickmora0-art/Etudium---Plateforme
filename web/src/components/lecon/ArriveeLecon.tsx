"use client";

import { useEffect } from "react";

/**
 * L'arrivée sur une leçon, sur ordinateur, où le panneau défile seul (refonte des formations, étape B) : il reçoit le
 * focus, pour qu'Espace, Page suivante et ↓ le fassent défiler sans clic ; le programme montre la leçon en cours, même
 * dans un module du bas. Rien sur téléphone, où la page défile normalement.
 */
export function ArriveeLecon() {
  useEffect(() => {
    if (!window.matchMedia?.("(min-width: 64rem)").matches) return;
    document.getElementById("contenu")?.focus({ preventScroll: true });
    document.querySelector('.programme-lecon [aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, []);
  return null;
}
