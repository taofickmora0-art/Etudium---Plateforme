import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";
import { creerFormation, type FormationTest } from "./engagement-banc";

// Migration 0075 : les groupes de discussion en direct (spec du 3 novembre 2026). Le Général, un groupe par parcours
// (créé, renommé et désactivé avec lui) et, activé un par un, un groupe par formation. Accès, messages (réponse,
// modification pendant 15 minutes, suppression), réactions, épingle, lectures et non-lus, groupes coupés, notification
// de réponse, signalements et modération, temps réel sur « groupe:<id> ». La 0074 (Bibliothèque) n'en dépend pas : le
// banc s'en passe.

const MIGRATION = "supabase/migrations/0075_groupes.sql";
const FERME = "Ce groupe ne vous est pas ouvert.";
const J = "jeton-moderation-de-test";

let banc: Banc;
const [S, A, M, F, G, E, AB, L, SU, E2] = Array.from({ length: 10 }, () => randomUUID());
// S : super admin ; A : admin ; M : modératrice ; F : formateur d'Excel (parcours académique) ; G : formateur de Canva
// (parcours digital) ; E : inscrite à Excel ; AB : abonnée, inscrite nulle part ; L : compte gratuit, inscrit nulle part ;
// SU : inscrit à Excel, suspendu ; E2 : inscrit à Excel.
let ACAD: string; // parcours « Réussite académique »
let DIGI: string; // parcours « Compétences digitales »
let excel: FormationTest;
let canva: FormationTest;
const groupe: Record<string, string> = {};

type Message = {
  id: string;
  texte: string;
  de_moi: boolean;
  supprime: boolean;
  retire: boolean;
  modifie_le: string | null;
  image: { chemin: string; type: string } | null;
  auteur: { id: string; prenom: string; nom: string; badge: string | null };
  reponse: { id: string; texte: string; supprime: boolean; auteur: { prenom: string } } | null;
  reactions: { emoji: string; nombre: number; moi: boolean }[];
  epingle: boolean;
  analyser?: boolean;
};
type Resume = { id: string; slug: string; nom: string; type: string; actif: boolean; non_lus: number; coupe: boolean; dernier: { texte: string; de_moi: boolean } | null };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const r = async <T>(qui: Qui | string, sql: string, params: unknown[] = []) =>
  (await banc.en<{ r: T }>(typeof qui === "string" ? (qui === "anon" ? "anon" : { id: qui }) : qui, sql, params))[0].r;
const lit = (qui: string, g: string) => r<boolean>(qui, "select public.peut_lire_groupe($1) as r", [g]);
const envoyer = (qui: string, g: string, texte = "Bonjour", o: { image?: string; reponse?: string } = {}) =>
  r<Message>(qui, "select public.envoyer_message_groupe($1, $2, $3, $4) as r", [g, texte, o.image ?? null, o.reponse ?? null]);
const fil = (qui: string, g: string, avant: string | null = null, limite = 50) =>
  r<{ messages: Message[]; plus_anciens: boolean }>(qui, "select public.messages_groupe($1, $2, $3) as r", [g, avant, limite]);
const mesGroupes = (qui: string) => r<Resume[]>(qui, "select public.mes_groupes() as r");
const notifications = async (qui: string) =>
  (await banc.db.query<{ categorie: string; titre: string; texte: string; lien: string }>("select categorie, titre, texte, lien from public.notifications where destinataire = $1 order by id", [qui])).rows;
const diffusions = async () => (await banc.db.query<{ topic: string; event: string }>("select topic, event from realtime.messages order by id")).rows;
const vieillir = (id: string, minutes: number) => banc.db.query(`update public.messages_groupes set cree_le = cree_le - make_interval(mins => $2) where id = $1`, [id, minutes]);

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0073"), MIGRATION]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [M, ["moderateur"]], [F, []], [G, []], [E, []], [AB, []], [L, []], [SU, []], [E2, []]] as const) {
    await banc.creerCompte(id, [...roles]);
  }
  await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [E]);
  await banc.db.query("update public.profils set prenom = 'Awa', nom = 'Kpadé' where id = $1", [E2]);
  for (const id of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [id]);
  const fiche = async (compte: string) => (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [compte])).id;
  ACAD = (await un<{ id: string }>("select id from public.parcours where slug = 'reussite-academique'")).id;
  DIGI = (await un<{ id: string }>("select id from public.parcours where slug = 'competences-digitales'")).id;
  excel = await creerFormation(banc, "Excel avancé", { formateur: await fiche(F), parcours: [ACAD], quiz: false, exercice: null });
  canva = await creerFormation(banc, "Canva", { formateur: await fiche(G), parcours: [DIGI], quiz: false, exercice: null });
  for (const id of [E, SU, E2]) await banc.en({ id }, "select public.s_inscrire_formation($1)", [excel.id]);
  await abonner(banc, AB);
  await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [SU]);
  await banc.db.query("update public.reglages_moderation set jeton = $1", [J]);
  for (const g of (await banc.db.query<{ id: string; slug: string }>("select id, slug from public.groupes")).rows) groupe[g.slug] = g.id;
}, 120_000);

