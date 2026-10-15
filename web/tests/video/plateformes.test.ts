import { describe, expect, it } from "vitest";
import { estMesuree, estVertical, messageLienCourt, parseVideoUrl, urlIntegration, videoLabel, videoLink, type Video } from "@/lib/video/plateformes";

// Les plateformes des vidéos des leçons (spec 2026-10-15-plateformes-video-design, §2).
const TIKTOK = "7234567890123456789";
const LOOM = "0123456789abcdef0123456789abcdef";
const DRIVE = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("Les liens reconnus", () => {
  it("TikTok : la page d'une vidéo, le lecteur, l'ancienne intégration", () => {
    for (const lien of [
      `https://www.tiktok.com/@etudium/video/${TIKTOK}?is_from_webapp=1&sender_device=pc`,
      `tiktok.com/@etudium.bj/video/${TIKTOK}`,
      `https://www.tiktok.com/player/v1/${TIKTOK}?autoplay=1`,
      `https://www.tiktok.com/embed/v2/${TIKTOK}`,
    ]) {
      expect(parseVideoUrl(lien), lien).toEqual({ fournisseur: "tiktok", id: TIKTOK });
    }
  });

  it("un lien court TikTok n'a pas l'identifiant : on demande le lien complet", () => {
    for (const lien of ["https://vm.tiktok.com/ZMabcdEF/", "https://www.tiktok.com/t/ZTabcdEF/"]) {
      expect(parseVideoUrl(lien), lien).toBeNull();
      expect(messageLienCourt(lien)).toBe("Lien court TikTok : ouvrez-le, puis copiez le lien complet de la vidéo (…/video/123…).");
    }
    expect(messageLienCourt(`https://www.tiktok.com/@a/video/${TIKTOK}`)).toBeNull();
  });

  it("Tella, Loom, ScreenPal, Google Drive", () => {
    expect(parseVideoUrl("https://www.tella.tv/video/mon-cours-excel-a1b2")).toEqual({ fournisseur: "tella", id: "mon-cours-excel-a1b2" });
    expect(parseVideoUrl("https://www.tella.tv/video/mon-cours-excel-a1b2/embed?autoPlay=true")).toEqual({ fournisseur: "tella", id: "mon-cours-excel-a1b2" });
    expect(parseVideoUrl(`https://www.loom.com/share/${LOOM}?sid=1234`)).toEqual({ fournisseur: "loom", id: LOOM });
    expect(parseVideoUrl(`https://www.loom.com/embed/${LOOM}`)).toEqual({ fournisseur: "loom", id: LOOM });
    for (const lien of ["https://go.screenpal.com/watch/cZ1abc2Def3", "https://screenpal.com/player/cZ1abc2Def3?width=640", "https://screencast-o-matic.com/watch/cZ1abc2Def3"]) {
      expect(parseVideoUrl(lien), lien).toEqual({ fournisseur: "screenpal", id: "cZ1abc2Def3" });
    }
    for (const lien of [`https://drive.google.com/file/d/${DRIVE}/view?usp=sharing`, `https://drive.google.com/file/d/${DRIVE}/preview`, `https://drive.google.com/open?id=${DRIVE}`]) {
      expect(parseVideoUrl(lien), lien).toEqual({ fournisseur: "drive", id: DRIVE });
    }
  });

  it("YouTube et Vimeo restent reconnus", () => {
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ fournisseur: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ fournisseur: "vimeo", id: "76979871" });
  });

  it("un faux domaine, un autre document Google ou un identifiant mal formé ne sont jamais reconnus", () => {
    for (const lien of [
      `https://tiktok.com.evil.com/@a/video/${TIKTOK}`,
      `https://evil.com/drive.google.com/file/d/${DRIVE}/view`,
      `https://docs.google.com/document/d/${DRIVE}/edit`,
      "https://www.tiktok.com/@a/video/123",
      "https://www.loom.com/share/pas-un-identifiant",
      "https://www.tella.tv/video/x",
      "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345",
    ]) {
      expect(parseVideoUrl(lien), lien).toBeNull();
    }
  });
});

describe("Ce qu'on fait d'une vidéo reconnue", () => {
  const videos: Video[] = [
    { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
    { fournisseur: "vimeo", id: "76979871/abcdef0123" },
    { fournisseur: "tiktok", id: TIKTOK },
    { fournisseur: "tella", id: "mon-cours-excel-a1b2" },
    { fournisseur: "loom", id: LOOM },
    { fournisseur: "screenpal", id: "cZ1abc2Def3" },
    { fournisseur: "drive", id: DRIVE },
  ];

  it("le lien public, relu, redonne la même vidéo ; le libellé nomme la plateforme", () => {
    for (const v of videos) expect(parseVideoUrl(videoLink(v)), v.fournisseur).toEqual(v);
    expect(videos.map((v) => videoLabel(v).split(" · ")[0])).toEqual(["YouTube", "Vimeo", "TikTok", "Tella", "Loom", "ScreenPal", "Google Drive"]);
  });

  it("mesurée ou non ; TikTok est vertical", () => {
    expect(videos.filter((v) => estMesuree(v.fournisseur)).map((v) => v.fournisseur)).toEqual(["youtube", "vimeo", "tiktok", "tella"]);
    expect(videos.filter((v) => estVertical(v.fournisseur)).map((v) => v.fournisseur)).toEqual(["tiktok"]);
  });

  it("l'adresse du lecteur officiel intégré", () => {
    expect(videos.map((v) => urlIntegration(v))).toEqual([
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
      "https://player.vimeo.com/video/76979871?dnt=1&h=abcdef0123",
      `https://www.tiktok.com/player/v1/${TIKTOK}?rel=0&music_info=0&description=0`,
      "https://www.tella.tv/video/mon-cours-excel-a1b2/embed",
      `https://www.loom.com/embed/${LOOM}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`,
      "https://go.screenpal.com/player/cZ1abc2Def3?title=0",
      `https://drive.google.com/file/d/${DRIVE}/preview`,
    ]);
  });
});
