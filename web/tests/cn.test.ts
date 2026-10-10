import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("garde la couleur et la taille du texte, qui ne sont pas en conflit", () => {
    expect(cn("text-sm", "text-discret")).toBe("text-sm text-discret");
  });

  it("garde la dernière couleur en cas de conflit", () => {
    expect(cn("text-discret", "text-bleu")).toBe("text-bleu");
  });

  it("garde le dernier arrondi du design", () => {
    expect(cn("rounded-champ", "rounded-bouton")).toBe("rounded-bouton");
  });
});
