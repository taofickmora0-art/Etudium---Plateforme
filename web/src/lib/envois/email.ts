// Le modèle des e-mails importants (paiement reçu, rappels d'abonnement, compte suspendu ou réactivé) : la charte des
// modèles de web/supabase/templates, un bouton vers la page concernée, la raison de l'envoi en pied de page.
// Tout ce qui vient de la base est échappé ; seul un lien interne (« /… ») est suivi, rendu absolu avec l'adresse du site.

export type ContenuEmail = { titre: string; texte: string; lien: string | null; prenom: string | null };
export type ModeleEmail = { sujet: string; html: string; texte: string };

/**
 * Le logo complet d'Étudium (public/email/logo-etudium.png, scripts/generer-logo-email.mjs), à l'adresse du site en
 * ligne : il s'affiche aussi dans les e-mails envoyés depuis la base de test. Affiché à 122 × 32 px.
 */
export const LOGO_EMAIL = "https://etudium.online/email/logo-etudium.png";

const POLICE = "'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** L'adresse absolue d'un lien interne ; null pour tout autre lien. */
function adresse(lien: string | null, site: string): string | null {
  if (!lien || !lien.startsWith("/") || lien.startsWith("//") || lien.startsWith("/\\")) return null;
  return site + lien;
}

export function modeleEmail(e: ContenuEmail, site: string): ModeleEmail {
  const sujet = e.titre.replace(/\s+/g, " ").trim();
  const url = adresse(e.lien, site);
  const bonjour = e.prenom?.trim() ? `Bonjour ${e.prenom.trim()},` : "Bonjour,";
  const texte = e.texte.trim();

  const texteBrut = [bonjour, sujet, texte, url ? `Ouvrir Étudium : ${url}` : "", "— L’équipe Étudium"].filter(Boolean).join("\n\n");

  const bouton = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 0">
                  <tr>
                    <td style="background: #0b18c9; border-radius: 12px">
                      <a href="${echapper(url)}" style="display: inline-block; padding: 12px 22px; font-family: ${POLICE}; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none">Ouvrir Étudium</a>
                    </td>
                  </tr>
                </table>`
    : "";
  const paragraphe = texte
    ? `<p style="margin: 0; font-size: 15px; line-height: 24px; color: #232326">${echapper(texte).replace(/\n/g, "<br />")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${echapper(sujet)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f2f6fd">
    <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: #f2f6fd">${echapper(texte || sujet)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f2f6fd">
      <tr>
        <td align="center" style="padding: 32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px">
            <tr>
              <td style="padding: 0 4px 20px">
                <img src="${LOGO_EMAIL}" width="122" height="32" alt="Étudium" style="display: block; width: 122px; height: 32px; border: 0; outline: none; text-decoration: none; font-family: ${POLICE}; font-size: 19px; font-weight: 700; color: #0b18c9" />
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; border-radius: 16px; padding: 32px 28px; font-family: ${POLICE}">
                <p style="margin: 0 0 12px; font-size: 15px; line-height: 24px; color: #232326">${echapper(bonjour)}</p>
                <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 30px; font-weight: 600; color: #1d1d1f">${echapper(sujet)}</h1>
                ${paragraphe}
                ${bouton}
                <p style="margin: 24px 0 0; font-size: 14px; line-height: 22px; color: #667085">— L’équipe Étudium</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 4px 0; font-family: ${POLICE}; font-size: 12px; line-height: 18px; color: #667085">
                Vous recevez cet e-mail car il concerne votre compte Étudium.<br />
                Étudium · Formation, compétences digitales et accompagnement des étudiants et des jeunes diplômés.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { sujet, html, texte: texteBrut };
}
