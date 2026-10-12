"use client";

import type { ProfileData } from "@/lib/profile/data";

/** Onglet Sécurité (NdProfil) : mot de passe, Google, suppression du compte. */
export function SecurityTab({ profile }: { profile: ProfileData }) {
  void profile;
  return (
    <div className="rounded-carte border border-bordure-carte bg-panneau p-6">
      <h2 className="m-0 text-xl leading-7 font-semibold text-encre">
        Mot de passe
      </h2>
    </div>
  );
}
