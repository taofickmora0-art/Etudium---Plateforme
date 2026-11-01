// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { LeconAdmin } from "@/lib/admin/types";

// L'éditeur de leçon en deux colonnes (refonte des formations, étape A, spec §3.4, d'après izimentor), enregistré tout
// seul, dans un brouillon si la leçon est en ligne (fin du lot 4, spec §2).
vi.mock("@/lib/editeur/actions", () => ({
  enregistrerLecon: vi.fn(),
  reglerLecon: vi.fn(),
  enregistrerQuestions: vi.fn(),
  abandonnerModifications: vi.fn(),
  publierModifications: vi.fn(),
  lireModificationsEnAttente: vi.fn(async () => ({ migrationAbsente: false, donnees: [] })),
}));
vi.mock("@/lib/admin/actions", () => ({
  changerStatutLecon: vi.fn(),
  addRessource: vi.fn(),
  updateRessource: vi.fn(),
  deleteRessource: vi.fn(),
  deplacer: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/editeur/EditeurRiche", () => import("../editeur/editeur-riche-simule"));
// Le lecteur officiel de l'aperçu : il livre la vraie durée de la vidéo (7:42).
const creerAdaptateur = vi.fn();
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: (...a: unknown[]) => creerAdaptateur(...a) }));
const actions = await import("@/lib/admin/actions");
const editeur = await import("@/lib/editeur/actions");
const { EditeurLecon } = await import("@/components/admin/EditeurLecon");

const LECON: LeconAdmin = {
  id: "l2",
  moduleId: "m1",
  formationId: "f1",
  formationTitre: "Maîtriser Excel",
  formationSlug: "excel",
  titre: "Les formules",
  titreCourt: null,
  dureeSecondes: 760,
  apercu: false,
  resume: "",
  pointsCles: [],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "Un texte",
  document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Un texte" }] }] },
  images: {},
  ressources: [],
  publiee: false,
  commentairesActifs: true,
  type: "lecon",
  genreExercice: null,
  position: { rang: 2, total: 5, module: { rang: 1, titre: "Les bases" } },
  voisines: { precedente: "l1", suivante: "l3" },
};

const EDITION: NonNullable<LeconAdmin["edition"]> = {
  donnees: {
    titre: "Les formules",
    titreCourt: "",
    resume: "",
    pointsCles: [],
    lienVideo: "https://youtu.be/dQw4w9WgXcQ",
    duree: "12:40",
    document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Un texte" }] }] },
  },
  revision: 0,
  brouillon: false,
  enLigne: false,
  modifiePar: null,
  modifieLe: null,
};

function afficher(lecon: LeconAdmin = LECON, base?: "/admin/formations" | "/formateur/formations") {
  return render(
    <ToastProvider>
      <EditeurLecon lecon={lecon} base={base} />
    </ToastProvider>,
  );
}
const OK = { ok: true as const, revision: 1, brouillon: false, enregistreLe: "2026-11-01T14:32:00" };
const envoye = () => vi.mocked(editeur.enregistrerLecon).mock.calls.at(-1)!;

