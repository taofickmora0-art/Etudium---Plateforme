import type { ReactNode } from "react";
import { CoqueConnectee } from "@/components/layout/CoqueConnectee";

/** Back-office : sa coque et son menu (tableau de bord, contenus, plateforme). */
export default function Layout({ children }: { children: ReactNode }) {
  return <CoqueConnectee espace="admin">{children}</CoqueConnectee>;
}
