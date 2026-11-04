import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0076 : les notes vocales (spec du 4 novembre 2026). Une note est une pièce jointe audio, avec sa durée et
// son onde, dans les messages privés (0035) comme dans les groupes (0075). Pas de texte, pas de modification, pas
// d'analyse automatique ; 10 Mo et 5 minutes au plus ; la liste, la réponse citée, la notification et la file de
// modération disent « Note vocale ».

const MIGRATION = "supabase/migrations/0076_notes_vocales.sql";
const DUREE = "Une note vocale dure de 1 seconde à 5 minutes.";

let banc: Banc;
const [S, E, E2] = Array.from({ length: 3 }, () => randomUUID());
let CA: string; // l'assistance de E
let GENERAL: string;

type Vocal = { duree_ms: number; ondes: number[]; chemin?: string };
type Message = { id: string; texte: string; fichier: { nom: string; format: string; taille: number } | null; vocal: Vocal | null };
type MessageGroupe = {
  id: string;
  texte: string;
  image: { chemin: string } | null;
  vocal: (Vocal & { chemin: string; type: string }) | null;
  reponse: { image: boolean; vocal: boolean } | null;
  analyser: boolean;
};

const en = async <T>(qui: string, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>({ id: qui }, sql, params))[0].r;
const deposer = (espace: "messages" | "groupes", qui: string, chemin: string, type: string, taille = 40_000) =>
  banc.db.query("insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4::jsonb)", [espace, chemin, qui, JSON.stringify({ mimetype: type, size: taille })]);
const envoyer = (qui: string, texte: string, fichier: string | null, duree: number | null = null, ondes: number[] | null = null) =>
  en<Message>(qui, "select public.envoyer_message($1, $2, $3, null, $4, $5) as r", [CA, texte, fichier, duree, ondes]);
const envoyerGroupe = (qui: string, chemin: string | null, duree: number | null, ondes: number[] | null = [5, 50], o: { texte?: string; reponse?: string } = {}) =>
  en<MessageGroupe>(qui, "select public.envoyer_message_groupe($1, $2, $3, $4, $5, $6) as r", [GENERAL, o.texte ?? "", chemin, o.reponse ?? null, duree, ondes]);
const refus = (p: Promise<unknown>) => p.then(() => "accepté", (e: Error) => e.message);
const note = (qui: string, ext = "m4a") => `${qui}/${CA}/${randomUUID()}.${ext}`;

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0075"), MIGRATION]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E]);
  await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [E2]);
  CA = await en<string>(E, "select public.ouvrir_conversation(null) as r");
  GENERAL = (await banc.db.query<{ id: string }>("select id from public.groupes where parcours_id is null and formation_id is null")).rows[0].id;
}, 120_000);

beforeEach(async () => {
  await banc.db.query("delete from public.messages_groupes");
  await banc.db.query("update public.reglages_moderation set analyse_active = false");
});

describe("Une note vocale dans un message privé", () => {
  it("part avec sa durée et son onde ; la liste et la notification de l'équipe disent « Note vocale (0:12) »", async () => {
    const chemin = note(E);
    await deposer("messages", E, chemin, "audio/mp4");
    const m = await envoyer(E, "", chemin, 12_400, [0, 40, 100]);
    expect(m).toMatchObject({ texte: "", fichier: { nom: "Note vocale", format: "audio/mp4", taille: 40_000 }, vocal: { duree_ms: 12_400, ondes: [0, 40, 100] } });
    const fil = await en<{ messages: Message[] }>(E, "select public.fil_conversation($1) as r", [CA]);
    expect(fil.messages.at(-1)?.vocal).toEqual({ chemin, duree_ms: 12_400, ondes: [0, 40, 100] });
    const liste = await en<{ dernier: { vocal: number | null; fichier: string | null } }[]>(E, "select public.mes_conversations('etudiant') as r");
    expect(liste[0].dernier).toMatchObject({ vocal: 12_400, fichier: "Note vocale" });
    const notif = (await banc.db.query<{ texte: string }>("select texte from public.notifications where destinataire = $1 and categorie = 'messages' order by cree_le desc limit 1", [S])).rows[0];
    expect(notif.texte).toBe("Note vocale (0:12)");
  });

  it("un message ordinaire reste sans « vocal », et l'appel d'avant (4 paramètres) marche encore", async () => {
    const m = (await banc.en<{ r: Message }>({ id: E }, "select public.envoyer_message($1, $2, $3, $4) as r", [CA, "Bonjour", null, null]))[0].r;
    expect(m).toMatchObject({ texte: "Bonjour", vocal: null, fichier: null });
  });

  it("refuse le texte, une durée hors limites, une onde invalide, un format ou un poids qui ne conviennent pas", async () => {
    const audio = async (type = "audio/webm", taille = 40_000) => {
      const chemin = note(E, "webm");
      await deposer("messages", E, chemin, type, taille);
      return chemin;
    };
    expect(await refus(envoyer(E, "Écoute ça", await audio(), 5_000))).toBe("Une note vocale ne porte pas de texte.");
    expect(await refus(envoyer(E, "", await audio(), 400))).toBe(DUREE);
    expect(await refus(envoyer(E, "", await audio(), 300_001))).toBe(DUREE);
    expect(await refus(envoyer(E, "", await audio(), 5_000, Array.from({ length: 65 }, () => 1)))).toBe(DUREE);
    expect(await refus(envoyer(E, "", await audio(), 5_000, [101]))).toBe(DUREE);
    expect(await refus(envoyer(E, "", null, 5_000))).toBe("Écrivez un message ou joignez un fichier.");
    expect(await refus(envoyer(E, "", await audio("application/pdf"), 5_000))).toBe("Ce format n’est pas accepté.");
    expect(await refus(envoyer(E, "", await audio("audio/mp4", 10_485_761), 5_000))).toBe("Le fichier dépasse 10 Mo.");
    // Un fichier audio sans durée n'est pas une pièce jointe ordinaire.
    expect(await refus(envoyer(E, "", await audio(), null))).toBe("Ce format n’est pas accepté.");
    expect(await refus(envoyer(E, "", await audio(), 5_000))).toBe("accepté");
  });

  it("l'espace « messages » accepte les formats audio, en plus de ceux des rendus", async () => {
    const espace = (await banc.db.query<{ types: string[] }>("select allowed_mime_types as types from storage.buckets where id = 'messages'")).rows[0];
    expect(espace.types).toEqual(expect.arrayContaining(["application/pdf", "audio/mp4", "audio/webm", "audio/ogg"]));
  });
});

