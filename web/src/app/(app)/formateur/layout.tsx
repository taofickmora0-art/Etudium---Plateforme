import type { ReactNode } from "react";
import { CoqueConnectee } from "@/components/layout/CoqueConnectee";

/** Espace formateur : sa coque et son menu (tableau de bord, enseignement). */
export default function Layout({ children }: { children: ReactNode }) {
  return <CoqueConnectee espace="formateur">{children}</CoqueConnectee>;
}