beforeEach(async () => {
  await banc.db.query("delete from public.messages_groupes");
  await banc.db.query("delete from public.lectures_groupes");
  await banc.db.query("delete from public.groupes_coupes");
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from realtime.messages");
  await banc.db.query("update public.reglages_moderation set analyse_active = false");
});

describe("Les groupes de départ", () => {
  it("le Général et un groupe par parcours, chacun avec son adresse", async () => {
    const { rows } = await banc.db.query<{ slug: string; nom: string; type: string; actif: boolean }>(
      "select slug, nom, case when formation_id is not null then 'formation' when parcours_id is not null then 'parcours' else 'general' end as type, actif from public.groupes order by slug",
    );
    expect(rows).toEqual([
      { slug: "business-revenus-en-ligne", nom: "Business & revenus en ligne", type: "parcours", actif: true },
      { slug: "competences-digitales", nom: "Compétences digitales", type: "parcours", actif: true },
      { slug: "general", nom: "Général", type: "general", actif: true },
      { slug: "reussite-academique", nom: "Réussite académique", type: "parcours", actif: true },
    ]);
  });

  it("un groupe suit son parcours : créé, renommé, désactivé avec lui", async () => {
    const id = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur) values ('langues', 'Langues', 'Langues', 'digital') returning id")).id;
    const lu = async () => un<{ slug: string; nom: string; actif: boolean }>("select slug, nom, actif from public.groupes where parcours_id = $1", [id]);
    expect(await lu()).toEqual({ slug: "langues", nom: "Langues", actif: true });
    await banc.db.query("update public.parcours set nom = 'Langues étrangères', slug = 'langues-etrangeres' where id = $1", [id]);
    expect(await lu()).toEqual({ slug: "langues-etrangeres", nom: "Langues étrangères", actif: true });
    await banc.db.query("update public.parcours set actif = false where id = $1", [id]);
    expect((await lu()).actif).toBe(false);
    const g = (await un<{ id: string }>("select id from public.groupes where parcours_id = $1", [id])).id;
    expect(await lit(A, g)).toBe(false);
    await banc.db.query("delete from public.parcours where id = $1", [id]);
    expect(await lu()).toBeUndefined();
  });

  it("la migration rejouée ne casse rien et ne double aucun groupe", async () => {
    await envoyer(E, groupe.general, "Avant de rejouer");
    await banc.appliquer(MIGRATION);
    const { rows } = await banc.db.query<{ n: number }>("select count(*)::int as n from public.groupes where formation_id is null");
    expect(rows[0].n).toBe(4);
    expect((await fil(E, groupe.general)).messages.map((m) => m.texte)).toEqual(["Avant de rejouer"]);
  });
});