describe("Une note vocale dans un groupe", () => {
  const audio = async (qui = E, type = "audio/webm", taille = 30_000) => {
    const chemin = `${qui}/${randomUUID()}.webm`;
    await deposer("groupes", qui, chemin, type, taille);
    return chemin;
  };

  it("sort en « vocal » (pas en image), sans analyse même active ; la liste montre sa durée", async () => {
    await banc.db.query("update public.reglages_moderation set analyse_active = true");
    const chemin = await audio();
    const m = await envoyerGroupe(E, chemin, 4_200, [3, 60]);
    expect(m).toMatchObject({ texte: "", image: null, vocal: { chemin, type: "audio/webm", duree_ms: 4_200, ondes: [3, 60] }, analyser: false });
    const dernier = (await en<{ id: string; dernier: { vocal: number | null; image: boolean } }[]>(E, "select public.mes_groupes() as r")).find((g) => g.id === GENERAL)?.dernier;
    expect(dernier).toMatchObject({ vocal: 4_200, image: false });
  });

  it("la réponse la cite comme note vocale, et son auteur est prévenu « Note vocale »", async () => {
    const texte = await envoyerGroupe(E, null, null, null, { texte: "Vous avez compris l'exercice ?" });
    const reponse = await envoyerGroupe(E2, await audio(E2), 2_000, [10], { reponse: texte.id });
    expect(reponse.reponse).toMatchObject({ image: false, vocal: false });
    const notif = (await banc.db.query<{ texte: string }>("select texte from public.notifications where destinataire = $1 and categorie = 'communaute' order by cree_le desc limit 1", [E])).rows[0];
    expect(notif.texte).toBe("Koffi D. a répondu à votre message : « Note vocale »");
    const citee = await envoyerGroupe(E, null, null, null, { texte: "Merci !", reponse: reponse.id });
    expect(citee.reponse).toMatchObject({ image: false, vocal: true });
  });

  it("ne se modifie pas, se supprime (le chemin revient à l'appli) et disparaît du fil", async () => {
    const chemin = await audio();
    const m = await envoyerGroupe(E, chemin, 3_000);
    expect(await refus(en(E, "select public.modifier_message_groupe($1, 'Texte') as r", [m.id]))).toBe("Une note vocale ne se modifie pas.");
    expect(await en<string>(E, "select public.supprimer_message_groupe($1) as r", [m.id])).toBe(chemin);
    const fil = await en<{ messages: MessageGroupe[] }>(E, "select public.messages_groupe($1) as r", [GENERAL]);
    expect(fil.messages.find((x) => x.id === m.id)).toMatchObject({ vocal: null, image: null });
  });

  it("refuse le texte et une durée invalide ; 10 Mo pour une note, toujours 5 Mo pour une image", async () => {
    expect(await refus(envoyerGroupe(E, await audio(), 3_000, [1], { texte: "Salut" }))).toBe("Une note vocale ne porte pas de texte.");
    expect(await refus(envoyerGroupe(E, await audio(), 300_001))).toBe(DUREE);
    expect(await refus(envoyerGroupe(E, await audio(E, "image/jpeg"), 3_000))).toBe("Ce format de note vocale n’est pas accepté.");
    expect(await refus(envoyerGroupe(E, await audio(E, "audio/mp4", 10_485_761), 3_000))).toBe("La note vocale dépasse 10 Mo.");
    expect(await refus(envoyerGroupe(E, await audio(E, "audio/mp4", 6_000_000), 3_000))).toBe("accepté");
    const image = `${E}/${randomUUID()}.jpg`;
    await deposer("groupes", E, image, "image/jpeg", 6_000_000);
    expect(await refus(envoyerGroupe(E, image, null, null))).toBe("L’image dépasse 5 Mo.");
    const espace = (await banc.db.query<{ limite: string; types: string[] }>("select file_size_limit::text as limite, allowed_mime_types as types from storage.buckets where id = 'groupes'")).rows[0];
    expect(espace.limite).toBe("10485760");
    expect(espace.types).toEqual(expect.arrayContaining(["image/jpeg", "audio/mp4", "audio/webm"]));
  });

  it("paraît dans la file de modération comme « Note vocale (0:03) »", async () => {
    const m = await envoyerGroupe(E, await audio(), 3_000);
    const element = (await banc.db.query<{ e: { piece_jointe: { nom: string; type: string } } }>("select public.element_message_groupe(m) as e from public.messages_groupes m where id = $1", [m.id])).rows[0].e;
    expect(element.piece_jointe).toMatchObject({ nom: "Note vocale (0:03)", type: "audio/webm" });
  });
});

describe("La migration", () => {
  it("se rejoue sans erreur", async () => {
    await banc.db.exec(readFileSync(join(process.cwd(), MIGRATION), "utf8"));
    expect(await en<string>(E, "select (public.envoyer_message($1, 'Encore là', null, null)) ->> 'texte' as r", [CA])).toBe("Encore là");
  });
});
