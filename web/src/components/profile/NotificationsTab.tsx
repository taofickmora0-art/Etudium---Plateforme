"use client";

import type { ProfileData } from "@/lib/profile/data";

/** Onglet Notifications (NdProfil) : 8 catégories et les canaux. */
export function NotificationsTab({ profile }: { profile: ProfileData }) {
  void profile;
  return (
    <div className="rounded-carte border border-bordure-carte bg-panneau p-6 pb-3">
      <h2 className="m-0 text-xl leading-7 font-semibold text-encre">
        Préférences de notification
      </h2>
    </div>
  );
}