describe("Qui entre dans un groupe", () => {
  it("le Général : tout compte connecté non suspendu", async () => {
    for (const qui of [E, AB, L, F, M, A]) expect(await lit(qui, groupe.general)).toBe(true);
    expect(await lit(SU, groupe.general)).toBe(false);
    expect(await r<boolean>("anon", "select public.peut_lire_groupe($1) as r", [groupe.general])).toBe(false);
  });

  it("le groupe d'un parcours : équipe, abonnés, formateur d'une formation du parcours, inscrits", async () => {
    const acad = groupe["reussite-academique"];
    const vus = await Promise.all([E, AB, F, M, A, S, L, G, SU].map((qui) => lit(qui, acad)));
    expect(vus).toEqual([true, true, true, true, true, true, false, false, false]);
    expect(await lit(G, groupe["competences-digitales"])).toBe(true);
    expect(await lit(E, groupe["competences-digitales"])).toBe(false);
    await expect(envoyer(L, acad)).rejects.toThrow(FERME);
    await expect(envoyer(SU, groupe.general)).rejects.toThrow();
  });

  it("mes_groupes : ceux qui me sont ouverts, le Général d'abord", async () => {
    expect((await mesGroupes(E)).map((g) => g.slug)).toEqual(["general", "reussite-academique"]);
    expect((await mesGroupes(L)).map((g) => g.slug)).toEqual(["general"]);
    expect((await mesGroupes(AB)).map((g) => g.slug)).toEqual(["general", "reussite-academique", "competences-digitales", "business-revenus-en-ligne"]);
  });

  it("groupe_par_slug : la raison du refus, pour proposer les abonnements", async () => {
    const vu = await r<{ ouvert: boolean; raison: string | null; membres?: number }>(L, "select public.groupe_par_slug('reussite-academique') as r");
    expect(vu).toMatchObject({ ouvert: false, raison: "abonnement" });
    expect(vu.membres).toBeUndefined();
    expect(await r<{ raison: string }>(G, "select public.groupe_par_slug('reussite-academique') as r")).toMatchObject({ ouvert: false, raison: "formateur" });
    expect(await r<{ ouvert: boolean; peut_moderer: boolean }>(F, "select public.groupe_par_slug('reussite-academique') as r")).toMatchObject({ ouvert: true, peut_moderer: true });
    expect(await r<{ peut_moderer: boolean }>(F, "select public.groupe_par_slug('general') as r")).toMatchObject({ ouvert: true, peut_moderer: false });
    expect(await r<unknown>(E, "select public.groupe_par_slug('inconnu') as r")).toBeNull();
  });

  it("membres_groupe : le nombre de comptes qui y ont accès", async () => {
    // Équipe (S, A, M), formateur F, inscrits E et E2 (SU est suspendu), abonnée AB.
    expect(await r<number>(E, "select public.membres_groupe($1) as r", [groupe["reussite-academique"]])).toBe(7);
    await expect(r<number>(L, "select public.membres_groupe($1) as r", [groupe["reussite-academique"]])).rejects.toThrow(FERME);
  });

  it("peut_lire_espace suit désormais les inscriptions, plus les leçons ouvertes", async () => {
    // L ouvre une leçon d'Excel sans s'inscrire : l'espace du parcours reste fermé.
    await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2) on conflict do nothing", [L, excel.lecons[0]]);
    expect(await r<boolean>(L, "select public.peut_lire_espace($1) as r", [ACAD])).toBe(false);
    expect(await r<boolean>(E, "select public.peut_lire_espace($1) as r", [ACAD])).toBe(true);
    expect(await r<boolean>(E, "select public.peut_lire_espace($1) as r", [DIGI])).toBe(false);
    expect(await r<boolean>(AB, "select public.peut_lire_espace($1) as r", [DIGI])).toBe(true);
    expect(await r<boolean>(G, "select public.peut_lire_espace($1) as r", [DIGI])).toBe(true);
    expect(await r<boolean>(E, "select public.peut_lire_espace(null) as r")).toBe(true);
  });
});

