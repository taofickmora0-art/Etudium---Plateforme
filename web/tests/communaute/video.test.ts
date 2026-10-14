import { describe, expect, it } from "vitest";
import { lecteurVideo, miniatureVideo, nomPlateforme, pageVideo, reconnaitreVideo, verticale, videoRangee } from "@/lib/communaute/video";

// La vidéo jointe à une publication (spec mise en forme et vidéo, §3) : reconnue depuis son adresse, lue par un lecteur
// construit depuis la plateforme et l'identifiant, jamais depuis une adresse fournie.

const r = (adresse: string) => reconnaitreVideo(adresse);

describe("Reconnaître une vidéo", () => {
  it("les huit plateformes", () => {
    expect(r("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toMatchObject({ plateforme: "youtube", id: "dQw4w9WgXcQ" });
    expect(r("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ plateforme: "youtube", id: "dQw4w9WgXcQ" });
    expect(r("https://youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ plateforme: "youtube", id: "dQw4w9WgXcQ" });
    expect(r("https://vimeo.com/76979871")).toMatchObject({ plateforme: "vimeo", id: "76979871" });
    expect(r("https://vimeo.com/76979871/8272103f6e")).toMatchObject({ plateforme: "vimeo", id: "76979871", h: "8272103f6e" });
    expect(r("https://player.vimeo.com/video/76979871?h=8272103f6e")).toMatchObject({ plateforme: "vimeo", id: "76979871", h: "8272103f6e" });
    expect(r("https://www.dailymotion.com/video/x8abc12_un-titre")).toMatchObject({ plateforme: "dailymotion", id: "x8abc12" });
    expect(r("https://dai.ly/x8abc12")).toMatchObject({ plateforme: "dailymotion", id: "x8abc12" });
    expect(r("https://www.loom.com/share/0123456789abcdef0123456789abcdef")).toMatchObject({ plateforme: "loom", id: "0123456789abcdef0123456789abcdef" });
    expect(r("https://www.tiktok.com/@coach.francis/video/7300123456789012345")).toMatchObject({ plateforme: "tiktok", id: "7300123456789012345" });
    expect(r("https://www.facebook.com/watch/?v=123456789012345")).toMatchObject({ plateforme: "facebook", id: "123456789012345" });
    expect(r("https://www.facebook.com/EtudiumBJ/videos/123456789012345/")).toMatchObject({ plateforme: "facebook", id: "123456789012345" });
    expect(r("https://www.facebook.com/reel/123456789012345")).toMatchObject({ plateforme: "facebook", id: "123456789012345" });
    expect(r("https://www.instagram.com/reel/C1a2B3c4D5e/")).toMatchObject({ plateforme: "instagram", id: "C1a2B3c4D5e" });
    expect(r("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing")).toMatchObject({
      plateforme: "drive",
      id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345",
    });
  });

  it("un fichier vidéo en https ; l'adresse d'origine est gardée", () => {
    expect(r("https://cdn.exemple.com/videos/cours.MP4")).toEqual({ plateforme: "fichier", url: "https://cdn.exemple.com/videos/cours.MP4" });
    expect(r("  https://youtu.be/dQw4w9WgXcQ  ")?.url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("une autre plateforme, un identifiant hors forme, un fichier en http : une carte ; pas une adresse web : null", () => {
    expect(r("https://www.twitch.tv/videos/123")).toEqual({ plateforme: "autre", url: "https://www.twitch.tv/videos/123" });
    expect(r("https://www.youtube.com/watch?v=court")).toMatchObject({ plateforme: "autre" });
    expect(r("https://vimeo.com/abc")).toMatchObject({ plateforme: "autre" });
    expect(r("http://exemple.com/cours.mp4")).toMatchObject({ plateforme: "autre" });
    expect(r("https://fb.watch/abcDEF/")).toMatchObject({ plateforme: "autre" });
    expect(r("javascript:alert(1)")).toBeNull();
    expect(r("youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(r("ftp://exemple.com/a.mp4")).toBeNull();
    expect(r(`https://exemple.com/${"a".repeat(1000)}`)).toBeNull();
  });
});

describe("Lire une vidéo", () => {
  it("le lecteur, construit depuis la plateforme et l'identifiant ; pas de lecteur pour un fichier ou une autre plateforme", () => {
    const l = (adresse: string) => lecteurVideo(r(adresse)!);
    expect(l("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
    expect(l("https://vimeo.com/76979871/8272103f6e")).toBe("https://player.vimeo.com/video/76979871?autoplay=1&h=8272103f6e");
    expect(l("https://dai.ly/x8abc12")).toBe("https://www.dailymotion.com/embed/video/x8abc12?autoplay=1");
    expect(l("https://www.loom.com/share/0123456789abcdef0123456789abcdef")).toBe("https://www.loom.com/embed/0123456789abcdef0123456789abcdef?autoplay=1");
    expect(l("https://www.tiktok.com/@a/video/7300123456789012345")).toBe("https://www.tiktok.com/embed/v2/7300123456789012345");
    expect(l("https://www.facebook.com/watch/?v=123456789012345")).toBe(
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D123456789012345&show_text=false&autoplay=true",
    );
    expect(l("https://www.instagram.com/reel/C1a2B3c4D5e/")).toBe("https://www.instagram.com/p/C1a2B3c4D5e/embed");
    expect(l("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view")).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    expect(l("https://cdn.exemple.com/cours.mp4")).toBeNull();
    expect(l("https://www.twitch.tv/videos/123")).toBeNull();
  });

  it("la miniature, le format vertical, le nom de la plateforme", () => {
    expect(miniatureVideo(r("https://youtu.be/dQw4w9WgXcQ")!)).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(miniatureVideo(r("https://dai.ly/x8abc12")!)).toBe("https://www.dailymotion.com/thumbnail/video/x8abc12");
    expect(miniatureVideo(r("https://vimeo.com/76979871")!)).toBeNull();
    expect(miniatureVideo({ plateforme: "autre", url: "https://www.twitch.tv/x", image: "https://img.exemple.com/a.jpg" })).toBe("https://img.exemple.com/a.jpg");
    expect([verticale(r("https://www.tiktok.com/@a/video/7300123456789012345")!), verticale(r("https://youtu.be/dQw4w9WgXcQ")!)]).toEqual([true, false]);
    expect(nomPlateforme(r("https://youtu.be/dQw4w9WgXcQ")!)).toBe("YouTube");
    expect(nomPlateforme(r("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view")!)).toBe("Google Drive");
    expect(nomPlateforme(r("https://www.twitch.tv/videos/123")!)).toBe("twitch.tv");
  });

  it("une vidéo rangée par la base est relue avec les mêmes règles ; une forme douteuse est ignorée", () => {
    expect(videoRangee({ plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" })).toEqual({ plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" });
    expect(videoRangee({ plateforme: "autre", url: "https://www.twitch.tv/x", titre: "Un live", image: "https://img.exemple.com/a.jpg" })).toEqual({
      plateforme: "autre",
      url: "https://www.twitch.tv/x",
      titre: "Un live",
      image: "https://img.exemple.com/a.jpg",
    });
    expect(videoRangee({ plateforme: "youtube", id: "../../x", url: "https://youtu.be/x" })).toBeNull();
    expect(videoRangee({ plateforme: "inconnue", url: "https://exemple.com" })).toBeNull();
    expect(videoRangee({ plateforme: "fichier", url: "javascript:alert(1)" })).toBeNull();
    expect(videoRangee({ plateforme: "autre", url: "https://exemple.com", image: "javascript:x" })).toEqual({ plateforme: "autre", url: "https://exemple.com", image: null });
    expect(videoRangee(null)).toBeNull();
  });

  it("la page de la vidéo, construite depuis la plateforme et l'identifiant, jamais depuis l'adresse rangée (revue finale)", () => {
    const forge = (plateforme: string, id: string, h?: string) => ({ plateforme, id, ...(h ? { h } : {}), url: "https://hameconnage.example" }) as never;
    expect(pageVideo(forge("youtube", "dQw4w9WgXcQ"))).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(pageVideo(forge("vimeo", "76979871"))).toBe("https://vimeo.com/76979871");
    expect(pageVideo(forge("vimeo", "76979871", "8272103f6e"))).toBe("https://vimeo.com/76979871/8272103f6e");
    expect(pageVideo(forge("dailymotion", "x8abc12"))).toBe("https://www.dailymotion.com/video/x8abc12");
    expect(pageVideo(forge("loom", "0123456789abcdef0123456789abcdef"))).toBe("https://www.loom.com/share/0123456789abcdef0123456789abcdef");
    expect(pageVideo(forge("tiktok", "7300123456789012345"))).toBe("https://www.tiktok.com/embed/v2/7300123456789012345");
    expect(pageVideo(forge("facebook", "123456789012345"))).toBe("https://www.facebook.com/watch/?v=123456789012345");
    expect(pageVideo(forge("instagram", "C1a2B3c4D5e"))).toBe("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(pageVideo(forge("drive", "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"))).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view");
    expect(pageVideo({ plateforme: "autre", url: "https://www.twitch.tv/x" })).toBe("https://www.twitch.tv/x");
  });
});
