import type { Metadata } from "next";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { DEMO_USER } from "@/lib/demo-user";

export const metadata: Metadata = { title: "Profil · Étudium" };

/** Onglet « Profil » de la barre du bas : sur téléphone, il remplace le menu du rond de profil. */
export default function MenuPage() {
  return <MobileProfileMenu user={DEMO_USER} />;
}