describe("L'éditeur de leçon", () => {
  beforeEach(() => {
    for (const f of [...Object.values(actions), editeur.enregistrerLecon, editeur.reglerLecon, editeur.enregistrerQuestions]) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
    push.mockReset();
    localStorage.clear();
    vi.mocked(editeur.enregistrerLecon).mockResolvedValue(OK);
    vi.mocked(editeur.reglerLecon).mockResolvedValue({ ok: true });
    creerAdaptateur.mockReset();
    creerAdaptateur.mockImplementation(async (_v: unknown, _c: HTMLElement, ev: { pret(): void }) => {
      queueMicrotask(() => ev.pret());
      return { duree: async () => 462.4, detruire: vi.fn() };
    });
  });

  it("la barre du haut : retour aux leçons, position, voisines, statut, voir comme un étudiant", () => {
    afficher();
    expect(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" })).toHaveAttribute("href", "/admin/formations/f1?onglet=programme");
    expect(screen.getByText("Leçon 2 sur 5 · Module 1 : Les bases")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leçon précédente" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l1");
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", "/admin/formations/f1/lecons/l3");
    expect(screen.getByRole("button", { name: "Statut : Brouillon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir comme un étudiant" })).toHaveAttribute("href", "/formations/excel/lecons/l2");
  });

  it("les réglages : la vidéo reconnue et son aperçu, la durée en minutes et secondes, les deux cases ; le titre et le texte", async () => {
    afficher();
    const reglages = screen.getByRole("region", { name: "Réglages" });
    expect(within(reglages).getByRole("textbox", { name: "Lien de la vidéo" })).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
    expect(within(reglages).getByTitle("Vidéo : Les formules")).toBeInTheDocument();
    expect(within(reglages).getByRole("spinbutton", { name: "Minutes" })).toHaveValue(12);
    expect(within(reglages).getByRole("spinbutton", { name: "Secondes" })).toHaveValue(40);
    expect(within(reglages).getByRole("checkbox", { name: "Activer les commentaires" })).toBeChecked();
    expect(within(reglages).getByRole("checkbox", { name: "Leçon d’aperçu gratuite" })).not.toBeChecked();
    expect(within(reglages).getByRole("heading", { name: "Documents & fichiers" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Les formules");
    // L'éditeur mis en forme se charge à part.
    expect(await screen.findByRole("textbox", { name: "Texte de la leçon" })).toHaveValue("Un texte");
  });

  it("plus de bouton Enregistrer : modifier le contenu l'enregistre seul, avec la révision ; l'indicateur le dit", async () => {
    const user = userEvent.setup();
    afficher({ ...LECON, edition: { ...EDITION, revision: 7 } });
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    expect(screen.getByText("Enregistré")).toHaveAttribute("role", "status");
    await user.clear(screen.getByRole("textbox", { name: "Titre de la leçon" }));
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), "Les formules essentielles");
    await user.clear(screen.getByRole("spinbutton", { name: "Minutes" }));
    await user.type(screen.getByRole("spinbutton", { name: "Minutes" }), "3");
    await user.clear(screen.getByRole("spinbutton", { name: "Secondes" }));
    await user.type(screen.getByRole("spinbutton", { name: "Secondes" }), "5");
    await user.type(await screen.findByRole("textbox", { name: "Texte de la leçon" }), " !");
    await user.click(screen.getByRole("button", { name: "Dans cette leçon" }));
    await user.type(screen.getByRole("textbox", { name: "Résumé" }), "Les bases du calcul.");
    await waitFor(
      () =>
        expect(envoye()[1]).toMatchObject({
          titre: "Les formules essentielles",
          duree: "3:05",
          lienVideo: "https://youtu.be/dQw4w9WgXcQ",
          resume: "Les bases du calcul.",
          document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Un texte !" }] }] },
        }),
      { timeout: 3000 },
    );
    // La première sauvegarde part avec la révision lue à l'ouverture ; les suivantes, avec celle rendue par la base.
    const appels = vi.mocked(editeur.enregistrerLecon).mock.calls;
    expect(appels[0][0]).toBe("l2");
    expect(appels[0][2]).toBe(7);
    expect(appels.slice(1).every((c) => c[2] === 1)).toBe(true);
    expect(await screen.findByText("Enregistré à 14 h 32")).toBeInTheDocument();
  });

  it("relecture (2) : un rafraîchissement après une sauvegarde ne recharge pas l'éditeur ; une révision plus récente de la base, si", async () => {
    const user = userEvent.setup();
    vi.mocked(editeur.enregistrerLecon).mockResolvedValue({ ...OK, revision: 8 });
    const lecon = { ...LECON, edition: { ...EDITION, revision: 7 } };
    const vue = afficher(lecon);
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " !");
    await waitFor(() => expect(editeur.enregistrerLecon).toHaveBeenCalled(), { timeout: 3000 });
    expect(await screen.findByText("Enregistré à 14 h 32")).toBeInTheDocument();
    // Une autre action rafraîchit la page : la base rend la révision que l'éditeur connaît déjà.
    vue.rerender(
      <ToastProvider>
        <EditeurLecon lecon={{ ...lecon, edition: { ...EDITION, revision: 8 } }} />
      </ToastProvider>,
    );
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Les formules !");
    expect(screen.getByText("Enregistré à 14 h 32")).toBeInTheDocument();
    // Publiée ailleurs : une révision plus récente, l'éditeur repart de la base.
    vue.rerender(
      <ToastProvider>
        <EditeurLecon lecon={{ ...lecon, edition: { ...EDITION, revision: 10, donnees: { ...EDITION.donnees, titre: "Titre publié" } } }} />
      </ToastProvider>,
    );
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Titre publié");
  });

  it("leçon ancienne ouverte sans modification : aucune sauvegarde (Review Focus 5)", async () => {
    afficher();
    await screen.findByRole("textbox", { name: "Texte de la leçon" });
    await new Promise((r) => setTimeout(r, 1800));
    expect(editeur.enregistrerLecon).not.toHaveBeenCalled();
  });

  it("leçon en ligne : « Brouillon enregistré », le bandeau Publier / Abandonner", async () => {
    const user = userEvent.setup();
    vi.mocked(editeur.enregistrerLecon).mockResolvedValue({ ...OK, brouillon: true });
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " !");
    expect(await screen.findByText("Brouillon enregistré à 14 h 32", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Modifications non publiées.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publier les modifications" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(screen.getByRole("dialog", { name: "Abandonner les modifications de cette leçon ?" })).toBeInTheDocument();
  });

  it("un brouillon déjà là s'ouvre avec le bandeau", () => {
    afficher({ ...LECON, edition: { ...EDITION, brouillon: true, enLigne: true, donnees: { ...EDITION.donnees, titre: "Titre du brouillon" } } });
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Titre du brouillon");
    expect(screen.getByText("Modifications non publiées.")).toBeInTheDocument();
  });

  it("conflit : le bandeau et « Recharger »", async () => {
    const user = userEvent.setup();
    vi.mocked(editeur.enregistrerLecon).mockResolvedValue({ ok: false, code: "conflit", par: "Aïcha Kpadé" });
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " !");
    expect(await screen.findByText("Cette leçon vient d’être modifiée par Aïcha Kpadé.", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
  });

  it("les réglages s'enregistrent aussitôt, sans brouillon ; un refus les remet", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("checkbox", { name: "Leçon d’aperçu gratuite" }));
    expect(editeur.reglerLecon).toHaveBeenCalledWith("l2", { commentairesActifs: true, apercu: true });
    vi.mocked(editeur.reglerLecon).mockResolvedValue({ ok: false, message: "Refusé." });
    await user.click(screen.getByRole("checkbox", { name: "Activer les commentaires" }));
    expect(await screen.findByText("Refusé.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Activer les commentaires" })).toBeChecked();
    expect(editeur.enregistrerLecon).not.toHaveBeenCalled();
  });

  it("une copie de l'appareil non enregistrée se propose ; Récupérer la remet", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "etudium-editeur:lecon:l2",
      JSON.stringify({ revision: 0, le: "2026-11-01T14:00:00Z", valeur: { ...EDITION.donnees, titre: "Titre perdu" } }),
    );
    afficher();
    expect(await screen.findByText("Des modifications de cet appareil n’ont pas été enregistrées.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Récupérer" }));
    expect(screen.getByRole("textbox", { name: "Titre de la leçon" })).toHaveValue("Titre perdu");
  });

  it("le statut change aussitôt, sans enregistrer", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.changerStatutLecon).mockResolvedValue({ ok: true });
    afficher();
    await user.click(screen.getByRole("button", { name: "Statut : Brouillon" }));
    await user.click(screen.getByRole("menuitem", { name: "Publier" }));
    expect(actions.changerStatutLecon).toHaveBeenCalledWith("l2", true);
    expect(await screen.findByRole("button", { name: "Statut : Publiée" })).toBeInTheDocument();
    expect(editeur.enregistrerLecon).not.toHaveBeenCalled();
  });

  it("quelque chose à enregistrer : le navigateur retient l'onglet ; les liens ne demandent plus rien", async () => {
    const user = userEvent.setup();
    vi.mocked(editeur.enregistrerLecon).mockReturnValue(new Promise(() => {}));
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " (modifiée)");
    const quitter = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(quitter);
    expect(quitter.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("une durée qui n'est pas en nombres entiers : le message, et la base refuse la saisie", async () => {
    const user = userEvent.setup();
    afficher();
    await user.clear(screen.getByRole("spinbutton", { name: "Minutes" }));
    await user.type(screen.getByRole("spinbutton", { name: "Minutes" }), "12.40");
    expect(await screen.findByText("Minutes et secondes : des nombres entiers (secondes de 0 à 59).")).toBeInTheDocument();
    await waitFor(() => expect(editeur.enregistrerLecon).toHaveBeenCalled(), { timeout: 3000 });
    expect(envoye()[1].duree).toBe("invalide");
  });

  it("une erreur dans « Dans cette leçon » déplie la section", async () => {
    const user = userEvent.setup();
    vi.mocked(editeur.enregistrerLecon).mockResolvedValue({ ok: false, code: "invalide", erreurs: { points_cles: "20 lignes au maximum." } });
    afficher();
    expect(screen.getByRole("button", { name: "Dans cette leçon" })).toHaveAttribute("aria-expanded", "false");
    await user.type(screen.getByRole("textbox", { name: "Titre de la leçon" }), " !");
    expect(await screen.findByText("20 lignes au maximum.", undefined, { timeout: 3000 })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dans cette leçon" })).toHaveAttribute("aria-expanded", "true");
  });

  it("la durée saisie (12:40) ne correspond pas à la vidéo (7:42) : l'éditeur le dit et propose de la reprendre", async () => {
    const user = userEvent.setup();
    afficher();
    expect(await screen.findByText("La vidéo dure 7:42 ; la durée saisie est 12:40.")).toBeInTheDocument();
    expect(screen.getByText("Plus longue que la vidéo, elle empêche l’étudiant d’atteindre le seuil de validation.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Utiliser 7:42" }));
    expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveValue(7);
    expect(screen.getByRole("spinbutton", { name: "Secondes" })).toHaveValue(42);
    expect(screen.queryByText(/La vidéo dure/)).toBeNull();
    await waitFor(() => expect(editeur.enregistrerLecon).toHaveBeenCalled(), { timeout: 3000 });
    expect(envoye()[1].duree).toBe("7:42");
  });

  it("retoucher le lien de la même vidéo (?t=5) ne relance rien et garde l'avertissement (revue)", async () => {
    const user = userEvent.setup();
    afficher();
    expect(await screen.findByText("La vidéo dure 7:42 ; la durée saisie est 12:40.")).toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "Lien de la vidéo" }));
    await user.keyboard("{End}?t=5");
    expect(screen.getByText("La vidéo dure 7:42 ; la durée saisie est 12:40.")).toBeInTheDocument();
    expect(screen.queryByText("Lecture de la durée de la vidéo…")).toBeNull();
    expect(creerAdaptateur).toHaveBeenCalledTimes(1);
  });

  it("la durée n'a pas pu être lue : l'éditeur demande de la saisir à la main", async () => {
    creerAdaptateur.mockRejectedValue(new Error("lecteur muet"));
    afficher({ ...LECON, dureeSecondes: 0 });
    expect(await screen.findByText("Durée non lue sur la vidéo : saisissez-la à la main.")).toBeInTheDocument();
  });

  it("une leçon vidéo sans durée : celle de la vidéo est reprise toute seule", async () => {
    afficher({ ...LECON, dureeSecondes: 0 });
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveValue(7));
    expect(screen.getByRole("spinbutton", { name: "Secondes" })).toHaveValue(42);
    expect(screen.getByText("Durée lue sur la vidéo.")).toBeInTheDocument();
  });

  it("coller un nouveau lien : la durée exacte de la vidéo remplace celle saisie (10 minutes tapées pour une vidéo de 2)", async () => {
    const user = userEvent.setup();
    afficher({ ...LECON, video: null, dureeSecondes: 600 });
    creerAdaptateur.mockImplementation(async (_v: unknown, _c: HTMLElement, ev: { pret(): void }) => {
      queueMicrotask(() => ev.pret());
      return { duree: async () => 128.6, detruire: vi.fn(), setMuet: vi.fn(), lire: vi.fn() };
    });
    const champ = screen.getByRole("textbox", { name: "Lien de la vidéo" });
    await user.click(champ);
    await user.paste("https://www.youtube.com/watch?v=abcdefghijk");
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveValue(2));
    // Arrondie vers le bas : une durée de leçon plus longue que la vidéo rendrait le seuil de 100 % impossible.
    expect(screen.getByRole("spinbutton", { name: "Secondes" })).toHaveValue(8);
    expect(screen.queryByText(/La vidéo dure/)).toBeNull();
    expect(screen.getByText("Durée lue sur la vidéo.")).toBeInTheDocument();
  });

  it("un lien Google Drive : reconnu, sans lecture de la durée ; la leçon se terminera d'un clic ; le rappel du partage", async () => {
    const user = userEvent.setup();
    afficher({ ...LECON, video: null, dureeSecondes: 0 });
    await user.click(screen.getByRole("textbox", { name: "Lien de la vidéo" }));
    await user.paste("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing");
    expect(screen.getByText("Reconnu : Google Drive · 1AbCdEfGhIjKlMnOpQrStUvWxYz012345")).toBeInTheDocument();
    expect(screen.getByTitle("Vidéo : Les formules")).toHaveAttribute("src", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    expect(screen.getByText("Cette plateforme ne permet pas de mesurer le temps regardé : la leçon se terminera d’un clic sur « Terminer la leçon ».")).toBeInTheDocument();
    expect(screen.getByText("Partagez la vidéo avec « Tous les utilisateurs disposant du lien », et dans les réglages du partage (roue dentée), décochez l’option qui permet aux lecteurs de télécharger, imprimer et copier. Drive peut bloquer une vidéo très regardée, jusqu’à 24 h.")).toBeInTheDocument();
    expect(screen.getByText("Facultative : elle s’affiche aux étudiants.")).toBeInTheDocument();
    expect(creerAdaptateur).not.toHaveBeenCalled();
  });

  it("un lien court TikTok : on demande le lien complet ; un lien TikTok complet : la durée est lue comme pour YouTube", async () => {
    const user = userEvent.setup();
    afficher({ ...LECON, video: null, dureeSecondes: 0 });
    const champ = screen.getByRole("textbox", { name: "Lien de la vidéo" });
    await user.click(champ);
    await user.paste("https://vm.tiktok.com/ZMabcdEF/");
    expect(screen.getByText("Lien court TikTok : ouvrez-le, puis copiez le lien complet de la vidéo (…/video/123…).")).toBeInTheDocument();
    await user.clear(champ);
    await user.paste("https://www.tiktok.com/@etudium/video/7234567890123456789");
    expect(screen.getByText("Reconnu : TikTok · 7234567890123456789")).toBeInTheDocument();
    await waitFor(() => expect(creerAdaptateur).toHaveBeenCalledWith({ fournisseur: "tiktok", id: "7234567890123456789" }, expect.anything(), expect.anything()));
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Minutes" })).toHaveValue(7));
  });

  it("pendant la lecture de la durée, l'éditeur le dit ; si le lecteur ne répond pas, la saisie reste à la main", async () => {
    let livrer: (d: number) => void = () => undefined;
    creerAdaptateur.mockImplementation(async (_v: unknown, _c: HTMLElement, ev: { pret(): void }) => {
      queueMicrotask(() => ev.pret());
      return { duree: () => new Promise<number>((r) => (livrer = r)), detruire: vi.fn() };
    });
    afficher();
    expect(await screen.findByText("Lecture de la durée de la vidéo…")).toBeInTheDocument();
    livrer(760);
    expect(await screen.findByText("Durée lue sur la vidéo.")).toBeInTheDocument();
  });

  it("le lecteur officiel ne se charge pas : l'aperçu reste, sans message sur la durée", async () => {
    creerAdaptateur.mockRejectedValue(new Error("script bloqué"));
    afficher();
    expect(await screen.findByTitle("Vidéo : Les formules")).toBeInTheDocument();
    expect(screen.queryByText(/La vidéo dure/)).toBeNull();
  });

  it("la première leçon n'a pas de précédente ; espace formateur : ses adresses", () => {
    afficher({ ...LECON, voisines: { precedente: null, suivante: null }, position: { rang: 1, total: 1, module: { rang: 1, titre: "Les bases" } } }, "/formateur/formations");
    expect(screen.queryByRole("link", { name: "Leçon précédente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Retour aux leçons (Maîtriser Excel)" })).toHaveAttribute("href", "/formateur/formations/f1?onglet=programme");
  });
});
