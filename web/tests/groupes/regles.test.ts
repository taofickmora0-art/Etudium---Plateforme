import { describe, expect, it } from "vitest";
import { cheminFormateur } from "@/lib/auth/espace-formateur";
import { versGroupe, versMessage, versResume } from "@/lib/groupes/conversion";
import { apercuDernier, grouperFil, libelleJour, momentListe, peutModifier, refusImage, totalNonLus } from "@/lib/groupes/regles";
import type { MessageGroupe } from "@/lib/groupes/types";

// Les règles des groupes (migration 0075), sans base : jours, blocs par auteur, 15 minutes, images, non-lus du menu.

const MAINTENANT = new Date("2026-11-03T15:00:00+01:00");
const message = (o: Omit<Partial<MessageGroupe>, "auteur"> & { auteur?: Partial<MessageGroupe["auteur"]> }): MessageGroupe => ({
  id: crypto.randomUUID(),
  groupeId: "g",
  deMoi: false,
  texte: "Bonjour",
  image: null,
  vocal: null,
  reponse: null,
  creeLe: "2026-11-03T14:00:00+01:00",
  modifieLe: null,
  supprime: false,
  retire: false,
  reactions: [],
  epingle: false,
  ...o,
  auteur: { id: "a", prenom: "Awa", nom: "Kpadé", photoUrl: null, badge: null, ...o.auteur },
});

describe("Les jours du fil", () => {
  it("« Aujourd’hui », « Hier », puis « Lundi 3 novembre » (l'année si ce n'est pas celle-ci)", () => {
    expect(libelleJour("2026-11-03T08:00:00+01:00", MAINTENANT)).toBe("Aujourd’hui");
    expect(libelleJour("2026-11-02T23:30:00+01:00", MAINTENANT)).toBe("Hier");
    expect(libelleJour("2026-10-26T10:00:00+01:00", MAINTENANT)).toBe("Lundi 26 octobre");
    expect(libelleJour("2025-11-03T10:00:00+01:00", MAINTENANT)).toBe("Lundi 3 novembre 2025");
  });

  it("dans la liste : l'heure aujourd'hui, « Hier », le jour de la semaine, puis la date courte", () => {
    expect(momentListe("2026-11-03T09:05:00+01:00", MAINTENANT)).toBe("9 h 05");
    expect(momentListe("2026-11-02T09:05:00+01:00", MAINTENANT)).toBe("Hier");
    expect(momentListe("2026-10-30T09:05:00+01:00", MAINTENANT)).toBe("Vendredi");
    expect(momentListe("2026-10-12T09:05:00+01:00", MAINTENANT)).toBe("12 oct.");
  });
});

describe("Les blocs par auteur", () => {
  it("un jour par séparateur ; les messages d'un même auteur à moins de 5 minutes forment un bloc", () => {
    const jours = grouperFil(
      [
        message({ creeLe: "2026-11-02T10:00:00+01:00" }),
        message({ creeLe: "2026-11-03T10:00:00+01:00" }),
        message({ creeLe: "2026-11-03T10:03:00+01:00" }),
        message({ creeLe: "2026-11-03T10:09:00+01:00" }),
        message({ creeLe: "2026-11-03T10:10:00+01:00", auteur: { id: "b" } }),
        message({ creeLe: "2026-11-03T10:11:00+01:00" }),
      ],
      MAINTENANT,
    );
    expect(jours.map((j) => j.libelle)).toEqual(["Hier", "Aujourd’hui"]);
    expect(jours[1].blocs.map((b) => [b.auteurId, b.messages.length])).toEqual([
      ["a", 2],
      ["a", 1],
      ["b", 1],
      ["a", 1],
    ]);
  });
});

describe("Ce qu'on peut faire d'un message", () => {
  it("le modifier : le sien, en ligne, pendant 15 minutes", () => {
    expect(peutModifier(message({ deMoi: true, creeLe: "2026-11-03T14:50:00+01:00" }), MAINTENANT)).toBe(true);
    expect(peutModifier(message({ deMoi: true, creeLe: "2026-11-03T14:40:00+01:00" }), MAINTENANT)).toBe(false);
    expect(peutModifier(message({ deMoi: false, creeLe: "2026-11-03T14:50:00+01:00" }), MAINTENANT)).toBe(false);
    expect(peutModifier(message({ deMoi: true, supprime: true, creeLe: "2026-11-03T14:50:00+01:00" }), MAINTENANT)).toBe(false);
    const vocal = { chemin: "a/n.webm", type: "audio/webm", url: null, dureeMs: 3000, ondes: [] };
    expect(peutModifier(message({ deMoi: true, texte: "", vocal, creeLe: "2026-11-03T14:50:00+01:00" }), MAINTENANT)).toBe(false);
  });

  it("une image : JPEG, PNG ou WebP, 5 Mo au plus", () => {
    expect(refusImage("image/png", 1000)).toBeNull();
    expect(refusImage("image/webp", 5_242_880)).toBeNull();
    expect(refusImage("image/jpeg", 5_242_881)).toBe("L’image dépasse 5 Mo.");
    expect(refusImage("application/pdf", 1000)).toBe("L’image doit être au format JPEG, PNG ou WebP.");
    expect(refusImage(null, 1000)).toBe("L’image doit être au format JPEG, PNG ou WebP.");
  });
});

