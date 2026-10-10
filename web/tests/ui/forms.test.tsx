// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { CodeInput } from "@/components/ui/CodeInput";
import { Field } from "@/components/ui/Field";
import { FileRow } from "@/components/ui/FileRow";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";

/** CodeInput est contrôlé : ce petit parent garde la valeur, comme le fera l'écran de vérification. */
function CodeHarness({ initial = "", onChange = () => {}, onComplete }: { initial?: string; onChange?: (c: string) => void; onComplete?: (c: string) => void }) {
  const [code, setCode] = useState(initial);
  return (
    <CodeInput
      label="Code reçu par e-mail"
      value={code}
      onChange={(c) => {
        setCode(c);
        onChange(c);
      }}
      onComplete={onComplete}
    />
  );
}

const FORMULES = [
  { value: "basique", title: "Basique", subtitle: "1 parcours au choix", price: "[PRIX] FCFA" },
  { value: "standard", title: "Standard", subtitle: "2 parcours au choix", price: "[PRIX] FCFA" },
  { value: "premium", title: "Premium", subtitle: "Tous les parcours", price: "[PRIX] FCFA" },
];

describe("Formulaires", () => {
  it("Field relie l'erreur au champ", () => {
    render(
      <Field label="Numéro Mobile Money" htmlFor="momo" error="Entrez un numéro à 10 chiffres.">
        <TextInput id="momo" defaultValue="01 97 00" />
      </Field>,
    );
    const input = screen.getByLabelText("Numéro Mobile Money");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Entrez un numéro à 10 chiffres\./);
  });

  it("PasswordInput affiche puis masque", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Mot de passe" htmlFor="mdp">
        <PasswordInput id="mdp" defaultValue="motdepasse" />
      </Field>,
    );
    const input = screen.getByLabelText("Mot de passe");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Masquer le mot de passe" })).toBeInTheDocument();
  });

  it("CodeInput accepte un code collé avec espace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<CodeHarness onChange={onChange} onComplete={onComplete} />);
    await user.click(screen.getByLabelText("Chiffre 1"));
    await user.paste("482 913");
    expect(onChange).toHaveBeenLastCalledWith("482913");
    expect(onComplete).toHaveBeenCalledWith("482913");
  });

  it("CodeInput ignore les lettres", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CodeHarness onChange={onChange} />);
    await user.type(screen.getByLabelText("Chiffre 1"), "4a8");
    expect(onChange).toHaveBeenLastCalledWith("48");
  });

  it("CodeInput recule avec Retour arrière", async () => {
    const user = userEvent.setup();
    render(<CodeHarness initial="48" />);
    await user.click(screen.getByLabelText("Chiffre 3"));
    await user.keyboard("{Backspace}");
    expect(screen.getByLabelText("Chiffre 2")).toHaveFocus();
  });

  it("CodeInput répartit un code inséré d'un coup par le téléphone", () => {
    const onChange = vi.fn();
    render(<CodeHarness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Chiffre 1"), { target: { value: "482913" } });
    expect(onChange).toHaveBeenLastCalledWith("482913");
  });

  it("CodeInput efface une case vidée sans touche Retour arrière", () => {
    const onChange = vi.fn();
    render(<CodeHarness initial="482" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Chiffre 3"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("48");
  });

  it("Switch bascule", async () => {
    const user = userEvent.setup();
    render(<Switch label="Rappels de session live" />);
    const toggle = screen.getByRole("switch", { name: "Rappels de session live" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("ChoiceCards sélectionne une formule", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("standard");
      return (
        <ChoiceCards
          label="Formule"
          options={FORMULES}
          value={value}
          onValueChange={(v) => {
            setValue(v);
            onValueChange(v);
          }}
        />
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Premium/ }));
    expect(onValueChange).toHaveBeenCalledWith("premium");
    expect(screen.getByRole("radio", { name: /Premium/ })).toHaveAttribute("aria-checked", "true");
  });

  it("FileRow affiche la progression d'envoi", () => {
    render(<FileRow name="Memoire_chapitre2.docx" meta="" progress={62} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
  });
});

describe("Formulaires rendus côté serveur", () => {
  it("RadioGroup sans écouteur ne crée pas de gestionnaire d'événement", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RadioGroup } = await import("@/components/ui/RadioGroup");
    const element = RadioGroup({
      label: "Opérateur",
      name: "op",
      defaultValue: "mtn",
      options: [{ value: "mtn", label: "MTN Mobile Money" }],
    });
    const inputs: { props: Record<string, unknown> }[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      const el = node as { type?: unknown; props?: Record<string, unknown> };
      if (el.type === "input") inputs.push(el as { props: Record<string, unknown> });
      walk(el.props?.children);
    };
    walk(element);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].props.onChange).toBeUndefined();
    expect(renderToStaticMarkup(element)).toContain("checked");
  });
});
