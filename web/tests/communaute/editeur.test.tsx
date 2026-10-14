// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Editor, type JSONContent } from "@tiptap/react";
import { EditeurTexte } from "@/components/communaute/EditeurTexte";
import { extensionsEditeur } from "@/lib/communaute/editeur-schema";
import { versDocument, versMarkdown } from "@/lib/communaute/mise-en-forme";

// L'éditeur visuel (spec mise en forme et vidéo, §1). jsdom ne sait pas simuler la sélection d'un champ éditable : on
// sélectionne tout au clavier (Ctrl+A, géré par l'éditeur lui-même), puis on applique la mise en forme par la barre.

beforeAll(() => {
  const rect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

function Essai({ initial, surChangement }: { initial: string; surChangement: (t: string) => void }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <>
      <EditeurTexte
        valeur={valeur}
        etiquette="Nouvelle publication"
        placeholder="Partagez une question…"
        onChange={(t) => {
          setValeur(t);
          surChangement(t);
        }}
      />
      <button type="button" onClick={() => setValeur("")}>
        Vider
      </button>
    </>
  );
}

const editeur = () => screen.findByRole("textbox", { name: "Nouvelle publication" });

describe("L'éditeur", () => {
  it("la barre : titres 1 à 3, gras, italique, souligné, barré, listes, citation", async () => {
    render(<Essai initial="" surChangement={vi.fn()} />);
    await editeur();
    const barre = screen.getByRole("toolbar", { name: "Mise en forme" });
    expect([...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Titre 1",
      "Titre 2",
      "Titre 3",
      "Gras",
      "Italique",
      "Souligné",
      "Barré",
      "Liste à puces",
      "Liste numérotée",
      "Citation",
      "Lien",
      "Emoji",
    ]);
  });

  it("tout sélectionner puis Gras : le texte enregistré est en gras, le bouton est actif ; Titre 1 en fait un titre", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial="Bonjour" surChangement={surChangement} />);
    const champ = await editeur();
    expect(champ).toHaveTextContent("Bonjour");
    await user.click(champ);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Gras" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith("**Bonjour**"));
    expect(screen.getByRole("button", { name: "Gras" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Titre 1" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith("# **Bonjour**"));
  });

  it("vidé de l'extérieur (après Publier) : l'éditeur se vide", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Essai initial="Bonjour" surChangement={vi.fn()} />);
    const champ = await editeur();
    await user.click(screen.getByRole("button", { name: "Vider" }));
    await waitFor(() => expect(champ).not.toHaveTextContent("Bonjour"));
  });

  it("le schéma ne crée que ce que le format range : pas de sous-liste, pas de saut dans un titre, la citation garde des paragraphes (revue finale)", () => {
    // Ce que montre l'éditeur doit être ce qui est enregistré : le document relu depuis le texte est le même.
    const fidele = (e: Editor) => {
      const sansVide = (d: JSONContent) => ({ ...d, content: (d.content ?? []).filter((b) => b.content?.length || b.type !== "paragraph") });
      expect(sansVide(versDocument(versMarkdown(e.getJSON())))).toEqual(sansVide(e.getJSON()));
    };
    const e = new Editor({ extensions: extensionsEditeur(), content: versDocument("- **Lire** le sujet\n- Écrire") });
    e.commands.setTextSelection(e.state.doc.content.size - 3);
    // Tab dans une liste ne crée pas de sous-liste (l'éditeur ne traite pas la touche : elle passe au contrôle suivant).
    const tab = new KeyboardEvent("keydown", { key: "Tab" });
    expect(e.view.someProp("handleKeyDown", (f) => f(e.view, tab)) ?? false).toBe(false);
    expect(versMarkdown(e.getJSON())).toBe("- **Lire** le sujet\n- Écrire");

    // Un saut dans un titre (Maj+Entrée) : jamais de saut à l'intérieur du titre ; le résultat reste fidèle.
    e.commands.setContent(versDocument("## Titre"));
    e.commands.setTextSelection(3);
    const avant = e.getJSON();
    expect(e.view.someProp("handleKeyDown", (f) => f(e.view, new KeyboardEvent("keydown", { key: "Enter", shiftKey: true })))).toBe(true);
    expect(e.getJSON()).toEqual(avant);

    e.commands.setContent(versDocument("> **Important** : relire"));
    e.commands.setTextSelection(4);
    e.commands.toggleBulletList();
    fidele(e);
    e.commands.setContent(versDocument("> **Important** : relire"));
    e.commands.setTextSelection(4);
    e.commands.toggleHeading({ level: 2 });
    fidele(e);
    e.destroy();
  });

  it("Lien : sur le texte sélectionné, l'adresse saisie le rend cliquable ; une adresse qui n'est pas http(s) est refusée", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial="Bonjour" surChangement={surChangement} />);
    const champ = await editeur();
    await user.click(champ);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Lien" }));
    const adresse = await screen.findByRole("textbox", { name: "Adresse du lien" });
    await user.type(adresse, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Valider le lien" }));
    expect(screen.getByText("Collez une adresse complète (https://…).")).toBeInTheDocument();
    await user.clear(adresse);
    await user.type(adresse, "https://exemple.com/page");
    await user.click(screen.getByRole("button", { name: "Valider le lien" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith("[Bonjour](https://exemple.com/page)"));
  });

  it("Emoji : la grille nommée en français ; un clic insère l'emoji", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial="Bravo" surChangement={surChangement} />);
    const champ = await editeur();
    await user.click(champ);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Emoji" }));
    const grille = await screen.findByRole("group", { name: "Emojis" });
    expect(within(grille).getAllByRole("button").length).toBeGreaterThanOrEqual(40);
    await user.click(within(grille).getByRole("button", { name: "Applaudissements" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith(expect.stringContaining("👏")));
  });

  it("le schéma refuse un lien qui n'est pas http(s)", () => {
    const e = new Editor({ extensions: extensionsEditeur(), content: versDocument("Bonjour") });
    e.commands.selectAll();
    e.commands.setLink({ href: "javascript:alert(1)" });
    expect(versMarkdown(e.getJSON())).toBe("Bonjour");
    e.commands.setLink({ href: "https://exemple.com" });
    expect(versMarkdown(e.getJSON())).toBe("[Bonjour](https://exemple.com)");
    e.destroy();
  });
});

describe("Le collage", () => {
  it("une adresse collée reste du texte : seul le bouton Lien crée un lien (revue de l'étape 1)", () => {
    // jsdom n'a ni ClipboardEvent ni DataTransfer, dont les règles de collage de Tiptap ont besoin.
    if (typeof globalThis.DataTransfer === "undefined") {
      globalThis.DataTransfer = class {
        private donnees = new Map<string, string>();
        setData(type: string, valeur: string) {
          this.donnees.set(type, valeur);
        }
        getData(type: string) {
          return this.donnees.get(type) ?? "";
        }
      } as unknown as typeof DataTransfer;
    }
    if (typeof globalThis.ClipboardEvent === "undefined") {
      globalThis.ClipboardEvent = class extends Event {
        clipboardData: DataTransfer | null;
        constructor(type: string, init?: ClipboardEventInit) {
          super(type, init);
          this.clipboardData = init?.clipboardData ?? null;
        }
      } as unknown as typeof ClipboardEvent;
    }
    const editor = new Editor({ extensions: extensionsEditeur() });
    editor.commands.insertContent("Voir https://exemple.com/page. ok", { applyPasteRules: true });
    expect(versMarkdown(editor.getJSON())).toBe("Voir https://exemple.com/page. ok");
    editor.destroy();
  });
});

describe("Les liens dans l'éditeur", () => {
  it("un lien se voit comme sur la carte : bleu et souligné (revue de l'étape 1)", async () => {
    render(<Essai initial="Voir [le programme](https://exemple.com)" surChangement={vi.fn()} />);
    const champ = await editeur();
    const lien = await within(champ).findByText("le programme");
    expect(lien.closest("a")).toHaveAttribute("href", "https://exemple.com");
    expect(champ.className).toContain("[&_a]:text-bleu");
    expect(champ.className).toContain("[&_a]:underline");
  });
});