describe("Écrire", () => {
  it("un message paraît dans le fil, avec l'auteur et son badge", async () => {
    const m = await envoyer(F, groupe["reussite-academique"], "  Bienvenue à tous  ");
    expect(m).toMatchObject({ texte: "Bienvenue à tous", de_moi: true, supprime: false, retire: false, analyser: false });
    const vu = (await fil(E, groupe["reussite-academique"])).messages;
    expect(vu).toHaveLength(1);
    expect(vu[0]).toMatchObject({ id: m.id, de_moi: false, auteur: { id: F, badge: "formateur" } });
    await envoyer(A, groupe["reussite-academique"], "Et l'équipe aussi");
    expect((await fil(E, groupe["reussite-academique"])).messages.map((x) => x.auteur.badge)).toEqual(["formateur", "equipe"]);
  });

  it("un texte vide ou trop long est refusé", async () => {
    await expect(envoyer(E, groupe.general, "   ")).rejects.toThrow("Écrivez un message ou ajoutez une image.");
    await expect(envoyer(E, groupe.general, "a".repeat(2001))).rejects.toThrow("2 000 caractères");
    expect((await envoyer(E, groupe.general, "a".repeat(2000))).texte).toHaveLength(2000);
  });

  it("20 messages par minute au plus", async () => {
    for (let i = 0; i < 20; i++) await envoyer(E, groupe.general, `Message ${i}`);
    await expect(envoyer(E, groupe.general, "Un de trop")).rejects.toThrow("Patientez une minute");
    // Les autres comptes ne sont pas touchés ; une minute plus tard, c'est reparti.
    expect(await envoyer(E2, groupe.general, "Moi aussi")).toBeTruthy();
    await banc.db.query("update public.messages_groupes set cree_le = cree_le - interval '61 seconds' where auteur_id = $1", [E]);
    expect(await envoyer(E, groupe.general, "Me revoilà")).toBeTruthy();
  });

  it("une image : déposée dans son dossier de l'espace « groupes », 5 Mo au plus, JPEG, PNG ou WebP", async () => {
    const deposer = (chemin: string, type: string, taille: number, owner = E) =>
      banc.db.query("insert into storage.objects (bucket_id, name, owner, metadata) values ('groupes', $1, $2, $3)", [chemin, owner, { mimetype: type, size: taille }]);
    const bon = `${E}/${randomUUID()}.jpg`;
    await deposer(bon, "image/jpeg", 120_000);
    const m = await envoyer(E, groupe.general, "", { image: bon });
    expect(m.image).toEqual({ chemin: bon, type: "image/jpeg" });
    await expect(envoyer(E, groupe.general, "", { image: bon })).rejects.toThrow("Cette image n’a pas été reçue");
    const lourde = `${E}/${randomUUID()}.png`;
    await deposer(lourde, "image/png", 6_000_000);
    await expect(envoyer(E, groupe.general, "", { image: lourde })).rejects.toThrow("5 Mo");
    const pdf = `${E}/${randomUUID()}.pdf`;
    await deposer(pdf, "application/pdf", 1000);
    await expect(envoyer(E, groupe.general, "", { image: pdf })).rejects.toThrow("JPEG, PNG ou WebP");
    const autre = `${E2}/${randomUUID()}.jpg`;
    await deposer(autre, "image/jpeg", 1000, E2);
    await expect(envoyer(E, groupe.general, "", { image: autre })).rejects.toThrow("Cette image n’a pas été reçue");
    // L'image d'un message se lit par les membres du groupe ; celle d'un groupe fermé, non.
    const visible = async (qui: string, chemin: string) =>
      (await banc.en<{ n: number }>({ id: qui }, "select count(*)::int as n from storage.objects where bucket_id = 'groupes' and name = $1", [chemin]))[0].n;
    expect(await visible(L, bon)).toBe(1);
    const acad = `${E}/${randomUUID()}.webp`;
    await deposer(acad, "image/webp", 1000);
    await envoyer(E, groupe["reussite-academique"], "Capture", { image: acad });
    expect(await visible(E2, acad)).toBe(1);
    expect(await visible(L, acad)).toBe(0);
  });

  it("répondre cite le message, et prévient son auteur (pas soi-même, ni s'il a coupé le groupe)", async () => {
    const question = await envoyer(E, groupe["reussite-academique"], "Comment figer une ligne dans Excel ?");
    const reponse = await envoyer(E2, groupe["reussite-academique"], "Affichage, puis Figer les volets", { reponse: question.id });
    expect(reponse.reponse).toMatchObject({ id: question.id, texte: "Comment figer une ligne dans Excel ?", auteur: { prenom: "Koffi" } });
    expect(await notifications(E)).toEqual([
      {
        categorie: "communaute",
        titre: "Nouvelle réponse dans le groupe Réussite académique",
        texte: "Awa K. a répondu à votre message : « Affichage, puis Figer les volets »",
        lien: `/groupes/reussite-academique?message=${reponse.id}`,
      },
    ]);
    // Se répondre à soi-même : rien.
    await envoyer(E, groupe["reussite-academique"], "Merci !", { reponse: question.id });
    expect(await notifications(E)).toHaveLength(1);
    // Groupe coupé : rien non plus.
    expect(await r<boolean>(E, "select public.couper_groupe($1, true) as r", [groupe["reussite-academique"]])).toBe(true);
    await envoyer(A, groupe["reussite-academique"], "Bonne question", { reponse: question.id });
    expect(await notifications(E)).toHaveLength(1);
    // Le formateur reçoit le lien de son espace.
    const annonce = await envoyer(F, groupe["reussite-academique"], "Session demain");
    await envoyer(E2, groupe["reussite-academique"], "J'y serai", { reponse: annonce.id });
    expect((await notifications(F))[0].lien).toMatch(/^\/formateur\/groupes\/reussite-academique\?message=/);
    // Une réponse à un message d'un autre groupe : refusée.
    await expect(envoyer(E, groupe.general, "Hors sujet", { reponse: question.id })).rejects.toThrow("Ce message n’existe plus.");
  });

  it("modifier son message pendant 15 minutes, pas celui d'un autre", async () => {
    const m = await envoyer(E, groupe.general, "Bonjour à tous");
    const modifie = await r<Message>(E, "select public.modifier_message_groupe($1, $2) as r", [m.id, "Bonsoir à tous"]);
    expect(modifie).toMatchObject({ texte: "Bonsoir à tous" });
    expect(modifie.modifie_le).not.toBeNull();
    await expect(r(E2, "select public.modifier_message_groupe($1, 'Pirate') as r", [m.id])).rejects.toThrow("Ce message n’est pas le vôtre.");
    await vieillir(m.id, 16);
    await expect(r(E, "select public.modifier_message_groupe($1, 'Trop tard') as r", [m.id])).rejects.toThrow("15 minutes");
  });

  it("supprimer : l'auteur ; le formateur et l'équipe dans le groupe de leurs parcours ; « Message supprimé » reste", async () => {
    const supprimer = (qui: string, id: string) => r<string | null>(qui, "select public.supprimer_message_groupe($1) as r", [id]);
    const a = await envoyer(E, groupe["reussite-academique"], "Mon message");
    await expect(supprimer(E2, a.id)).rejects.toThrow("Vous ne pouvez pas supprimer ce message.");
    await supprimer(E, a.id);
    const vu = (await fil(E2, groupe["reussite-academique"])).messages[0];
    expect(vu).toMatchObject({ id: a.id, supprime: true, texte: "", image: null });
    const b = await envoyer(E, groupe["reussite-academique"], "Message déplacé");
    await supprimer(F, b.id);
    const c = await envoyer(E, groupe["reussite-academique"], "Encore un");
    await supprimer(M, c.id);
    // Un formateur ne modère pas le Général, ni le groupe d'un autre parcours.
    const d = await envoyer(E, groupe.general, "Au Général");
    await expect(supprimer(F, d.id)).rejects.toThrow("Vous ne pouvez pas supprimer ce message.");
    const e = await envoyer(AB, groupe["competences-digitales"], "Au digital");
    await expect(supprimer(F, e.id)).rejects.toThrow("Ce message n’existe plus.");
    await supprimer(A, d.id);
    // Une réponse à un message supprimé le cite comme supprimé.
    const f = await envoyer(E, groupe.general, "Question");
    const g = await envoyer(E2, groupe.general, "Réponse", { reponse: f.id });
    await supprimer(E, f.id);
    expect((await fil(E, groupe.general)).messages.find((x) => x.id === g.id)?.reponse).toMatchObject({ id: f.id, supprime: true, texte: "" });
  });

  it("supprimer un message avec image rend son chemin, à effacer du stockage par qui l'a supprimé", async () => {
    const chemin = `${E}/${randomUUID()}.jpg`;
    await banc.db.query("insert into storage.objects (bucket_id, name, owner, metadata) values ('groupes', $1, $2, $3)", [chemin, E, { mimetype: "image/jpeg", size: 1000 }]);
    const m = await envoyer(E, groupe["reussite-academique"], "", { image: chemin });
    expect(await r<string>(F, "select public.supprimer_message_groupe($1) as r", [m.id])).toBe(chemin);
    const efface = await banc.en<{ id: string }>({ id: F }, "delete from storage.objects where bucket_id = 'groupes' and name = $1 returning id", [chemin]);
    expect(efface).toHaveLength(1);
  });
});

