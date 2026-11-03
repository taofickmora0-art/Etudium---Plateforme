import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les actions du back-office de la Bibliothèque (migration 0074) : chacune revérifie le domaine « contenus », puis la
// base revérifie (règles d'accès, déclencheurs). Le navigateur a déjà déposé les fichiers : l'action les enregistre et
// retire ceux qui sont remplacés.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const {
  enregistrerLivre,
  changerStatutLivre,
  supprimerLivre,
  enregistrerCategorie,
  supprimerCategorie,
  rangerCategorie,
  ajouterLivreFormation,
  retirerLivreFormation,
  rangerLivreFormation,
} = await import("@/lib/bibliotheque/actions");
const { lienLectureLivre, lienTelechargementLivre, noterLecture } = await import("@/lib/bibliotheque/lecteur");
import type { SaisieLivre } from "@/lib/bibliotheque/types";

const L = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";
const P2 = "44444444-4444-4444-8444-444444444444";
const C = "55555555-5555-4555-8555-555555555555";
const F = "66666666-6666-4666-8666-666666666666";
const PDF = `${L}/${U}.pdf`;
const COUV = `livres/${L}/${U}.jpg`;

const SAISIE: SaisieLivre = {
  id: L,
  nouveau: true,
  titre: "Réussir son mémoire",
  auteur: "Dr Mireille Adjovi",
  resume: "Un guide pas à pas.",
  langue: "fr",
  annee: "2025",
  motsCles: "mémoire, méthodologie",
  nbPages: "120",
  categorieId: C,
  parcours: [P1],
  acces: "abonnes",
  telechargeable: false,
  droitsConfirmes: true,
  fichier: { chemin: PDF, tailleOctets: 1_200_000 },
  couverture: COUV,
};

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockReset();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
});

