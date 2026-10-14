"use client";

import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { ProfileData } from "@/lib/profile/data";
import type { OngletProfil } from "@/lib/profile/onglets";
import { InformationsTab } from "./InformationsTab";
import { NotificationsTab } from "./NotificationsTab";
import { SecurityTab } from "./SecurityTab";

/** Séparateur sous les onglets, puis le contenu (NdProfil : 20 px, puis 32 px). */
function Panneau({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-px bg-separateur" />
      <div className="mt-8">{children}</div>
    </>
  );
}

/** Les trois sections de « Mon profil » (NdProfil) ; `ongletInitial` vient de l'adresse (?onglet=notifications). */
export function ProfileTabs({ profile, ongletInitial = "informations" }: { profile: ProfileData; ongletInitial?: OngletProfil }) {
  return (
    <SegmentedTabs
      label="Sections du profil"
      defaultValue={ongletInitial}
      keepMounted
      className="gap-5"
      items={[
        {
          value: "informations",
          label: "Informations",
          content: (
            <Panneau>
              <InformationsTab profile={profile} />
            </Panneau>
          ),
        },
        {
          value: "notifications",
          label: "Notifications",
          content: (
            <Panneau>
              <NotificationsTab profile={profile} />
            </Panneau>
          ),
        },
        {
          value: "securite",
          label: "Sécurité",
          content: (
            <Panneau>
              <SecurityTab profile={profile} />
            </Panneau>
          ),
        },
      ]}
    />
  );
}
