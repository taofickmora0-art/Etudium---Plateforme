import { describe, expect, it, vi } from "vitest";
import { modeleEmail } from "@/lib/envois/email";
import { envoyerEmail } from "@/lib/envois/resend";

// Le modèle des e-mails importants (lot 5, étape B) : aux couleurs d'Étudium, un bouton vers la page, la raison de
// l'envoi en pied de page ; tout ce qui vient de la base est échappé.

const SITE = "https://etudium.app";

describe("Le modèle d'e-mail", () => {
  it("Review Focus 5 : le titre et le texte sont échappés", () => {
    const m = modeleEmail({ titre: "<script>alert(1)</script> & co", texte: 'Un "texte" <i>', lien: "/abonnement", prenom: "Aïcha" }, SITE);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
    expect(m.html).toContain("Un &quot;texte&quot; &lt;i&gt;");
    expect(m.sujet).toBe("<script>alert(1)</script> & co");
  });

  it("un bouton « Ouvrir Étudium » vers l'adresse absolue de la page ; la raison de l'envoi", () => {
    const m = modeleEmail({ titre: "Paiement reçu", texte: "Jusqu’au 1er mai 2027.", lien: "/abonnement/recus/ET-R-2026-000123", prenom: null }, SITE);
    expect(m.html).toContain('href="https://etudium.app/abonnement/recus/ET-R-2026-000123"');
    expect(m.html).toContain("Ouvrir Étudium");
    expect(m.html).toContain("Vous recevez cet e-mail car il concerne votre compte Étudium.");
    expect(m.html).toContain("Bonjour,");
  });

  it("sans lien : pas de bouton ; le texte brut reprend tout", () => {
    const m = modeleEmail({ titre: "Votre compte est réactivé", texte: "Vous retrouvez tous vos accès.", lien: null, prenom: "Aïcha" }, SITE);
    expect(m.html).not.toContain("Ouvrir Étudium");
    expect(m.texte).toBe("Bonjour Aïcha,\n\nVotre compte est réactivé\n\nVous retrouvez tous vos accès.\n\n— L’équipe Étudium");
    const avecLien = modeleEmail({ titre: "T", texte: "X", lien: "/aide", prenom: null }, SITE);
    expect(avecLien.texte).toContain("https://etudium.app/aide");
  });

  it("un lien qui ne commence pas par « / » n'est pas suivi", () => {
    const m = modeleEmail({ titre: "T", texte: "X", lien: "https://ailleurs.exemple", prenom: null }, SITE);
    expect(m.html).not.toContain("ailleurs.exemple");
    expect(modeleEmail({ titre: "T", texte: "X", lien: "//ailleurs.exemple", prenom: null }, SITE).html).not.toContain("ailleurs.exemple");
  });
});

describe("L'envoi par Resend", () => {
  const config = { cle: "re_test", expediteur: "Étudium <equipe@etudium.app>" };
  const message = { a: "a@exemple.com", sujet: "Paiement reçu", html: "<p>Bonjour</p>", texte: "Bonjour", idempotence: "envoi-12" };

  it("un POST vers Resend avec la clé, l'expéditeur et une clé d'idempotence (pas de doublon après un nouvel essai)", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    expect(await envoyerEmail(config, message, f)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Content-Type": "application/json", "Idempotency-Key": "envoi-12" });
    expect(JSON.parse(init.body)).toEqual({ from: config.expediteur, to: ["a@exemple.com"], subject: "Paiement reçu", html: "<p>Bonjour</p>", text: "Bonjour" });
  });

  it("relecture (5) : avec l'adresse de l'équipe, les réponses vont à l'équipe", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await envoyerEmail({ ...config, reponse: "equipe@etudium.app" }, message, f);
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ reply_to: "equipe@etudium.app" });
  });

  it("un refus de Resend ou une panne du réseau : échec avec un message lisible", async () => {
    const refus = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Invalid `to` field" }), { status: 422 }));
    expect(await envoyerEmail(config, message, refus)).toEqual({ ok: false, erreur: "Resend 422 : Invalid `to` field" });
    const panne = vi.fn().mockRejectedValue(new Error("fetch failed"));
    expect(await envoyerEmail(config, message, panne)).toEqual({ ok: false, erreur: "fetch failed" });
  });
});
