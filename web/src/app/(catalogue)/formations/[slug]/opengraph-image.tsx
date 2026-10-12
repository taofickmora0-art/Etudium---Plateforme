import { ImageResponse } from "next/og";
import { PALETTES, PLAQUES } from "@/components/ui/CourseIllustration";
import { getFiche } from "@/lib/catalogue/data";
import { dureeLisible, nombreDeLecons, parcoursPrincipal } from "@/lib/catalogue/regles";

// Image de l'aperçu d'un lien partagé (WhatsApp, Facebook…) : spec du lot 1, §9. Générée à la demande, rien à fournir.

export const alt = "Formation Étudium";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEXAGONE = "15,4 24.5,9.5 24.5,20.5 15,26 5.5,20.5 5.5,9.5";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let fiche = null;
  try {
    fiche = await getFiche(slug);
  } catch {
    fiche = null;
  }
  if (!fiche) return new Response("Formation introuvable", { status: 404 });

  const couleurs = PALETTES[parcoursPrincipal(fiche)];
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const meta = [dureeLisible(fiche.dureeSecondes), fiche.nbLecons > 0 ? nombreDeLecons(fiche.nbLecons) : "", fiche.gratuite ? "Gratuite" : ""].filter(Boolean).join(" · ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        // Fond bleu uni : le moteur d'image (Satori) ne dessine pas la trame de points des bandeaux.
        backgroundColor: "#0B18C9",
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", position: "relative", width: 60, height: 60 }}>
            <svg width="60" height="60" viewBox="0 0 30 30">
              <polygon points={HEXAGONE} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round" />
            </svg>
            {/* Satori n'applique pas « inset » : boîte posée explicitement sur l'hexagone. */}
            <div
              style={{ position: "absolute", top: 0, left: 0, width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#0B18C9" }}
            >
              É
            </div>
          </div>
          <div style={{ fontSize: 36, letterSpacing: -0.5 }}>Étudium</div>
        </div>
        {parcours && (
          <div style={{ display: "flex", padding: "10px 24px", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.14)", fontSize: 26 }}>{parcours.nom}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
          <div style={{ fontSize: fiche.titre.length > 42 ? 58 : 70, lineHeight: 1.08, letterSpacing: -1.5 }}>{fiche.titre}</div>
          {meta && <div style={{ fontSize: 28, color: "#DDE1FF" }}>{meta}</div>}
        </div>
        <div
          style={{
            display: "flex",
            width: 220,
            height: 220,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 60,
            backgroundColor: "#FFFFFF",
            boxShadow: "0 18px 48px rgba(4, 10, 80, 0.28)",
          }}
        >
          <svg width="150" height="150" viewBox="0 0 48 48">
            {PLAQUES.flatMap((points, i) => [
              <polygon key={`${i}-a`} points={points} fill={couleurs[i * 2]} stroke={couleurs[i * 2]} strokeWidth="12.4" strokeLinejoin="round" />,
              <polygon key={`${i}-b`} points={points} fill={couleurs[i * 2 + 1]} stroke={couleurs[i * 2 + 1]} strokeWidth="10" strokeLinejoin="round" />,
            ])}
          </svg>
        </div>
      </div>
    </div>,
    size,
  );
}
