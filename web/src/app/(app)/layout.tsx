import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Espace connecté. Chaque espace a sa coque et son menu (étudiant : (etudiant)/layout ; formateur et back-office :
 * leur propre layout) : l'espace est connu du serveur, sans attendre l'adresse côté navigateur.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
