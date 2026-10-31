// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les photos de la colonne de droite (migration 0040, liste du 31 octobre 2026, tâche 5) : tendances et activités
// récentes montrent la photo de leur auteur ; sans photo, ses initiales ; l'équipe garde son « É ».

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireActivites, lireTendances } = await import("@/lib/communaute/data");
const { ColonneCommunaute } = await import("@/components/communaute/ColonneCommunaute");

const CHEMIN = "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg";
const URL_PHOTO = `https://projet.supabase.co/storage/v1/object/public/photos-profil/${CHEMIN}`;

describe("La colonne de droite", () => {
  it("lit la photo des auteurs des tendances et des activités, et l'affiche ; sans photo, les initiales", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    faux.repondre("rpc.publications_tendances", { data: [{ id: "t1", extrait: "Trouver ses premiers clients", auteur: { nom_court: "Aïcha K.", initiales: "AK", equipe: false, photo: CHEMIN } }] });
    faux.repondre("rpc.activites_recentes", {
      data: [
        { type: "commentaire", publication_id: "p1", auteur: { nom_court: "Taofick M.", initiales: "TM", photo: CHEMIN }, extrait: "Hello", cree_le: "2026-10-31T10:00:00Z" },
        { type: "publication", publication_id: "p2", auteur: { nom_court: "Nadia S.", initiales: "NS", photo: null }, extrait: "Bonjour", cree_le: "2026-10-31T09:00:00Z" },
      ],
    });
    const tendances = await lireTendances();
    const activites = await lireActivites();
    if (tendances.migrationAbsente || activites.migrationAbsente) throw new Error("lecture");
    expect(tendances.donnees[0].auteur.photoUrl).toBe(URL_PHOTO);
    expect(activites.donnees.map((a) => a.auteur.photoUrl ?? null)).toEqual([URL_PHOTO, null]);

    const { container } = render(<ColonneCommunaute session={null} tendances={tendances.donnees} activites={activites.donnees} maintenant={new Date("2026-10-31T11:00:00Z")} />);
    expect([...container.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual([URL_PHOTO, URL_PHOTO]);
    expect(screen.getByText("NS")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
