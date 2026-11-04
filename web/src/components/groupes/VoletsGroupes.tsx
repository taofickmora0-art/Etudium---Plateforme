"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { DeuxVolets } from "@/components/ui/DeuxVolets";

/**
 * Les deux volets des Groupes (demande du 4 novembre 2026) : la liste, montée une fois par la mise en page commune
 * (elle garde sa place et sa recherche d'un groupe à l'autre), et le groupe ouvert. Au téléphone, l'un ou l'autre.
 */
export function VoletsGroupes({ liste, children }: { liste: ReactNode; children: ReactNode }) {
  const ouvert = useSelectedLayoutSegment() !== null;
  return (
    <DeuxVolets liste={liste} ouvert={ouvert}>
      {children}
    </DeuxVolets>
  );
}