describe("Réactions, épingle, lectures", () => {
  it("une réaction se met et s'enlève (bascule), six emojis permis", async () => {
    const m = await envoyer(E, groupe.general, "Bravo à tous");
    const reagir = (qui: string, emoji: string) => r<{ reactions: Message["reactions"] }>(qui, "select public.reagir_message_groupe($1, $2) as r", [m.id, emoji]);
    expect((await reagir(E2, "👍")).reactions).toEqual([{ emoji: "👍", nombre: 1, moi: true }]);
    await reagir(L, "👍");
    await reagir(L, "❤️");
    expect((await fil(E2, groupe.general)).messages[0].reactions).toEqual([
      { emoji: "👍", nombre: 2, moi: true },
      { emoji: "❤️", nombre: 1, moi: false },
    ]);
    expect((await reagir(E2, "👍")).reactions).toEqual([
      { emoji: "👍", nombre: 1, moi: false },
      { emoji: "❤️", nombre: 1, moi: false },
    ]);
    await expect(reagir(E2, "🍕")).rejects.toThrow("Cette réaction n’est pas proposée.");
  });

  it("épingler : le formateur et l'équipe, un message par groupe", async () => {
    const a = await envoyer(E, groupe["reussite-academique"], "Les ressources du parcours");
    const b = await envoyer(E2, groupe["reussite-academique"], "Le calendrier");
    const epingler = (qui: string, id: string, oui = true) => r<null>(qui, "select public.epingler_message_groupe($1, $2) as r", [id, oui]);
    await expect(epingler(E, a.id)).rejects.toThrow("Seuls le formateur et l’équipe épinglent un message.");
    await epingler(F, a.id);
    expect(await r<{ epingle: { id: string } }>(E, "select public.groupe_par_slug('reussite-academique') as r")).toMatchObject({ epingle: { id: a.id } });
    await epingler(M, b.id);
    const vus = (await fil(E, groupe["reussite-academique"])).messages;
    expect(vus.map((x) => x.epingle)).toEqual([false, true]);
    await epingler(M, b.id, false);
    expect(await r<{ epingle: unknown }>(E, "select public.groupe_par_slug('reussite-academique') as r")).toMatchObject({ epingle: null });
  });

  it("les non-lus : ce que les autres ont écrit depuis ma dernière lecture", async () => {
    const acad = groupe["reussite-academique"];
    await envoyer(E, acad, "Premier");
    const deux = await envoyer(E2, acad, "Deuxième");
    const trois = await envoyer(F, acad, "Troisième");
    const nonLus = async (qui: string) => (await mesGroupes(qui)).find((g) => g.id === acad)?.non_lus;
    expect(await nonLus(E)).toBe(2);
    expect(await r<number>(E, "select public.marquer_groupe_lu($1, $2) as r", [acad, deux.id])).toBe(1);
    expect(await nonLus(E)).toBe(1);
    // Revenir en arrière ne remet rien en non lu.
    await r(E, "select public.marquer_groupe_lu($1, $2) as r", [acad, trois.id]);
    await r(E, "select public.marquer_groupe_lu($1, $2) as r", [acad, deux.id]);
    expect(await nonLus(E)).toBe(0);
    // Écrire marque le groupe lu jusqu'à son message.
    await envoyer(E2, acad, "Quatrième");
    await envoyer(E, acad, "Cinquième");
    expect(await nonLus(E)).toBe(0);
    const resume = (await mesGroupes(E2)).find((g) => g.id === acad);
    expect(resume).toMatchObject({ non_lus: 1, coupe: false, dernier: { texte: "Cinquième", de_moi: false } });
    // Un message d'un autre groupe ne se marque pas ici.
    await expect(r(E, "select public.marquer_groupe_lu($1, $2) as r", [groupe.general, deux.id])).rejects.toThrow("Ce message n’existe plus.");
  });

  it("le fil se lit par pages de 50, les plus récents en bas", async () => {
    for (let i = 1; i <= 55; i++) {
      await banc.db.query("insert into public.messages_groupes (groupe_id, auteur_id, texte, cree_le) values ($1, $2, $3, now() - make_interval(secs => $4))", [
        groupe.general,
        E,
        `M${i}`,
        100 - i,
      ]);
    }
    const page = await fil(E2, groupe.general);
    expect(page.messages).toHaveLength(50);
    expect(page.plus_anciens).toBe(true);
    expect(page.messages[0].texte).toBe("M6");
    expect(page.messages.at(-1)?.texte).toBe("M55");
    const avant = await fil(E2, groupe.general, page.messages[0].id);
    expect(avant.messages.map((m) => m.texte)).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    expect(avant.plus_anciens).toBe(false);
    await expect(fil(L, groupe["reussite-academique"])).rejects.toThrow(FERME);
  });
});

