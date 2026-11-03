// @vitest-environment jsdom
import { render as rendre, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CategorieRangee, LivreAdmin, SaisieLivre } from "@/lib/bibliotheque/types";
import { choisirDansListe } from "../utilitaires/listes";

// La fiche d'un livre au back-office (Bibliothèque, 0074) : les réglages par défaut (inclus dans l'abonnement, non
// téléchargeable), les validations, le PDF (refus au-delà de 50 Mo ou hors PDF, nombre de pages lu par pdf.js), la
// couverture (une image, ou la 1re page du PDF), l'envoi des fichiers avec la progression puis l'enregistrement, et la
// création d'une catégorie. pdf.js, l'envoi et les actions sont simulés.

const enregistrerLivre = vi.fn();
const enregistrerCategorie = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({
  enregistrerLivre: (...a: unknown[]) => enregistrerLivre(...a),
  enregistrerCategorie: (...a: unknown[]) => enregistrerCategorie(...a),
  rangerCategorie: vi.fn(),
  supprimerCategorie: vi.fn(),
}));
const envoyerFichier = vi.fn();
const retirerDeposes = vi.fn();
vi.mock("@/lib/bibliotheque/envoi", () => ({ envoyerFichier: (...a: unknown[]) => envoyerFichier(...a), retirerDeposes: (...a: unknown[]) => retirerDeposes(...a) }));
const lirePdfLocal = vi.fn();
const couvertureDePremierePage = vi.fn();
vi.mock("@/lib/bibliotheque/pdf-local", () => ({
  lirePdfLocal: (...a: unknown[]) => lirePdfLocal(...a),
  couvertureDePremierePage: (...a: unknown[]) => couvertureDePremierePage(...a),
}));
const telecharger = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ download: telecharger }) } }) }));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/bibliotheque/nouveau" }));

const { FormulaireLivre } = await import("@/components/admin/bibliotheque/FormulaireLivre");

const CATEGORIES: CategorieRangee[] = [{ id: "33333333-3333-4333-8333-333333333333", slug: "methodes", nom: "Méthodes de travail", ordre: 1 }];
const PARCOURS = [
  { id: "44444444-4444-4444-8444-444444444444", nom: "Réussite académique" },
  { id: "55555555-5555-4555-8555-555555555555", nom: "Compétences digitales" },
];
const L = "11111111-1111-4111-8111-111111111111";
const LIVRE: LivreAdmin = {
  id: L,
  slug: "reussir-son-memoire",
  titre: "Réussir son mémoire",
  auteur: "Dr Mireille Adjovi",
  resume: "Un guide.",
  langue: "fr",
  annee: 2025,
  motsCles: ["mémoire", "méthodologie"],
  nbPages: 120,
  categorie: { id: CATEGORIES[0].id, slug: "methodes", nom: "Méthodes de travail" },
  parcours: [{ id: PARCOURS[0].id, slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique" }],
  fichier: `${L}/22222222-2222-4222-8222-222222222222.pdf`,
  tailleOctets: 1_200_000,
  couverture: `livres/${L}/22222222-2222-4222-8222-222222222222.jpg`,
  acces: "gratuit",
  telechargeable: true,
  droitsConfirmes: true,
  statut: "publie",
  creeLe: null,
  modifieLe: null,
  publieLe: "2026-11-01T08:00:00Z",
  lectures: 0,
  lecturesTerminees: 0,
  lectures30j: 0,
  telechargements: 0,
  telechargements30j: 0,
  favoris: 0,
  formations: 0,
};

const pdf = (nom = "Guide_du_stage.pdf", taille?: number) => {
  const fichier = new File(["%PDF-1.7 contenu"], nom, { type: "application/pdf" });
  if (taille) Object.defineProperty(fichier, "size", { value: taille });
  return fichier;
};
const document = { pages: 87, ratio: 1.41, dessiner: vi.fn(), fermer: vi.fn() };
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });

const afficher = (livre: LivreAdmin | null = null) =>
  rendre(
    <ToastProvider>
      <FormulaireLivre livre={livre} categories={CATEGORIES} parcours={PARCOURS} />
    </ToastProvider>,
  );
