import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DEMO_USER } from "@/lib/demo-user";

// Espace connecté. Jusqu'à la tâche 0.4, la coque affiche l'utilisateur de démonstration.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell user={DEMO_USER}>{children}</AppShell>;
}
