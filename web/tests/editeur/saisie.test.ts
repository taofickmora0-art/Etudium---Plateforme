import { describe, expect, it } from "vitest";
import { normaliserSaisieLecon, versSaisieLecon } from "@/lib/editeur/saisie";
import type { SaisieLecon } from "@/lib/editeur/types";

// La saisie d'une leçon avant l'enregistrement automatique (fin du lot 4) : les règles de l'enregistrement au clic
// (vidéo par son fournisseur et son identifiant, durée en minutes et secondes, durée exigée quand le temps regardé se
// mesure), reprises de ses tests.

const doc = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Texte" }] }] };
const SAISIE: SaisieLecon = {
  titre: "Les tableaux croisés dynamiques",
  titreCourt: "Tableaux croisés dynamiques",
  resume: "Résumé",
  pointsCles: ["Créer", "", " Modifier "],
  lienVideo: "https://youtu.be/dQw4w9WgXcQ?si=x",
  duree: "12:40",
  document: doc,
};
const erreurs = (s: Partial<SaisieLecon>) => {
  const r = normaliserSaisieLecon({ ...SAISIE, ...s });
  return r.ok ? {} : r.erreurs;
};
const donnees = (s: Partial<SaisieLecon>) => {
  const r = normaliserSaisieLecon({ ...SAISIE, ...s });
  if (!r.ok) throw new Error(JSON.stringify(r.erreurs));
  return r.donnees;
};

describe("Vérifier la saisie d'une leçon", () => {
  it("un lien YouTube : son identifiant, la durée en secondes, les points clés sans ligne vide", () => {
    expect(donnees({})).toEqual({
      titre: "Les tableaux croisés dynamiques",
      titre_court: "Tableaux croisés dynamiques",
      resume: "Résumé",
      points_cles: ["Créer", "Modifier"],
      video_fournisseur: "youtube",
      video_id: "dQw4w9WgXcQ",
      duree_secondes: 760,
      document: doc,
      texte: "Texte",
    });
  });

  it("un lien inconnu est refusé sur son champ", () => {
    expect(erreurs({ lienVideo: "https://exemple.com/video.mp4" }).video).toBe("Ce lien n’est pas une vidéo YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal ou Google Drive.");
  });

  it("effacer le lien retire la vidéo ; un titre court vide devient nul", () => {
    expect(donnees({ lienVideo: "  ", titreCourt: "" })).toMatchObject({ video_fournisseur: null, video_id: null, titre_court: null });
  });

  it("la durée se saisit en minutes et secondes ; elle est exigée quand le temps regardé se mesure", () => {
    expect(erreurs({ duree: "12:75" }).duree).toBe("Durée au format 12:40.");
    expect(erreurs({ duree: "0:00" }).duree).toBe("Saisissez la durée de la vidéo : elle sert à mesurer le temps regardé.");
    expect(erreurs({ lienVideo: "", duree: "0:00" }).duree).toBeUndefined();
  });

  it("les autres plateformes : la durée est facultative sans mesure (Drive), exigée pour TikTok ; un lien court refusé", () => {
    const DRIVE = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    expect(donnees({ lienVideo: `https://drive.google.com/file/d/${DRIVE}/view?usp=sharing`, duree: "0:00" })).toMatchObject({ video_fournisseur: "drive", video_id: DRIVE });
    expect(erreurs({ lienVideo: "https://www.tiktok.com/@etudium/video/7234567890123456789", duree: "0:00" }).duree).toBe(
      "Saisissez la durée de la vidéo : elle sert à mesurer le temps regardé.",
    );
    expect(erreurs({ lienVideo: "https://vm.tiktok.com/ZMabcdEF/" }).video).toBe("Lien court TikTok : ouvrez-le, puis copiez le lien complet de la vidéo (…/video/123…).");
  });

  it("un lien Vimeo non répertorié garde son code", () => {
    expect(donnees({ lienVideo: "https://vimeo.com/76979871/abcdef0123" })).toMatchObject({ video_fournisseur: "vimeo", video_id: "76979871/abcdef0123" });
  });

  it("titre obligatoire ; 20 points clés au plus", () => {
    expect(erreurs({ titre: "  " }).titre).toBe("Entrez le titre de la leçon.");
    expect(erreurs({ pointsCles: Array.from({ length: 21 }, (_, i) => `Point ${i}`) }).points_cles).toBe("20 lignes au maximum.");
  });

  it("l'aller-retour : les données lues en base reviennent à l'éditeur", () => {
    expect(versSaisieLecon(donnees({}))).toEqual({ ...SAISIE, pointsCles: ["Créer", "Modifier"], lienVideo: "https://youtu.be/dQw4w9WgXcQ" });
    // Une leçon ancienne (texte, sans document) : convertie.
    expect(versSaisieLecon({ titre: "T", texte: "**Gras**", document: null, duree_secondes: 75 })).toMatchObject({
      duree: "1:15",
      lienVideo: "",
      document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Gras", marks: [{ type: "bold" }] }] }] },
    });
  });
});
