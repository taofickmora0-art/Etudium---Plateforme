import { ImageResponse } from "next/og";
import { LOGO_COMPLET } from "@/components/brand/traces";
import { adresseVerification } from "@/lib/certificats/adresse";
import { matriceQr } from "@/lib/certificats/qr";
import type { Certificat } from "@/lib/certificats/types";
import { dateLongue } from "./dates";

// Le certificat de réussite (NdCertificat) en image : A4 paysage à 150 points par pouce. Il sert aussi au PDF.

export const TAILLE_CERTIFICAT = { width: 1754, height: 1240 } as const;

const BLEU = "#0B18C9";
const ENCRE = "#1D1D1F";
const DISCRET = "#667085";

/** Le QR Code en un seul tracé (une case = un carré), avec sa marge blanche de 4 cases. */
function QrCode({ adresse, taille }: { adresse: string; taille: number }) {
  const matrice = matriceQr(adresse);
  const n = matrice.length;
  let trace = "";
  matrice.forEach((ligne, y) => ligne.forEach((noire, x) => noire && (trace += `M${x + 4} ${y + 4}h1v1h-1z`)));
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${n + 8} ${n + 8}`}>
      <rect x="0" y="0" width={n + 8} height={n + 8} fill="#FFFFFF" />
      <path d={trace} fill={ENCRE} />
    </svg>
  );
}

/** L'image PNG du certificat (ce que montre le certificat, et l'adresse de vérification en QR Code). */
export function imageCertificat(c: Certificat): ImageResponse {
  const adresse = adresseVerification(c.identifiant);
  const site = adresse.replace(/^https?:\/\//, "").replace(/\/c\/.*$/, "");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#E9EFFB", padding: 56, fontFamily: "sans-serif" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#FFFFFF",
            borderRadius: 40,
            border: `6px solid ${BLEU}`,
            padding: "72px 96px",
            color: ENCRE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Le logo complet, en bleu. */}
            <svg width={Math.round((76 * LOGO_COMPLET.largeur) / LOGO_COMPLET.hauteur)} height={76} viewBox={`0 0 ${LOGO_COMPLET.largeur} ${LOGO_COMPLET.hauteur}`}>
              <path d={LOGO_COMPLET.d} fill={BLEU} fillRule="evenodd" />
            </svg>
            <div style={{ fontSize: 28, color: DISCRET }}>{`N° ${c.identifiant}`}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 64, flex: 1 }}>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, color: ENCRE }}>Certificat de réussite</div>
            <div style={{ fontSize: 32, color: DISCRET, marginTop: 40 }}>Décerné à</div>
            <div style={{ fontSize: c.titulaire.length > 30 ? 60 : 72, fontWeight: 700, color: BLEU, marginTop: 12, textAlign: "center" }}>{c.titulaire}</div>
            <div style={{ fontSize: 32, color: DISCRET, marginTop: 36 }}>pour avoir validé la formation</div>
            <div style={{ fontSize: c.formation.length > 46 ? 44 : 52, fontWeight: 600, color: ENCRE, marginTop: 12, textAlign: "center", maxWidth: 1300 }}>{c.formation}</div>
            {c.parcours && <div style={{ fontSize: 28, color: DISCRET, marginTop: 16 }}>{`Parcours ${c.parcours}`}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 96 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 26, color: DISCRET }}>Délivré le</div>
                <div style={{ fontSize: 34, fontWeight: 600 }}>{dateLongue(c.delivreLe)}</div>
              </div>
              {c.formateur && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
                  <div style={{ fontSize: 26, color: DISCRET }}>Formation animée par</div>
                  <div style={{ fontSize: c.formateur.length > 28 ? 28 : 34, fontWeight: 600, lineHeight: 1.25 }}>{c.formateur}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <QrCode adresse={adresse} taille={220} />
              <div style={{ fontSize: 22, color: DISCRET }}>{`Vérifiable sur ${site}/verifier`}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    TAILLE_CERTIFICAT,
  );
}
