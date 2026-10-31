import { describe, expect, it } from "vitest";
import { dureeLecon, etatLigne, metaRessource, situation, tempsRestant, urlIntegration, verrou, voisines } from "@/lib/lecon/regles";
import { EXCEL, EXCEL_OUVERTE, id, ZOTERO } from "./donnees";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("Règles de la page leçon", () => {
  it("les leçons voisines suivent le programme, d'un module à l'autre (toutes ouvertes)", () => {
    expect(voisines(EXCEL_OUVERTE.modules, id(1))).toMatchObject({ precedente: null, suivante: { id: id(2) } });
    expect(voisines(EXCEL_OUVERTE.modules, id(4))).toMatchObject({ precedente: { id: id(3) }, suivante: { id: id(5) } });
    expect(voisines(EXCEL_OUVERTE.modules, id(12))).toMatchObject({ precedente: { id: id(11) }, suivante: null });
    expect(voisines(EXCEL_OUVERTE.modules, id(99))).toEqual({ precedente: null, suivante: null });
    // Les leçons fermées sont sautées (tâche 12) : depuis la 4e, fermée, la précédente ouverte est le 2e aperçu.
    expect(voisines(EXCEL.modules, id(4))).toMatchObject({ precedente: { id: id(2) }, suivante: null });
  });

  it("la leçon se situe dans son module : « Leçon 2 sur 4 »", () => {
    expect(situation(EXCEL.modules, id(2))).toEqual({ numero: 1, titreModule: "Bases d’Excel", rang: 2, total: 4 });
    expect(situation(EXCEL.modules, id(9))).toEqual({ numero: 3, titreModule: "Analyse de données", rang: 2, total: 3 });
    expect(situation(EXCEL.modules, id(99))).toBeNull();
  });

  it("l'adresse du lecteur officiel : YouTube sans cookies, Vimeo sans suivi (avec le code d'une vidéo non répertoriée)", () => {
    expect(urlIntegration({ fournisseur: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(urlIntegration({ fournisseur: "vimeo", id: "76979871" })).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(urlIntegration({ fournisseur: "vimeo", id: "76979871/abcdef0123" })).toBe("https://player.vimeo.com/video/76979871?dnt=1&h=abcdef0123");
  });

  it("la durée d'une leçon s'écrit comme dans le design", () => {
    expect(dureeLecon(760)).toBe("12 min 40");
    expect(dureeLecon(720)).toBe("12 min");
    expect(dureeLecon(45)).toBe("45 s");
    expect(dureeLecon(3600)).toBe("1 h");
    expect(dureeLecon(3723)).toBe("1 h 02 min");
    expect(dureeLecon(0)).toBe("");
  });

  it("l'état d'une ligne du programme : courante, verrouillée, terminée ou à venir", () => {
    const terminees = new Set([id(2)]);
    const [l1, l2, l3] = EXCEL.modules[0].lecons;
    expect(etatLigne(l1, id(1), terminees)).toBe("courante");
    expect(etatLigne(l3, id(3), terminees)).toBe("courante");
    expect(etatLigne(l3, id(1), terminees)).toBe("verrouillee");
    expect(etatLigne(l2, id(1), terminees)).toBe("terminee");
    expect(etatLigne(l2, id(1), new Set())).toBe("a-venir");
  });

  it("le temps restant additionne les leçons non terminées", () => {
    expect(tempsRestant(EXCEL.modules, new Set())).toBe(8407);
    expect(tempsRestant(EXCEL.modules, new Set([id(1), id(2)]))).toBe(8407 - 370 - 750);
  });

  it("la ligne d'une ressource dit son format, sa taille et son mode d'accès", () => {
    expect(metaRessource({ id: "r", titre: "Données", format: XLSX, tailleOctets: 84_000, telechargeable: true })).toBe("Excel · 84 Ko · téléchargeable");
    expect(metaRessource({ id: "r", titre: "Guide", format: "application/pdf", tailleOctets: 1_200_000, telechargeable: false })).toBe(
      "PDF · 1,2 Mo · consultation seule",
    );
    expect(metaRessource({ id: "r", titre: "Autre", format: "application/x-inconnu", tailleOctets: 2_000, telechargeable: true })).toBe("Fichier · 2 Ko · téléchargeable");
  });

  it("le verrou d'une leçon fermée s'adresse au visiteur ou au compte connecté", () => {
    expect(verrou(ZOTERO, false)).toEqual({
      titre: "Cette leçon est réservée aux comptes Étudium",
      texte: "Créez votre compte gratuit pour suivre toute la formation.",
      inscription: true,
      connexion: true,
      formules: false,
      apercu: null,
    });
    expect(verrou(EXCEL, false)).toMatchObject({
      titre: "Cette leçon est verrouillée",
      texte: "Elle fait partie d’un parcours. Les leçons d’aperçu restent ouvertes à tous.",
      inscription: true,
      connexion: false,
      formules: false,
      apercu: { id: id(1) },
    });
    expect(verrou(EXCEL, true)).toMatchObject({ inscription: false, connexion: false, formules: true, apercu: { id: id(1) } });
  });
});
