"use client";

import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { ProgressionJeu } from "@/lib/engagement/types";
import type { ProfileData } from "@/lib/profile/data";
import type { OngletProfil } from "@/lib/profile/onglets";
import { CarteGamification } from "./CarteGamification";
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

/**
 * Les trois sections de « Mon profil » (NdProfil) ; `ongletInitial` vient de l'adresse (?onglet=notifications). `jeu` :
 * la progression de l'étudiant (lot 6 B) : la carte « Gamification » et l'objectif de la semaine ; absent pour le
 * formateur, ou sans la migration 0063.
 */
export function ProfileTabs({ profile, ongletInitial = "informations", jeu }: { profile: ProfileData; ongletInitial?: OngletProfil; jeu?: ProgressionJeu | null }) {
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
              {jeu ? (
                <div className="flex flex-wrap items-start gap-5">
                  <div className="min-w-0 flex-[999_1_420px]">
                    <InformationsTab profile={profile} />
                  </div>
                  <div className="min-w-0 flex-[1_1_300px]">
                    <CarteGamification jeu={jeu} />
                  </div>
                </div>
              ) : (
                <InformationsTab profile={profile} />
              )}
            </Panneau>
          ),
        },
        {
          value: "notifications",
          label: "Notifications",
          content: (
            <Panneau>
              <NotificationsTab profile={profile} objectif={jeu?.objectifJours} />
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