describe("Enregistrer un livre", () => {
  it("un nouveau livre : son adresse vient du titre (« -2 » si elle est prise), ses champs, son PDF, sa couverture, ses parcours", async () => {
    faux.repondre("livres.select", (appel) => (appel.filtres.some((f) => f[0] === "eq") ? { data: null } : { data: [{ id: "autre", slug: "reussir-son-memoire" }] }));
    expect(await enregistrerLivre(SAISIE)).toEqual({ ok: true, id: L });
    expect(faux.de("livres_parcours", "select")).toHaveLength(0);
    const [insertion] = faux.de("livres", "insert");
    expect(insertion.valeurs).toEqual({
      id: L,
      slug: "reussir-son-memoire-2",
      titre: "Réussir son mémoire",
      auteur: "Dr Mireille Adjovi",
      resume: "Un guide pas à pas.",
      langue: "fr",
      annee: 2025,
      mots_cles: ["mémoire", "méthodologie"],
      nb_pages: 120,
      categorie_id: C,
      acces: "abonnes",
      telechargeable: false,
      droits_confirmes: true,
      fichier: PDF,
      taille_octets: 1_200_000,
      couverture: COUV,
    });
    expect(faux.de("livres_parcours", "insert")[0].valeurs).toEqual([{ livre_id: L, parcours_id: P1 }]);
    expect(refresh).toHaveBeenCalled();
  });

  it("un nouveau livre déjà écrit par un premier essai interrompu est modifié, pas recréé", async () => {
    faux.repondre("livres.select", (appel) =>
      appel.filtres.some((f) => f[0] === "eq") ? { data: { fichier: PDF, couverture: null, publie_le: null } } : { data: [] },
    );
    faux.repondre("livres_parcours.select", { data: [] });
    expect(await enregistrerLivre(SAISIE)).toEqual({ ok: true, id: L });
    expect(faux.de("livres", "insert")).toHaveLength(0);
    expect(faux.de("livres", "update")).toHaveLength(1);
    expect(faux.de("livres_parcours", "insert")[0].valeurs).toEqual([{ livre_id: L, parcours_id: P1 }]);
  });

  it("une modification d'un livre supprimé entre-temps : le message le dit", async () => {
    faux.repondre("livres.select", { data: null });
    expect(await enregistrerLivre({ ...SAISIE, nouveau: false })).toEqual({ ok: false, message: "Ce livre n’existe plus." });
  });

  it("une modification : les parcours décochés retirés, l'ancien PDF et l'ancienne couverture supprimés", async () => {
    const ANCIEN = `${L}/${P1}.pdf`;
    const ANCIENNE = `livres/${L}/${P1}.png`;
    faux.repondre("livres.select", (appel) =>
      appel.filtres.some((f) => f[0] === "eq")
        ? { data: { fichier: ANCIEN, couverture: ANCIENNE, publie_le: "2026-11-01T08:00:00Z", slug: "reussir-son-memoire" } }
        : { data: [] },
    );
    faux.repondre("livres_parcours.select", { data: [{ parcours_id: P1 }, { parcours_id: P2 }] });
    expect(await enregistrerLivre({ ...SAISIE, nouveau: false })).toEqual({ ok: true, id: L });
    const [maj] = faux.de("livres", "update");
    // Publié : l'adresse ne change plus (elle n'est pas renvoyée).
    expect(maj.valeurs).not.toHaveProperty("slug");
    expect(maj.valeurs).toMatchObject({ fichier: PDF, couverture: COUV, titre: "Réussir son mémoire" });
    expect(faux.de("livres_parcours", "delete")[0].filtres).toContainEqual(["in", "parcours_id", [P2]]);
    expect(faux.de("livres_parcours", "insert")).toHaveLength(0);
    expect(faux.de("storage.bibliotheque", "remove")[0].valeurs).toEqual([[ANCIEN]]);
    expect(faux.de("storage.couvertures", "remove")[0].valeurs).toEqual([[ANCIENNE]]);
  });

  it("une modification sans nouveau fichier ne touche ni au PDF ni à la couverture ; un brouillon suit son titre", async () => {
    faux.repondre("livres.select", (appel) =>
      appel.filtres.some((f) => f[0] === "eq") ? { data: { fichier: PDF, couverture: null, publie_le: null, slug: "ancien-titre" } } : { data: [] },
    );
    faux.repondre("livres_parcours.select", { data: [{ parcours_id: P1 }] });
    expect(await enregistrerLivre({ ...SAISIE, nouveau: false, fichier: undefined, couverture: undefined })).toEqual({ ok: true, id: L });
    const [maj] = faux.de("livres", "update");
    expect(maj.valeurs).not.toHaveProperty("fichier");
    expect(maj.valeurs).not.toHaveProperty("couverture");
    expect(maj.valeurs).toMatchObject({ slug: "reussir-son-memoire" });
    expect(faux.de("storage.bibliotheque", "remove")).toHaveLength(0);
  });

  it("refuse une saisie invalide, un fichier hors du dossier du livre, un compte hors du domaine", async () => {
    expect(await enregistrerLivre({ ...SAISIE, titre: "" })).toEqual({ ok: false, erreurs: { titre: "Entrez le titre du livre." } });
    expect(await enregistrerLivre({ ...SAISIE, fichier: { chemin: `${U}/${U}.pdf`, tailleOctets: 10 } })).toEqual({
      ok: false,
      erreurs: { fichier: "Ce fichier n’est pas dans le dossier du livre." },
    });
    expect(await enregistrerLivre({ ...SAISIE, fichier: { chemin: PDF, tailleOctets: 60_000_000 } })).toEqual({
      ok: false,
      erreurs: { fichier: "Ce fichier dépasse 50 Mo." },
    });
    expect(await enregistrerLivre({ ...SAISIE, couverture: `${L}/${U}.jpg` })).toMatchObject({
      ok: false,
      message: "Cette image n’est pas dans le dossier du livre.",
    });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    expect(await enregistrerLivre(SAISIE)).toEqual({ ok: false, message: "Vous n’avez pas accès à cette partie du back-office." });
    expect(faux.de("livres", "insert")).toHaveLength(0);
  });

  it("une règle de la base (case des droits d'un livre publié) revient sous son champ ; sans la 0074, le guide", async () => {
    faux.repondre("livres.select", (appel) =>
      appel.filtres.some((f) => f[0] === "eq") ? { data: { fichier: PDF, couverture: null, publie_le: "2026-11-01", slug: "x" } } : { data: [] },
    );
    faux.repondre("livres.update", { error: { code: "P0001", message: "Un livre publié garde la case « J'ai le droit de diffuser ce livre » cochée." } });
    expect(await enregistrerLivre({ ...SAISIE, nouveau: false, droitsConfirmes: false, fichier: undefined, couverture: undefined })).toEqual({
      ok: false,
      erreurs: { droitsConfirmes: "Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée." },
    });
    faux.vider();
    faux.repondre("livres.select", { error: { code: "PGRST205", message: "table absente" } });
    expect(await enregistrerLivre(SAISIE)).toEqual({ ok: false, message: "Appliquez la migration 0074 (guide « Ce qui te revient », section 73)." });
  });
});