const deposerPdf = (container: HTMLElement, fichier: File) =>
  userEvent.upload(container.querySelector<HTMLInputElement>('input[accept="application/pdf,.pdf"]')!, fichier, { applyAccept: false });
const enregistrerBouton = () => screen.getByRole("button", { name: /^(Ajouter le livre|Enregistrer)$/ });
const derniereSaisie = () => enregistrerLivre.mock.calls.at(-1)?.[0] as SaisieLivre;

const ancienCreate = URL.createObjectURL;
const ancienRevoke = URL.revokeObjectURL;
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:apercu");
  URL.revokeObjectURL = vi.fn();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
});
afterAll(() => {
  URL.createObjectURL = ancienCreate;
  URL.revokeObjectURL = ancienRevoke;
});

beforeEach(() => {
  for (const f of [enregistrerLivre, enregistrerCategorie, envoyerFichier, retirerDeposes, lirePdfLocal, couvertureDePremierePage, telecharger, routeur.push, routeur.refresh]) f.mockReset();
  lirePdfLocal.mockResolvedValue(document);
  couvertureDePremierePage.mockResolvedValue(JPEG);
  envoyerFichier.mockResolvedValue({ ok: true });
  enregistrerLivre.mockImplementation(async (s: SaisieLivre) => ({ ok: true, id: s.id }));
});

