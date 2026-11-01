// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/react";
import { validerDocument, type DocumentLecon, type NoeudDoc } from "@/lib/lecon/document";
import { extensionsLecon } from "@/lib/editeur/extensions";

// L'éditeur riche des leçons (fin du lot 4, spec §1.2). jsdom ne simule pas la sélection d'un champ éditable : on
// sélectionne tout au clavier (Ctrl+A), puis on agit par la barre. L'envoi des images est simulé.

const F = "11111111-1111-4111-8111-111111111111";
const IMG = `${F}/22222222-2222-4222-8222-222222222222.webp`;

vi.mock("@/lib/editeur/envoi-image", () => ({ envoyerImage: vi.fn() }));
const { envoyerImage } = await import("@/lib/editeur/envoi-image");
const { EditeurRiche } = await import("@/components/editeur/EditeurRiche");

beforeAll(() => {
  const rect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
beforeEach(() => vi.mocked(envoyerImage).mockReset());

const p = (texte: string): NoeudDoc => ({ type: "paragraph", content: [{ type: "text", text: texte }] });
const doc = (...content: NoeudDoc[]): DocumentLecon => ({ type: "doc", content });

function Essai({ initial, surChangement }: { initial: DocumentLecon; surChangement: (d: DocumentLecon) => void }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <EditeurRiche
      formationId={F}
      valeur={valeur}
      images={{ [IMG]: "https://s/existante.webp" }}
      etiquette="Texte de la leçon"
      placeholder="Le texte de la leçon…"
      onChange={(d) => {
        setValeur(d);
        surChangement(d);
      }}
    />
  );
}
const champ = () => screen.findByRole("textbox", { name: "Texte de la leçon" });
const dernier = (f: ReturnType<typeof vi.fn>) => f.mock.calls.at(-1)?.[0] as DocumentLecon;

describe("L'éditeur riche", () => {
  it("la barre : tous les boutons nommés, et le style du paragraphe", async () => {
    render(<Essai initial={doc(p("Bonjour"))} surChangement={vi.fn()} />);
    await champ();
    const barre = screen.getByRole("toolbar", { name: "Mise en forme" });
    expect(within(barre).getByRole("combobox", { name: "Style du paragraphe" })).toHaveValue("texte");
    expect([...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Gras",
      "Italique",
      "Souligné",
      "Barré",
      "Lien",
      "Liste à puces",
      "Liste numérotée",
      "Citation",
      "Bloc d’information",
      "Image",
      "Tableau",
      "Vidéo",
      "Séparateur",
      "Annuler",
      "Rétablir",
    ]);
  });

  it("rien n'est envoyé à l'ouverture", async () => {
    const surChangement = vi.fn();
    render(<Essai initial={doc(p("Bonjour"), { type: "imageLecon", attrs: { chemin: IMG, alt: "", legende: "" } })} surChangement={surChangement} />);
    await champ();
    await new Promise((r) => setTimeout(r, 20));
    expect(surChangement).not.toHaveBeenCalled();
    // L'image existante s'affiche avec son lien signé.
    expect(document.querySelector("img")).toHaveAttribute("src", "https://s/existante.webp");
  });

  it("Ctrl+A puis Gras : la marque bold, un document valide ; Titre en fait un titre de niveau 2", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial={doc(p("Bonjour"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Gras" }));
    await waitFor(() => expect(dernier(surChangement).content[0]).toMatchObject({ content: [{ text: "Bonjour", marks: [{ type: "bold" }] }] }));
    expect(validerDocument(dernier(surChangement)).ok).toBe(true);
    await user.selectOptions(screen.getByRole("combobox", { name: "Style du paragraphe" }), "titre");
    await waitFor(() => expect(dernier(surChangement).content[0]).toMatchObject({ type: "heading", attrs: { level: 2 } }));
  });

  it("Bloc d'information : un encadré Information, puis changé en Attention, puis retiré", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial={doc(p("Retenez ceci"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.click(screen.getByRole("button", { name: "Bloc d’information" }));
    await waitFor(() => expect(dernier(surChangement).content[0]).toMatchObject({ type: "encadre", attrs: { ton: "info" }, content: [{ type: "paragraph" }] }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Ton du bloc" }), "attention");
    await waitFor(() => expect(dernier(surChangement).content[0]).toMatchObject({ type: "encadre", attrs: { ton: "attention" } }));
    expect(validerDocument(dernier(surChangement)).ok).toBe(true);
    await user.click(screen.getByRole("button", { name: "Retirer le bloc" }));
    await waitFor(() => expect(dernier(surChangement).content[0]).toMatchObject({ type: "paragraph" }));
  });

  it("Tableau : 3 × 3, première ligne en en-tête ; Ajouter une ligne en fait 4 ; Supprimer le tableau", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial={doc(p("Avant"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.click(screen.getByRole("button", { name: "Tableau" }));
    const tableau = () => dernier(surChangement).content.find((n) => n.type === "table");
    await waitFor(() => expect(tableau()?.content).toHaveLength(3));
    expect(tableau()?.content?.[0].content?.map((c) => c.type)).toEqual(["tableHeader", "tableHeader", "tableHeader"]);
    expect(tableau()?.content?.[1].content?.map((c) => c.type)).toEqual(["tableCell", "tableCell", "tableCell"]);
    expect(validerDocument(dernier(surChangement)).ok).toBe(true);
    await user.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    await waitFor(() => expect(tableau()?.content).toHaveLength(4));
    await user.click(screen.getByRole("button", { name: "Supprimer le tableau" }));
    await waitFor(() => expect(tableau()).toBeUndefined());
  });

  it("Vidéo : un lien YouTube insère la vidéo ; un lien inconnu affiche le message", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial={doc(p("Regardez"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.click(screen.getByRole("button", { name: "Vidéo" }));
    await user.type(screen.getByRole("textbox", { name: "Lien de la vidéo" }), "https://exemple.com/video");
    await user.click(screen.getByRole("button", { name: "Insérer la vidéo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ce lien n’est pas une vidéo reconnue.");
    await user.clear(screen.getByRole("textbox", { name: "Lien de la vidéo" }));
    await user.type(screen.getByRole("textbox", { name: "Lien de la vidéo" }), "https://youtu.be/dQw4w9WgXcQ");
    await user.click(screen.getByRole("button", { name: "Insérer la vidéo" }));
    await waitFor(() => expect(dernier(surChangement).content.find((n) => n.type === "videoLecon")).toEqual({ type: "videoLecon", attrs: { fournisseur: "youtube", id: "dQw4w9WgXcQ" } }));
    expect(validerDocument(dernier(surChangement)).ok).toBe(true);
  });

  it("Image : envoyée, insérée avec son chemin, affichée avec son lien ; texte alternatif et légende", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    const nouvelle = `${F}/33333333-3333-4333-8333-333333333333.png`;
    vi.mocked(envoyerImage).mockResolvedValue({ ok: true, chemin: nouvelle, url: "https://s/nouvelle.png" });
    render(<Essai initial={doc(p("Voici"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.upload(screen.getByLabelText("Choisir une image"), new File([new Uint8Array(8)], "capture.png", { type: "image/png" }));
    await waitFor(() => expect(dernier(surChangement).content.find((n) => n.type === "imageLecon")).toMatchObject({ attrs: { chemin: nouvelle } }));
    expect(envoyerImage).toHaveBeenCalledWith(F, expect.any(File));
    await waitFor(() => expect(document.querySelector("img")).toHaveAttribute("src", "https://s/nouvelle.png"));
    await user.type(screen.getByRole("textbox", { name: "Texte alternatif" }), "La fenêtre");
    await user.type(screen.getByRole("textbox", { name: "Légende" }), "Figure 1");
    await waitFor(() =>
      expect(dernier(surChangement).content.find((n) => n.type === "imageLecon")).toEqual({ type: "imageLecon", attrs: { chemin: nouvelle, alt: "La fenêtre", legende: "Figure 1" } }),
    );
    expect(validerDocument(dernier(surChangement)).ok).toBe(true);
  });

  it("Image refusée : le message, rien d'inséré", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    vi.mocked(envoyerImage).mockResolvedValue({ ok: false, message: "L’image dépasse 5 Mo." });
    render(<Essai initial={doc(p("Voici"))} surChangement={surChangement} />);
    await user.click(await champ());
    await user.upload(screen.getByLabelText("Choisir une image"), new File([new Uint8Array(8)], "grande.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("L’image dépasse 5 Mo.");
    expect(surChangement).not.toHaveBeenCalled();
  });
});

describe("Le schéma de l'éditeur", () => {
  it("chaque bloc fait l'aller-retour : le document relu par l'éditeur passe la vérification, identique", () => {
    const cellule = (type: string, t: string): NoeudDoc => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(t)] });
    const complet = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titre" }] },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Sous-titre" }] },
      { type: "paragraph", content: [{ type: "text", text: "lien", marks: [{ type: "link", attrs: { href: "https://etudium.com" } }] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [p("un")] }] },
      { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p("deux")] }] },
      { type: "blockquote", content: [p("citation")] },
      { type: "encadre", attrs: { ton: "retenir" }, content: [p("À retenir")] },
      { type: "imageLecon", attrs: { chemin: IMG, alt: "Alt", legende: "Légende" } },
      { type: "table", content: [{ type: "tableRow", content: [cellule("tableHeader", "A"), cellule("tableHeader", "B")] }, { type: "tableRow", content: [cellule("tableCell", "C"), cellule("tableCell", "D")] }] },
      { type: "videoLecon", attrs: { fournisseur: "vimeo", id: "76979871" } },
      { type: "horizontalRule" },
    );
    const e = new Editor({ extensions: extensionsLecon(""), content: complet });
    const r = validerDocument(e.getJSON());
    expect(r).toEqual({ ok: true, document: complet });
    e.destroy();
  });

  it("un collage depuis une page (image, couleur, bloc de code) ne garde que ce que le format accepte", () => {
    const e = new Editor({ extensions: extensionsLecon(""), content: "<p style='color:red'>Texte <span style='font-family:Comic'>coloré</span></p><img src='data:image/png;base64,AAAA'><pre><code>x = 1</code></pre>" });
    const r = validerDocument(e.getJSON());
    expect(r.ok).toBe(true);
    expect(JSON.stringify(e.getJSON())).not.toMatch(/data:image|style|font-family|codeBlock|textStyle/);
    e.destroy();
  });
});
