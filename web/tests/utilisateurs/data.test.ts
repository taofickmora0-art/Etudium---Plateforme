import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lecture des comptes par les fonctions de la migration 0013 (spec des utilisateurs, §2, §3, §5).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));

const { lireComptes, lireCompte, lireFichesLibres } = await import("@/lib/utilisateurs/data");

const ID = "11111111-1111-4111-8111-111111111111";
const LIGNE = {
  id: ID,
  prenom: "Fifamè",
  nom: "Adjovi",
  email: "fifame@exemple.com",
  roles: ["etudiant", "formateur", "inconnu"],
  inscrit_le: "2026-10-12T09:00:00+00:00",
  derniere_connexion: null,
  suspendu: true,
};

describe("Lecture des comptes", () => {
  beforeEach(() => faux.vider());

  it("une page de comptes, convertie (rôles inconnus écartés)", async () => {
    faux.repondre("rpc.comptes_equipe", { data: { total: 31, comptes: [LIGNE] } });
    expect(await lireComptes("fifa", "formateurs", 2)).toEqual({
      migrationAbsente: false,
      donnees: {
        total: 31,
        comptes: [{ id: ID, prenom: "Fifamè", nom: "Adjovi", email: "fifame@exemple.com", roles: ["etudiant", "formateur"], inscritLe: LIGNE.inscrit_le, derniereConnexion: null, suspendu: true }],
      },
    });
    expect(faux.de("rpc", "comptes_equipe")[0].valeurs).toEqual({ p_recherche: "fifa", p_filtre: "formateurs", p_page: 2 });
  });

  it("fonction absente (avant la migration 0013) : migrationAbsente", async () => {
    faux.repondre("rpc.comptes_equipe", { error: { code: "PGRST202" } });
    expect(await lireComptes("", "tous", 1)).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.compte_equipe", { error: { code: "42883" } });
    expect(await lireCompte(ID)).toEqual({ migrationAbsente: true });
  });

  it("toute autre erreur est relancée (écran d'erreur du back-office)", async () => {
    faux.repondre("rpc.comptes_equipe", { error: { code: "42501", message: "Accès réservé à l’équipe." } });
    await expect(lireComptes("", "tous", 1)).rejects.toThrow();
    faux.repondre("rpc.compte_equipe", { error: { code: "500", message: "panne" } });
    await expect(lireCompte(ID)).rejects.toThrow();
  });

  it("la fiche d'un compte, convertie", async () => {
    faux.repondre("rpc.compte_equipe", {
      data: {
        ...LIGNE,
        suspension: { depuis: "2026-10-13T08:00:00+00:00", par_nom: "Taofick M.", motif: "Spam" },
        fiche_formateur: { id: "f1", nom: "Fifamè Adjovi" },
        formations: [{ id: "x", titre: "Excel", slug: "excel", terminees: 6, total: 12, derniere_activite: "2026-10-13T07:00:00+00:00" }],
        avis: [{ id: "a", formation_titre: "Excel", note: 4, commentaire: "Bien", masque: true, cree_le: "2026-10-11T07:00:00+00:00" }],
      },
    });
    const lecture = await lireCompte(ID);
    expect(lecture).toEqual({
      migrationAbsente: false,
      donnees: {
        id: ID,
        prenom: "Fifamè",
        nom: "Adjovi",
        email: "fifame@exemple.com",
        roles: ["etudiant", "formateur"],
        inscritLe: LIGNE.inscrit_le,
        derniereConnexion: null,
        suspension: { depuis: "2026-10-13T08:00:00+00:00", parNom: "Taofick M.", motif: "Spam" },
        ficheFormateur: { id: "f1", nom: "Fifamè Adjovi" },
        formations: [{ id: "x", titre: "Excel", slug: "excel", terminees: 6, total: 12, derniereActivite: "2026-10-13T07:00:00+00:00" }],
        avis: [{ id: "a", formationTitre: "Excel", note: 4, commentaire: "Bien", masque: true, creeLe: "2026-10-11T07:00:00+00:00" }],
      },
    });
    expect(faux.de("rpc", "compte_equipe")[0].valeurs).toEqual({ p_compte: ID });
  });

  it("compte inconnu : null ; identifiant mal formé : null sans appel à la base", async () => {
    faux.repondre("rpc.compte_equipe", { data: null });
    expect(await lireCompte(ID)).toEqual({ migrationAbsente: false, donnees: null });
    faux.vider();
    expect(await lireCompte("pas-un-identifiant")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.appels).toEqual([]);
  });

  it("les fiches formateur libres, par nom", async () => {
    faux.repondre("formateurs.select", { data: [{ id: "f1", nom: "Awa" }] });
    expect(await lireFichesLibres()).toEqual([{ id: "f1", nom: "Awa" }]);
    const [appel] = faux.de("formateurs", "select");
    expect(appel.filtres).toContainEqual(["is", "compte_id", null]);
    expect(appel.filtres).toContainEqual(["order", "nom"]);
  });
});