describe("Le temps réel", () => {
  it("chaque message, modification, suppression, réaction et épingle prévient le sujet du groupe", async () => {
    const sujet = `groupe:${groupe.general}`;
    const m = await envoyer(E, groupe.general, "Salut");
    expect(await diffusions()).toEqual([{ topic: sujet, event: "message" }]);
    await banc.db.query("delete from realtime.messages");
    await r(E, "select public.modifier_message_groupe($1, 'Salut à tous') as r", [m.id]);
    await r(E2, "select public.reagir_message_groupe($1, '😂') as r", [m.id]);
    await r(A, "select public.epingler_message_groupe($1, true) as r", [m.id]);
    await r(E, "select public.supprimer_message_groupe($1) as r", [m.id]);
    expect(await diffusions()).toEqual(Array(4).fill({ topic: sujet, event: "changement" }));
    // Rien du contenu ne passe par là.
    const { rows } = await banc.db.query<{ payload: unknown }>("select payload from realtime.messages");
    expect(rows.every((x) => JSON.stringify(x.payload) === "{}")).toBe(true);
  });

  it("seuls les membres du groupe s'abonnent à son sujet", async () => {
    await envoyer(E, groupe["reussite-academique"], "Bonjour");
    const voit = async (qui: string, sujet: string) => {
      await banc.db.query("select set_config('realtime.topic', $1, false)", [sujet]);
      const [x] = await banc.en<{ n: number }>({ id: qui }, "select count(*)::int as n from realtime.messages");
      await banc.db.query("select set_config('realtime.topic', '', false)");
      return x.n > 0;
    };
    const sujet = `groupe:${groupe["reussite-academique"]}`;
    expect(await voit(E, sujet)).toBe(true);
    expect(await voit(F, sujet)).toBe(true);
    expect(await voit(L, sujet)).toBe(false);
    expect(await voit(SU, sujet)).toBe(false);
    expect(await voit(E, "groupe:pas-un-identifiant")).toBe(false);
  });
});