describe("Publier, archiver, supprimer", () => {
  it("publier et archiver passent par la base ; son refus revient tel quel", async () => {
    faux.repondre("livres.update", { data: [{ id: L }] });
    expect(await changerStatutLivre(L, "publie")).toEqual({ ok: true });
    expect(faux.de("livres", "update")[0].valeurs).toEqual({ statut: "publie" });
    faux.repondre("livres.update", { error: { code: "P0001", message: "Déposez le PDF du livre avant de le publier." } });
    expect(await changerStatutLivre(L, "publie")).toEqual({ ok: false, message: "Déposez le PDF du livre avant de le publier." });
    expect(await changerStatutLivre(L, "brouillon" as never)).toMatchObject({ ok: false });
  });

  it("supprimer un brouillon : la ligne, puis son PDF et sa couverture ; un livre publié s'archive", async () => {
    faux.repondre("livres.select", { data: { statut: "brouillon", publie_le: null } });
    faux.repondre("livres.delete", { data: [{ id: L }] });
    faux.repondre("storage.bibliotheque.list", { data: [{ name: `${U}.pdf` }] });
    faux.repondre("storage.couvertures.list", { data: [{ name: `${U}.jpg` }] });
    expect(await supprimerLivre(L)).toEqual({ ok: true, redirection: "/admin/bibliotheque" });
    expect(faux.de("storage.bibliotheque", "remove")[0].valeurs).toEqual([[PDF]]);
    expect(faux.de("storage.couvertures", "remove")[0].valeurs).toEqual([[COUV]]);
    faux.vider();
    faux.repondre("livres.select", { data: { statut: "publie", publie_le: "2026-11-01" } });
    expect(await supprimerLivre(L)).toEqual({ ok: false, message: "Un livre publié s’archive, il ne se supprime pas." });
    expect(faux.de("livres", "delete")).toHaveLength(0);
  });
});

describe("Les catégories", () => {
  it("créer : le nom, une adresse tirée du nom, en fin de liste ; un nom déjà pris est refusé", async () => {
    faux.repondre("categories_livres.select", { data: [{ id: C, nom: "Méthodes", slug: "methodes", ordre: 1 }] });
    faux.repondre("categories_livres.insert", { data: { id: U, nom: "Modèles de mémoire", slug: "modeles-de-memoire", ordre: 2 } });
    expect(await enregistrerCategorie({ nom: "  Modèles de mémoire " })).toEqual({
      ok: true,
      categorie: { id: U, nom: "Modèles de mémoire", slug: "modeles-de-memoire", ordre: 2 },
    });
    expect(faux.de("categories_livres", "insert")[0].valeurs).toEqual({ nom: "Modèles de mémoire", slug: "modeles-de-memoire", ordre: 2 });
    expect(await enregistrerCategorie({ nom: "methodes" })).toEqual({ ok: false, message: "Cette catégorie existe déjà." });
    expect(await enregistrerCategorie({ nom: " " })).toEqual({ ok: false, message: "Entrez le nom de la catégorie." });
  });

  it("renommer garde l'adresse ; supprimer et ranger", async () => {
    faux.repondre("categories_livres.select", { data: [{ id: C, nom: "Méthodes", slug: "methodes", ordre: 1 }] });
    faux.repondre("categories_livres.update", { data: { id: C, nom: "Méthodes de travail", slug: "methodes", ordre: 1 } });
    expect(await enregistrerCategorie({ id: C, nom: "Méthodes de travail" })).toMatchObject({
      ok: true,
      categorie: { nom: "Méthodes de travail", slug: "methodes" },
    });
    expect(faux.de("categories_livres", "update")[0].valeurs).toEqual({ nom: "Méthodes de travail" });
    faux.repondre("categories_livres.delete", { data: [{ id: C }] });
    expect(await supprimerCategorie(C)).toEqual({ ok: true });
    expect(await rangerCategorie(C, 2)).toEqual({ ok: true });
    expect(faux.de("rpc", "ranger_categorie_livre")[0].valeurs).toEqual({ p_categorie: C, p_position: 2 });
  });
});