describe("La liste et le menu", () => {
  it("le dernier message : « Vous », le nom court, « Message supprimé », « Image »", () => {
    const d = { id: "m", auteur: { prenom: "Awa", nom: "Kpadé" }, deMoi: false, texte: "Bonjour à tous", image: false, vocal: null, supprime: false, retire: false, creeLe: "" };
    expect(apercuDernier(d)).toBe("Awa K. : Bonjour à tous");
    expect(apercuDernier({ ...d, deMoi: true })).toBe("Vous : Bonjour à tous");
    expect(apercuDernier({ ...d, texte: "", supprime: true })).toBe("Awa K. : Message supprimé");
    expect(apercuDernier({ ...d, texte: "", image: true })).toBe("Awa K. : Image");
    expect(apercuDernier({ ...d, texte: "", vocal: 12_400 })).toBe("Awa K. : 🎤 Note vocale (0:12)");
  });

  it("le total du menu : les groupes actifs qui ne sont pas coupés", () => {
    expect(totalNonLus([{ nonLus: 3, coupe: false, actif: true }, { nonLus: 5, coupe: true, actif: true }, { nonLus: 2, coupe: false, actif: false }])).toBe(3);
  });

  it("un formateur qui suit le lien d'un groupe arrive dans son espace, au message", () => {
    expect(cheminFormateur("/groupes")).toBe("/formateur/groupes");
    expect(cheminFormateur("/groupes/reussite-academique?message=abc")).toBe("/formateur/groupes/reussite-academique?message=abc");
    expect(cheminFormateur("/formateur/groupes/general")).toBe("/formateur/groupes/general");
  });
});

describe("Ce que rend la base", () => {
  it("un message : l'auteur et son badge, la réponse citée, les réactions", () => {
    const m = versMessage({
      id: "m1",
      groupe_id: "g1",
      auteur: { id: "a", prenom: "Mireille", nom: "Adjovi", photo: null, badge: "formateur" },
      de_moi: false,
      texte: "Bienvenue",
      image: null,
      reponse: { id: "m0", auteur: { prenom: "Koffi", nom: "Dossou" }, texte: "Bonjour", image: false, supprime: false },
      cree_le: "2026-11-03T10:00:00Z",
      modifie_le: null,
      supprime: false,
      retire: false,
      reactions: [{ emoji: "👍", nombre: 2, moi: true }],
      epingle: true,
    });
    expect(m).toMatchObject({ auteur: { badge: "formateur" }, reponse: { id: "m0", auteur: { prenom: "Koffi" } }, reactions: [{ emoji: "👍", nombre: 2, moi: true }], epingle: true });
  });

  it("une note vocale (0076) : en « vocal », jamais en image ; la réponse citée et la liste le savent", () => {
    const m = versMessage({
      id: "m2",
      groupe_id: "g1",
      auteur: { id: "a", prenom: "Koffi", nom: "Dossou", photo: null, badge: null },
      texte: "",
      image: null,
      vocal: { chemin: "a/n.webm", type: "audio/webm", duree_ms: 4200, ondes: [3, 60] },
      reponse: { id: "m1", auteur: { prenom: "Awa", nom: "Kpadé" }, texte: "", image: false, vocal: true, supprime: false },
      cree_le: "2026-11-03T10:00:00Z",
    });
    expect(m.vocal).toEqual({ chemin: "a/n.webm", type: "audio/webm", url: null, dureeMs: 4200, ondes: [3, 60] });
    expect(m.image).toBeNull();
    expect(m.reponse).toMatchObject({ vocal: true, image: false });
    expect(versMessage({ id: "m3", texte: "Salut" }).vocal).toBeNull();
    const resume = versResume({ id: "g", slug: "general", nom: "Général", dernier: { id: "m2", auteur: { prenom: "Koffi", nom: "Dossou" }, texte: "", image: false, vocal: 4200, cree_le: "" } });
    expect(resume.dernier).toMatchObject({ vocal: 4200, image: false });
  });

  it("un groupe fermé garde sa raison ; un groupe inconnu est null", () => {
    expect(versGroupe({ id: "g", slug: "s", nom: "N", type: "parcours", ouvert: false, raison: "abonnement" })).toMatchObject({ ouvert: false, raison: "abonnement" });
    expect(versGroupe(null)).toBeNull();
  });
});