describe("Un nouveau livre", () => {
  it("par défaut : inclus dans l'abonnement, non téléchargeable, en français, la case des droits non cochée", () => {
    afficher();
    expect(screen.getByRole("radio", { name: "Inclus dans l’abonnement : lu par les abonnés" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Gratuit : lu par tout compte connecté" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Téléchargement autorisé" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "J’ai le droit de diffuser ce livre" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Langue" })).toHaveTextContent("Français");
    expect(screen.getByRole("combobox", { name: "Catégorie" })).toHaveTextContent("Aucune");
    expect(screen.getByText("Déposez le PDF du livre")).toBeInTheDocument();
    // Sans PDF, rien à dessiner.
    expect(screen.getByRole("button", { name: "Fabriquer à partir de la 1re page" })).toBeDisabled();
  });

  it("le titre est obligatoire : rien n'est envoyé sans lui", async () => {
    afficher();
    await userEvent.click(enregistrerBouton());
    expect(await screen.findByText("Entrez le titre du livre.")).toBeInTheDocument();
    expect(envoyerFichier).not.toHaveBeenCalled();
    expect(enregistrerLivre).not.toHaveBeenCalled();
  });

  it("un fichier qui n'est pas un PDF, ou de plus de 50 Mo, est refusé avant d'être lu", async () => {
    const { container } = afficher();
    await deposerPdf(container, new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "guide.pdf"));
    expect(await screen.findByText("Choisissez un fichier PDF.")).toBeInTheDocument();
    await deposerPdf(container, pdf("gros.pdf", 52_428_801));
    expect(await screen.findByText("Ce fichier dépasse 50 Mo.")).toBeInTheDocument();
    expect(lirePdfLocal).not.toHaveBeenCalled();
  });

  it("le nombre de pages est lu dans le PDF ; un titre vide prend le nom du fichier", async () => {
    const { container } = afficher();
    await deposerPdf(container, pdf());
    await waitFor(() => expect(screen.getByLabelText("Nombre de pages")).toHaveValue("87"));
    expect(screen.getByLabelText("Titre")).toHaveValue("Guide du stage");
    expect(screen.getByText(/87 pages · envoyé à l’enregistrement/)).toBeInTheDocument();
    expect(screen.getByText("Lu dans le PDF.")).toBeInTheDocument();
  });

  it("un PDF que pdf.js ne peut pas ouvrir (abîmé, protégé) est refusé", async () => {
    lirePdfLocal.mockRejectedValue(new Error("mot de passe"));
    const { container } = afficher();
    await deposerPdf(container, pdf());
    expect(await screen.findByText(/Ce PDF ne s’ouvre pas/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de pages")).toHaveValue("");
  });

  it("la couverture fabriquée à partir de la 1re page, puis l'envoi : le PDF (avec sa progression), la couverture, la fiche", async () => {
    const u = userEvent.setup();
    let finirEnvoi: (r: { ok: true }) => void = () => undefined;
    envoyerFichier.mockImplementationOnce(({ onProgression }: { onProgression: (p: number) => void }) => {
      onProgression(42);
      return new Promise((r) => (finirEnvoi = r));
    });
    const { container } = afficher();
    await deposerPdf(container, pdf());
    await waitFor(() => expect(screen.getByLabelText("Nombre de pages")).toHaveValue("87"));
    await u.click(screen.getByRole("button", { name: "Fabriquer à partir de la 1re page" }));
    expect(await screen.findByRole("img", { name: "Aperçu de la couverture" })).toBeInTheDocument();
    expect(couvertureDePremierePage).toHaveBeenCalledWith(document);

    await u.type(screen.getByLabelText("Auteur"), "Équipe Étudium");
    await u.click(screen.getByRole("checkbox", { name: "Réussite académique" }));
    await u.click(screen.getByRole("checkbox", { name: "J’ai le droit de diffuser ce livre" }));
    await u.click(enregistrerBouton());

    expect(await screen.findByText("Envoi… 42 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoi du PDF… 42 %" })).toBeDisabled();
    finirEnvoi({ ok: true });
    await waitFor(() => expect(enregistrerLivre).toHaveBeenCalled());

    const [envoiPdf, envoiCouverture] = envoyerFichier.mock.calls.map((c) => c[0]);
    const saisie = derniereSaisie();
    expect(saisie.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(envoiPdf).toMatchObject({ espace: "bibliotheque", type: "application/pdf" });
    expect(envoiPdf.chemin).toMatch(new RegExp(`^${saisie.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(envoiCouverture).toMatchObject({ espace: "couvertures", type: "image/jpeg", cacheSecondes: 31_536_000 });
    expect(envoiCouverture.chemin).toMatch(new RegExp(`^livres/${saisie.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(saisie).toMatchObject({
      nouveau: true,
      titre: "Guide du stage",
      auteur: "Équipe Étudium",
      langue: "fr",
      nbPages: "87",
      categorieId: null,
      parcours: [PARCOURS[0].id],
      acces: "abonnes",
      telechargeable: false,
      droitsConfirmes: true,
      fichier: { chemin: envoiPdf.chemin, tailleOctets: pdf().size },
      couverture: envoiCouverture.chemin,
    });
    await waitFor(() => expect(routeur.push).toHaveBeenCalledWith(`/admin/bibliotheque/${saisie.id}`));
  });

  it("un échec de l'envoi du PDF s'affiche sous le PDF, sans enregistrer", async () => {
    envoyerFichier.mockResolvedValue({ ok: false, message: "La connexion a été coupée pendant l’envoi. Réessayez." });
    const { container } = afficher();
    await deposerPdf(container, pdf());
    await waitFor(() => expect(screen.getByLabelText("Nombre de pages")).toHaveValue("87"));
    await userEvent.click(enregistrerBouton());
    expect(await screen.findByText("La connexion a été coupée pendant l’envoi. Réessayez.")).toBeInTheDocument();
    expect(enregistrerLivre).not.toHaveBeenCalled();
  });

  it("un refus de l'enregistrement retire les fichiers déposés et s'affiche sous son champ", async () => {
    enregistrerLivre.mockResolvedValue({ ok: false, erreurs: { annee: "Une année à quatre chiffres, par exemple 2024." } });
    const { container } = afficher();
    await deposerPdf(container, pdf());
    await waitFor(() => expect(screen.getByLabelText("Nombre de pages")).toHaveValue("87"));
    await userEvent.type(screen.getByLabelText("Année"), "20a5");
    await userEvent.click(enregistrerBouton());
    expect(await screen.findByText("Une année à quatre chiffres, par exemple 2024.")).toBeInTheDocument();
    expect(retirerDeposes).toHaveBeenCalledWith([{ espace: "bibliotheque", chemin: envoyerFichier.mock.calls[0][0].chemin }]);
    expect(routeur.push).not.toHaveBeenCalled();
  });

  it("une image de couverture : JPG, PNG ou WebP seulement", async () => {
    afficher();
    await userEvent.upload(screen.getByTestId("champ-image"), new File(["GIF89a"], "anime.gif", { type: "image/gif" }), { applyAccept: false });
    expect(await screen.findByText("Choisissez une image JPG, PNG ou WebP.")).toBeInTheDocument();
    await userEvent.upload(screen.getByTestId("champ-image"), new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg"), { applyAccept: false });
    expect(await screen.findByRole("img", { name: "Aperçu de la couverture" })).toHaveAttribute("src", "blob:apercu");
  });

  it("« Créer une catégorie » : la catégorie créée est choisie pour le livre", async () => {
    const u = userEvent.setup();
    enregistrerCategorie.mockResolvedValue({ ok: true, categorie: { id: "66666666-6666-4666-8666-666666666666", slug: "guides", nom: "Guides pratiques", ordre: 2 } });
    afficher();
    await u.click(screen.getByRole("button", { name: "Créer une catégorie" }));
    const fenetre = screen.getByRole("dialog", { name: "Créer une catégorie" });
    await u.type(within(fenetre).getByLabelText("Nom de la catégorie"), "Guides pratiques");
    await u.click(within(fenetre).getByRole("button", { name: "Créer la catégorie" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(enregistrerCategorie).toHaveBeenCalledWith({ nom: "Guides pratiques" });
    expect(screen.getByRole("combobox", { name: "Catégorie" })).toHaveTextContent("Guides pratiques");
    // La fenêtre est hors du formulaire du livre : rien n'a été enregistré.
    expect(enregistrerLivre).not.toHaveBeenCalled();
  });
});

describe("Un livre existant", () => {
  it("ses valeurs ; sans nouveau fichier, rien n'est envoyé ; une catégorie, un accès et la couverture retirée sont enregistrés", async () => {
    const u = userEvent.setup();
    afficher(LIVRE);
    expect(screen.getByLabelText("Titre")).toHaveValue("Réussir son mémoire");
    expect(screen.getByLabelText("Mots-clés")).toHaveValue("mémoire, méthodologie");
    expect(screen.getByRole("radio", { name: "Gratuit : lu par tout compte connecté" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Téléchargement autorisé" })).toBeChecked();
    expect(screen.getByText("PDF du livre")).toBeInTheDocument();
    expect(screen.getByText("Déposez un autre PDF pour le remplacer")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aperçu de la couverture" })).toBeInTheDocument();

    await choisirDansListe("Catégorie", "Aucune", { user: u });
    await u.click(screen.getByRole("radio", { name: "Inclus dans l’abonnement : lu par les abonnés" }));
    await u.click(screen.getByRole("button", { name: "Retirer" }));
    expect(screen.queryByRole("img", { name: "Aperçu de la couverture" })).toBeNull();
    await u.click(enregistrerBouton());
    await waitFor(() => expect(enregistrerLivre).toHaveBeenCalled());
    expect(envoyerFichier).not.toHaveBeenCalled();
    const saisie = derniereSaisie();
    expect(saisie).toMatchObject({ id: L, nouveau: false, categorieId: null, acces: "abonnes", telechargeable: true, couverture: null, parcours: [PARCOURS[0].id] });
    expect(saisie).not.toHaveProperty("fichier");
    expect(routeur.push).not.toHaveBeenCalled();
  });

  it("« Fabriquer à partir de la 1re page » télécharge le PDF enregistré pour le dessiner", async () => {
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    telecharger.mockResolvedValue({ data: blob, error: null });
    afficher({ ...LIVRE, couverture: null });
    await userEvent.click(screen.getByRole("button", { name: "Fabriquer à partir de la 1re page" }));
    expect(await screen.findByRole("img", { name: "Aperçu de la couverture" })).toHaveAttribute("src", "blob:apercu");
    expect(telecharger).toHaveBeenCalledWith(LIVRE.fichier);
    expect(lirePdfLocal).toHaveBeenCalledWith(blob);
  });

  it("un refus de la base pour la case des droits s'affiche sous elle", async () => {
    enregistrerLivre.mockResolvedValue({ ok: false, erreurs: { droitsConfirmes: "Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée." } });
    afficher(LIVRE);
    await userEvent.click(screen.getByRole("checkbox", { name: "J’ai le droit de diffuser ce livre" }));
    await userEvent.click(enregistrerBouton());
    expect(await screen.findByText("Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée.")).toBeInTheDocument();
  });
});