describe("Les livres recommandés d'une formation", () => {
  it("ajouter en fin de liste, retirer, ranger ; un brouillon est refusé par la base", async () => {
    faux.repondre("livres_formations.select", { data: { ordre: 3 } });
    expect(await ajouterLivreFormation(F, L)).toEqual({ ok: true });
    expect(faux.de("livres_formations", "insert")[0].valeurs).toEqual({ formation_id: F, livre_id: L, ordre: 4 });
    faux.repondre("livres_formations.insert", { error: { code: "42501", message: "row-level security" } });
    expect(await ajouterLivreFormation(F, L)).toEqual({ ok: false, message: "Seul un livre publié peut être recommandé." });
    faux.repondre("livres_formations.insert", { error: { code: "23505", message: "duplicate" } });
    expect(await ajouterLivreFormation(F, L)).toEqual({ ok: false, message: "Ce livre est déjà recommandé." });
    expect(await retirerLivreFormation(F, L)).toEqual({ ok: true });
    expect(faux.de("livres_formations", "delete")[0].filtres).toEqual([
      ["eq", "formation_id", F],
      ["eq", "livre_id", L],
    ]);
    expect(await rangerLivreFormation(F, L, 1)).toEqual({ ok: true });
    expect(faux.de("rpc", "ranger_livre_formation")[0].valeurs).toEqual({ p_formation: F, p_livre: L, p_position: 1 });
  });
});

describe("Le lecteur (étape B) : liens signés et lecture", () => {
  it("le lien de lecture : le chemin donné par la base, signé 2 minutes", async () => {
    faux.repondre("rpc.chemin_livre", { data: PDF });
    faux.repondre("storage.bibliotheque.createSignedUrl", { data: { signedUrl: "https://x.supabase.co/signe?token=t" } });
    expect(await lienLectureLivre(L)).toEqual({ url: "https://x.supabase.co/signe?token=t" });
    expect(faux.de("storage.bibliotheque", "createSignedUrl")[0].valeurs).toEqual([PDF, 120]);
    faux.repondre("rpc.chemin_livre", { error: { code: "42501", message: "Ce livre ne vous est pas ouvert." } });
    expect(await lienLectureLivre(L)).toEqual({ erreur: "Ce livre ne vous est pas ouvert." });
    expect(await lienLectureLivre("pas-un-id")).toEqual({ erreur: "Ce livre n’est pas accessible." });
  });

  it("le téléchargement : noté par la base, puis un lien qui propose le titre comme nom", async () => {
    faux.repondre("rpc.noter_telechargement", { data: null });
    faux.repondre("rpc.chemin_livre", { data: PDF });
    faux.repondre("storage.bibliotheque.createSignedUrl", { data: { signedUrl: "https://x.supabase.co/signe?token=t" } });
    expect(await lienTelechargementLivre(L, "Réussir / son mémoire")).toEqual({
      url: `https://x.supabase.co/signe?token=t&download=${encodeURIComponent("Réussir - son mémoire.pdf")}`,
    });
    faux.repondre("rpc.noter_telechargement", { error: { code: "P0001", message: "Ce livre se lit dans le site, sans téléchargement." } });
    expect(await lienTelechargementLivre(L, "x")).toEqual({ erreur: "Ce livre se lit dans le site, sans téléchargement." });
  });

  it("noter la page lue ; sans la 0074, un message neutre", async () => {
    faux.repondre("rpc.noter_lecture", { data: { derniere_page: 4, nb_pages: 10, pourcentage: 40, terminee: false } });
    expect(await noterLecture(L, 4, 10)).toEqual({ ok: true, lecture: { dernierePage: 4, nbPages: 10, pourcentage: 40, terminee: false } });
    expect(faux.de("rpc", "noter_lecture")[0].valeurs).toEqual({ p_livre: L, p_page: 4, p_total: 10 });
    faux.repondre("rpc.noter_lecture", { error: { code: "PGRST202", message: "absente" } });
    expect(await noterLecture(L, 4, 10)).toEqual({ ok: false, erreur: "Cette fonction n’est pas disponible pour le moment." });
  });
});
