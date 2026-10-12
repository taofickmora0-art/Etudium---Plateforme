import { beforeEach, describe, expect, it, vi } from "vitest";

// getProfile : le compte (getShellUser), les champs du profil et les fournisseurs de connexion.
const user = { id: "u1", identities: [] as { provider: string }[] };
let demo = false;
vi.mock("@/lib/auth/current-user", () => ({
  demoModeActive: () => demo,
  getAuthUser: async () => user,
  getShellUser: async () => ({ prenom: "Aïcha", nom: "Kpadé", email: "aicha.k@exemple.com", initials: "AK", photoUrl: null }),
}));
let ligne: Record<string, unknown> | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const requete = { select: () => requete, eq: () => requete, maybeSingle: async () => ({ data: ligne, error: null }) };
      return requete;
    },
  }),
}));

const { getProfile } = await import("@/lib/profile/data");

describe("Lecture du profil", () => {
  beforeEach(() => {
    demo = false;
    ligne = { telephone: "01 97 00 00 00", pays: "benin", niveau_etudes: null, etablissement: null, filiere: null, objectifs: null, preferences_notifications: { annonces: false } };
  });

  it("les champs du profil et les préférences sont lus", async () => {
    user.identities = [{ provider: "email" }];
    const profil = await getProfile();
    expect(profil).toMatchObject({ prenom: "Aïcha", email: "aicha.k@exemple.com", telephone: "01 97 00 00 00", pays: "benin", niveauEtudes: null });
    expect(profil?.preferences.annonces).toBe(false);
    expect(profil?.preferences.recommandations).toBe(true);
  });

  it("les fournisseurs de connexion sont reconnus", async () => {
    user.identities = [{ provider: "google" }];
    expect(await getProfile()).toMatchObject({ hasPassword: false, googleLinked: true });
    user.identities = [{ provider: "email" }, { provider: "google" }];
    expect(await getProfile()).toMatchObject({ hasPassword: true, googleLinked: true });
  });

  it("en mode démonstration, les valeurs des écrans du design", async () => {
    demo = true;
    expect(await getProfile()).toMatchObject({ telephone: "01 97 00 00 00", pays: "benin", niveauEtudes: "master_1", etablissement: "Université d’Abomey-Calavi" });
  });
});
