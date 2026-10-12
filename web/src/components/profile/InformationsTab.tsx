"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { ProfileData } from "@/lib/profile/data";

/** Onglet Informations (NdProfil) : photo, coordonnées, études et objectifs. */
export function InformationsTab({ profile }: { profile: ProfileData }) {
  return (
    <div className="max-w-[680px] rounded-carte border border-bordure-carte bg-panneau p-6">
      <Avatar initials={profile.initials} src={profile.photoUrl} size={64} />
    </div>
  );
}
