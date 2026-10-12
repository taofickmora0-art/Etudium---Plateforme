import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FicheFormation } from "@/lib/catalogue/types";
import { fauxSupabase } from "../admin/faux-supabase";
import { EXCEL, id } from "./donnees";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { getLecon } = await import("@/lib/lecon/data");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** La fiche telle que la base la renvoie (formations publiées, programme avec l'accès calculé). */
const ligneFormation = (fiche: FicheFormation) => ({
  id: fiche.id,
  slug: fiche.slug,
  titre: fiche.titre,
  resume: fiche.resume,
  niveau: fiche.niveau,
  gratuite: fiche.gratuite,
  achat_separe: fiche.achatSepare,
  badge: fiche.badge,
  publiee_le: fiche.publieeLe,
  formations_parcours: [],
  description: fiche.description,
  objectifs: [],
  competences: [],
  formateurs: { nom: "Dr Mireille Adjovi", titre: "", domaine: "", presentation: "" },
  modules: fiche.modules.map((m, i) => ({
    id: m.id,
    titre: m.titre,
    ordre: i + 1,
    lecons: m.lecons.map((l, j) => ({
      id: l.id,
      titre: l.titre,
      titre_court: l.titreCourt ?? null,
      duree_secondes: l.dureeSecondes,
      apercu: l.apercu,
      ordre: j + 1,
      accessible: l.accessible,
    })),
  })),
});

const LECON_APERCU = {
  id: id(1),
  titre: "Découvrir l’interface",
  duree_secondes: 370,
  apercu: true,
  resume: "Le ruban, les onglets et la barre de formule.",
  points_cles: ["Repérer le ruban", "Nommer une feuille"],
  accessible: true,
  lecons_contenus: { video_fournisseur: "youtube", video_id: "dQw4w9WgXcQ", texte: "Ouvrez Excel." },
  ressources: [
    { id: "r2", titre: "Guide de l’interface", format: "application/pdf", taille_octets: 1_200_000, telechargeable: false, ordre: 2 },
    { id: "r1", titre: "Classeur d’exemple", format: XLSX, taille_octets: 84_000, telechargeable: true, ordre: 1 },
  ],
};

describe("Lecture de la page leçon", () => {
  beforeEach(() => {
    faux.vider();
    faux.repondre("formations.select", { data: ligneFormation(EXCEL) });
  });

  it("un identifiant de leçon mal formé ne trouve rien, sans requête", async () => {
    expect(await getLecon("maitriser-microsoft-excel", "abc", true)).toBeNull();
    expect(await getLecon("maitriser-microsoft-excel", "../admin", true)).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("une leçon d'une autre formation ne trouve rien", async () => {
    expect(await getLecon("maitriser-microsoft-excel", id(99), true)).toBeNull();
    expect(faux.de("lecons")).toEqual([]);
  });

  it("une leçon ouverte donne sa vidéo, son texte, ses ressources dans l'ordre et la note du compte", async () => {
    faux.repondre("lecons.select", { data: LECON_APERCU });
    faux.repondre("notes_lecons.select", { data: { texte: "Ma note" } });
    const donnees = await getLecon("maitriser-microsoft-excel", id(1), true);
    expect(donnees?.lecon).toEqual({
      id: id(1),
      titre: "Découvrir l’interface",
      dureeSecondes: 370,
      apercu: true,
      accessible: true,
      resume: "Le ruban, les onglets et la barre de formule.",
      pointsCles: ["Repérer le ruban", "Nommer une feuille"],
      video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
      texte: "Ouvrez Excel.",
      ressources: [
        { id: "r1", titre: "Classeur d’exemple", format: XLSX, tailleOctets: 84_000, telechargeable: true },
        { id: "r2", titre: "Guide de l’interface", format: "application/pdf", tailleOctets: 1_200_000, telechargeable: false },
      ],
    });
    expect(donnees).toMatchObject({ note: "Ma note", notesDisponibles: true });
    expect(donnees?.fiche.modules[0].lecons[1].titreCourt).toBe("Saisir et mettre en forme");
    const [appel] = faux.de("lecons", "select");
    expect(appel.filtres).toContainEqual(["eq", "id", id(1)]);
    expect(faux.de("notes_lecons", "select")[0].filtres).toContainEqual(["eq", "lecon_id", id(1)]);
  });

  it("une leçon fermée ne livre ni vidéo, ni texte, ni ressources, même si la base en renvoyait", async () => {
    faux.repondre("lecons.select", { data: { ...LECON_APERCU, id: id(3), titre: "Les formules essentielles", apercu: false, accessible: false } });
    const donnees = await getLecon("maitriser-microsoft-excel", id(3), true);
    expect(donnees?.lecon).toMatchObject({ accessible: false, video: null, texte: "", ressources: [], resume: "Le ruban, les onglets et la barre de formule." });
  });

  it("sans la table des notes (migration 0006), la page s'affiche quand même", async () => {
    faux.repondre("lecons.select", { data: LECON_APERCU });
    faux.repondre("notes_lecons.select", { error: { code: "PGRST205" } });
    expect(await getLecon("maitriser-microsoft-excel", id(1), true)).toMatchObject({ note: null, notesDisponibles: false });
  });

  it("pour un visiteur, la note n'est pas demandée", async () => {
    faux.repondre("lecons.select", { data: LECON_APERCU });
    expect(await getLecon("maitriser-microsoft-excel", id(1), false)).toMatchObject({ note: null, notesDisponibles: true });
    expect(faux.de("notes_lecons")).toEqual([]);
  });

  it("une leçon sans vidéo, ou supprimée entre-temps", async () => {
    faux.repondre("lecons.select", { data: { ...LECON_APERCU, lecons_contenus: null, ressources: [] } });
    expect((await getLecon("maitriser-microsoft-excel", id(1), false))?.lecon).toMatchObject({ video: null, texte: "", ressources: [] });
    faux.repondre("lecons.select", { data: null });
    expect(await getLecon("maitriser-microsoft-excel", id(1), false)).toBeNull();
  });
});