describe("La modération", () => {
  const file = async (onglet = "a_examiner") => r<{ type: string; id: string; lien: string; statut: string; signalements: { nombre: number } }[]>(A, "select public.file_moderation($1) as r", [onglet]);

  it("un signalement met le message dans la file de l'équipe ; « Garder » l'en sort", async () => {
    const m = await envoyer(E, groupe.general, "Achetez mes cours sur ce site !");
    const signaler = (qui: string, motif = "spam", precisions = "") => r(qui, "select public.signaler_message_groupe($1, $2, $3) as r", [m.id, motif, precisions]);
    await expect(signaler(E)).rejects.toThrow("Vous ne pouvez pas signaler votre propre contenu.");
    await expect(signaler(A)).rejects.toThrow("L’équipe modère depuis la file.");
    await signaler(E2);
    await expect(signaler(E2)).rejects.toThrow("Vous avez déjà signalé ce contenu.");
    const element = (await file()).find((e) => e.id === m.id);
    expect(element).toMatchObject({ type: "message_groupe", lien: `/groupes/general?message=${m.id}`, statut: "publiee", signalements: { nombre: 1 } });
    expect(await r<number>(A, "select public.nombre_a_examiner() as r")).toBeGreaterThanOrEqual(1);
    expect((await notifications(A)).some((n) => n.titre === "À modérer")).toBe(true);
    await r(M, "select public.garder_message_groupe($1) as r", [m.id]);
    expect((await file()).some((e) => e.id === m.id)).toBe(false);
  });

  it("« Supprimer » depuis la file : retiré par la modération, son auteur prévenu", async () => {
    const m = await envoyer(E, groupe.general, "Insulte");
    await r(E2, "select public.signaler_message_groupe($1, 'harcelement', '') as r", [m.id]);
    await r(A, "select public.retirer_message_groupe($1) as r", [m.id]);
    expect((await fil(E2, groupe.general)).messages[0]).toMatchObject({ retire: true, texte: "" });
    expect((await file()).some((e) => e.id === m.id)).toBe(false);
    expect((await notifications(E)).map((n) => n.titre)).toEqual(["Message retiré"]);
    await expect(r(E, "select public.retirer_message_groupe($1) as r", [m.id])).rejects.toThrow("Réservé à l’équipe.");
  });

  it("analyse active : le message paraît, puis le verdict bloquer le retire, prévient l'auteur et le met dans « Bloquées »", async () => {
    await banc.db.query("update public.reglages_moderation set analyse_active = true");
    const m = await envoyer(E, groupe.general, "Arnaque garantie");
    expect(m.analyser).toBe(true);
    expect((await fil(E2, groupe.general)).messages[0].texte).toBe("Arnaque garantie");
    const verdict = (qui: string, analyse: Record<string, unknown>) => r<{ decision: string }>(qui, "select public.verdict_message_groupe($1, $2) as r", [m.id, analyse]);
    await expect(verdict(E, { jeton: "faux", decision: "bloquer", categorie: "arnaque", raison: "x", version: 1 })).rejects.toThrow("Verdict refusé.");
    await expect(verdict(E2, { jeton: J, decision: "bloquer", categorie: "arnaque", raison: "x", version: 1 })).rejects.toThrow("Verdict refusé.");
    expect(await verdict(E, { jeton: J, decision: "bloquer", categorie: "arnaque", raison: "Promesse de gain", version: 1 })).toEqual({ decision: "bloquer" });
    expect((await fil(E2, groupe.general)).messages[0]).toMatchObject({ retire: true, texte: "" });
    expect((await notifications(E)).map((n) => n.titre)).toEqual(["Message retiré"]);
    expect((await file("bloquees")).find((e) => e.id === m.id)).toMatchObject({ type: "message_groupe", statut: "bloquee" });
    // Rétabli par l'équipe : de nouveau visible, son auteur prévenu.
    await r(A, "select public.retablir_message_groupe($1) as r", [m.id]);
    expect((await fil(E2, groupe.general)).messages[0]).toMatchObject({ retire: false, texte: "Arnaque garantie" });
    expect((await file("bloquees")).some((e) => e.id === m.id)).toBe(false);
  });

  it("verdict « signaler » ou analyse impossible : dans « À examiner » ; un verdict d'une ancienne version est ignoré", async () => {
    await banc.db.query("update public.reglages_moderation set analyse_active = true");
    const m = await envoyer(E, groupe.general, "Lien douteux");
    await r(E, "select public.modifier_message_groupe($1, 'Lien douteux, corrigé') as r", [m.id]);
    expect(await r<{ decision: string | null }>(E, "select public.verdict_message_groupe($1, $2) as r", [m.id, { jeton: J, decision: "bloquer", categorie: "spam", raison: "x", version: 1 }])).toEqual({
      decision: null,
    });
    expect((await fil(E2, groupe.general)).messages[0].retire).toBe(false);
    await r(E, "select public.verdict_message_groupe($1, $2) as r", [m.id, { jeton: J, decision: "signaler", categorie: "spam", raison: "Lien inconnu", version: 2 }]);
    expect((await file()).find((e) => e.id === m.id)).toMatchObject({ type: "message_groupe" });
    // Un message resté sans verdict plus de 5 minutes entre aussi dans la file.
    const sans = await envoyer(E2, groupe.general, "Pas encore analysé");
    expect((await file()).some((e) => e.id === sans.id)).toBe(false);
    await vieillir(sans.id, 6);
    expect((await file()).some((e) => e.id === sans.id)).toBe(true);
  });
});

