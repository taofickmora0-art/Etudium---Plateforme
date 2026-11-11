import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0080 (ta demande du 11 novembre 2026) : chaque message d'un groupe prévient ses membres (la cloche, son son,
// le téléphone) ; un clic mène au groupe, sur le message. Ni l'auteur, ni ceux qui ont coupé le groupe, ni l'auteur du
// message cité (il reçoit « Nouvelle réponse »). Une seule notification non lue par groupe : la précédente laisse sa place.

let banc: Banc;
const [A, B, C] = Array.from({ length: 3 }, () => randomUUID());
let general: string;

const envoyer = async (qui: string, texte: string, reponse: string | null = null) =>
  (await banc.en<{ r: { id: string } }>({ id: qui }, "select public.envoyer_message_groupe(p_groupe => $1, p_texte => $2, p_reponse_a => $3) as r", [general, texte, reponse]))[0].r.id;
const notifications = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string }>("select titre, texte, lien from public.notifications where destinataire = $1 and lue_le is null order by id", [qui])).rows;

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0079"), "supabase/migrations/0080_notifications_groupes.sql"]);
  for (const c of [A, B, C]) await banc.creerCompte(c);
  await banc.db.query("update public.profils set prenom = 'Awa', nom = 'Adjovi' where id = $1", [A]);
  general = (await banc.db.query<{ id: string }>("select id from public.groupes where slug = 'general'")).rows[0].id;
  await banc.en({ id: C }, "select public.couper_groupe($1, true)", [general]);
}, 180_000);

describe("Les notifications des messages de groupe", () => {
  it("un message prévient les membres : titre, extrait, lien vers le message ; ni l'auteur ni qui a coupé le groupe", async () => {
    const id = await envoyer(A, "Bonjour à tous");
    expect(await notifications(B)).toEqual([{ titre: "Nouveau message dans le groupe Général", texte: "Awa A. : « Bonjour à tous »", lien: `/groupes/general?message=${id}` }]);
    expect(await notifications(A)).toEqual([]);
    expect(await notifications(C)).toEqual([]);
  });

  it("une seule notification non lue par groupe : la nouvelle remplace la précédente", async () => {
    const id = await envoyer(A, "Deuxième message");
    const liste = await notifications(B);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ texte: "Awa A. : « Deuxième message »", lien: `/groupes/general?message=${id}` });
  });

  it("une réponse : l'auteur cité reçoit « Nouvelle réponse », pas en plus « Nouveau message »", async () => {
    await banc.db.query("update public.notifications set lue_le = now() where destinataire = $1", [B]);
    const sien = await envoyer(B, "Ma question");
    await envoyer(A, "Ma réponse", sien);
    const titres = (await notifications(B)).map((n) => n.titre);
    expect(titres).toEqual(["Nouvelle réponse dans le groupe Général"]);
  });
});