describe("Les groupes par formation", () => {
  const activer = (qui: string, formation: FormationTest, actif = true) =>
    r<{ slug: string; actif: boolean }>(qui, "select public.activer_groupe_formation($1, $2) as r", [formation.id, actif]);
  const groupeDe = async (formation: FormationTest) => (await un<{ id: string } | undefined>("select id from public.groupes where formation_id = $1", [formation.id]))?.id;
  const etat = (qui: string, formation: FormationTest) => r<{ actif: boolean; slug: string | null; ouvert: boolean; peut_regler: boolean }>(qui, "select public.groupe_formation($1) as r", [formation.id]);

  it("désactivé par défaut, pour toute formation", async () => {
    expect(await groupeDe(excel)).toBeUndefined();
    expect(await etat(E, excel)).toEqual({ actif: false, slug: null, ouvert: false, peut_regler: false });
    expect(await etat(F, excel)).toMatchObject({ actif: false, peut_regler: true });
  });

  it("le formateur de la formation et l'équipe des contenus l'activent ; un autre formateur, un étudiant ou un modérateur, non", async () => {
    await expect(activer(G, excel)).rejects.toThrow("Seuls le formateur de la formation et l’équipe règlent son groupe.");
    await expect(activer(E, excel)).rejects.toThrow("Seuls le formateur de la formation et l’équipe règlent son groupe.");
    await expect(activer(M, excel)).rejects.toThrow("Seuls le formateur de la formation et l’équipe règlent son groupe.");
    expect(await activer(F, excel)).toEqual({ slug: excel.slug, actif: true });
    expect(await activer(A, canva)).toEqual({ slug: canva.slug, actif: true });
    expect(await un<{ nom: string }>("select nom from public.groupes where formation_id = $1", [excel.id])).toEqual({ nom: "Excel avancé" });
  });

  it("un inscrit lit et écrit ; un abonné non inscrit est refusé ; le formateur modère", async () => {
    await activer(F, excel);
    const g = (await groupeDe(excel))!;
    for (const [qui, attendu] of [[E, true], [F, true], [M, true], [A, true], [AB, false], [L, false], [G, false], [SU, false]] as const) expect(await lit(qui, g)).toBe(attendu);
    const m = await envoyer(E, g, "Une question sur le module 1");
    await expect(envoyer(AB, g, "Et moi ?")).rejects.toThrow(FERME);
    expect(await etat(E, excel)).toEqual({ actif: true, slug: excel.slug, ouvert: true, peut_regler: false });
    expect(await etat(AB, excel)).toMatchObject({ actif: true, ouvert: false });
    const mes = await mesGroupes(E);
    expect(mes.find((x) => x.id === g)).toMatchObject({ type: "formation", nom: "Excel avancé", actif: true });
    await r(F, "select public.epingler_message_groupe($1, true) as r", [m.id]);
    await r(F, "select public.supprimer_message_groupe($1) as r", [m.id]);
    expect(await r<{ raison: string }>(AB, "select public.groupe_par_slug($1) as r", [excel.slug])).toMatchObject({ ouvert: false, raison: "inscription" });
  });

  it("désactivé : caché aux étudiants, ses messages gardés ; l'équipe et le formateur le voient « Désactivé » ; réactivé tel quel", async () => {
    await activer(F, excel);
    const g = (await groupeDe(excel))!;
    await envoyer(E, g, "Gardé au chaud");
    await activer(F, excel, false);
    expect(await lit(E, g)).toBe(false);
    expect((await mesGroupes(E)).some((x) => x.id === g)).toBe(false);
    await expect(envoyer(E, g, "Encore là ?")).rejects.toThrow(FERME);
    expect(await r<{ ouvert: boolean; raison: string }>(E, "select public.groupe_par_slug($1) as r", [excel.slug])).toMatchObject({ ouvert: false, raison: "desactive" });
    expect((await mesGroupes(F)).find((x) => x.id === g)).toMatchObject({ actif: false });
    expect((await mesGroupes(A)).find((x) => x.id === g)).toMatchObject({ actif: false });
    await expect(envoyer(F, g, "Personne ne lira")).rejects.toThrow("Ce groupe est désactivé.");
    // Pas de notification de réponse pour un étudiant d'un groupe désactivé : personne n'y écrit.
    await activer(F, excel, true);
    expect((await fil(E, g)).messages.map((m) => m.texte)).toEqual(["Gardé au chaud"]);
  });

  it("le nom du groupe suit le titre de la formation", async () => {
    await activer(F, excel);
    await banc.db.query("update public.formations set titre = 'Excel pour tous' where id = $1", [excel.id]);
    expect(await un<{ nom: string; slug: string }>("select nom, slug from public.groupes where formation_id = $1", [excel.id])).toEqual({ nom: "Excel pour tous", slug: excel.slug });
    await banc.db.query("update public.formations set titre = 'Excel avancé' where id = $1", [excel.id]);
  });
});
