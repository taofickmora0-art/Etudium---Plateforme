import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0018 : sessions live (spec 2026-10-14-evenements-sessions-live). Le formateur et l'équipe les programment ;
// tout compte connecté les voit et s'y inscrit ; le lien n'est livré que de 10 min avant le début jusqu'à la fin.
const MIGRATION = "supabase/migrations/0018_sessions_live.sql";
const REFUS = /row-level security|permission denied/;
const ACCES = "Accès réservé aux formateurs et à l’équipe.";

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const F = randomUUID(); // formateur « Mireille Akpo », fiche FA
const G = randomUUID(); // formateur, fiche FG
const E1 = randomUUID(); // « Fifamè Adjovi »
const E2 = randomUUID(); // a coupé « Sessions live »
let FA: string;
let FG: string;
let P: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
type Recue = { categorie: string; titre: string; texte: string; lien: string | null };
const recues = async (compte: string) =>
  (await banc.db.query<Recue>("select categorie, titre, texte, lien from public.notifications where destinataire = $1 order by id", [compte])).rows;
const toutEffacer = () => banc.db.query("delete from public.notifications");
const quand = async (id: string) => (await un<{ q: string }>("select public.quand_session(debut) as q from public.sessions_live where id = $1", [id])).q;
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Une session posée directement (débuts proches ou passés), par rapport à now(). */
async function session(debutDans: string, o: { titre?: string; duree?: number; lien?: string; formateur?: string | null; statut?: string } = {}) {
  return (
    await un<{ id: string }>(
      `insert into public.sessions_live (titre, debut, duree_minutes, lien, formateur_id, statut, cree_par)
       values ($1, now() + $2::interval, $3, $4, $5, $6, $7) returning id`,
      [o.titre ?? "Session", debutDans, o.duree ?? 60, o.lien ?? "https://meet.google.com/abc-defg-hij", o.formateur === undefined ? FA : o.formateur, o.statut ?? "programmee", F],
    )
  ).id;
}
const inscrire = (compte: string, id: string, rappels = false) =>
  banc.db.query(
    "insert into public.inscriptions_sessions (session_id, profil_id, rappel_veille_le, rappel_heure_le) values ($1, $2, case when $3 then now() end, case when $3 then now() end)",
    [id, compte, rappels],
  );
type Creation = { titre?: string; description?: string; debutDans?: string; duree?: number; lien?: string; parcours?: string | null; formateur?: string | null };
const creer = async (qui: string, c: Creation = {}) =>
  (
    await banc.en<{ id: string }>(
      { id: qui },
      "select public.creer_session($1, $2, now() + $3::interval, $4, $5, $6, $7) as id",
      [c.titre ?? "Excel avancé", c.description ?? "", c.debutDans ?? "2 days", c.duree ?? 60, c.lien ?? "https://meet.google.com/abc-defg-hij", c.parcours ?? null, c.formateur ?? null],
    )
  )[0].id;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    "supabase/migrations/0004_contenus.sql",
    "supabase/migrations/0005_back_office.sql",
    "supabase/migrations/0006_notes.sql",
    "supabase/migrations/0007_visionnage.sql",
    "supabase/migrations/0008_progression.sql",
    "supabase/migrations/0009_favoris.sql",
    "supabase/migrations/0010_avis.sql",
    "supabase/migrations/0011_statistiques.sql",
    "supabase/exemples/lot-1.sql",
    "supabase/migrations/0012_couvertures.sql",
    "supabase/migrations/0013_utilisateurs.sql",
    "supabase/migrations/0014_espace_formateur.sql",
    "supabase/migrations/0015_suivi_etudiants.sql",
    "supabase/migrations/0016_notifications.sql",
    "supabase/migrations/0017_role_unique.sql",
    MIGRATION,
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [G, []], [E1, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [F]);
  await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Adjovi' where id = $1", [E1]);
  await banc.db.query("update public.profils set preferences_notifications = preferences_notifications || '{\"sessions_live\": false}'::jsonb where id = $1", [E2]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FG = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [G])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur) values ($1, 'Réussite académique', 'Académique', 'academique') returning id", [`p-${randomUUID()}`])).id;
});

describe("Outils", () => {
  it("plateforme_session : Google Meet, Zoom (sous-domaine compris), sinon En ligne", async () => {
    const p = async (lien: string) => (await un<{ p: string }>("select public.plateforme_session($1) as p", [lien])).p;
    expect(await p("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
    expect(await p("https://zoom.us/j/123")).toBe("Zoom");
    expect(await p("https://us02web.zoom.us/j/123?pwd=x")).toBe("Zoom");
    expect(await p("https://zoom.us.ailleurs.com/j/1")).toBe("En ligne");
    expect(await p("https://teams.microsoft.com/l/x")).toBe("En ligne");
  });

  it("quand_session : « samedi 24 octobre à 15 h 00 » ; 23 h 30 UTC le 24 est « dimanche 25 octobre à 0 h 30 »", async () => {
    const q = async (iso: string) => (await un<{ q: string }>("select public.quand_session($1::timestamptz) as q", [iso])).q;
    expect(await q("2026-10-24T14:00:00Z")).toBe("samedi 24 octobre à 15 h 00");
    expect(await q("2026-10-24T23:30:00Z")).toBe("dimanche 25 octobre à 0 h 30");
    expect(await q("2026-08-03T08:05:00Z")).toBe("lundi 3 août à 9 h 05");
  });

  it("notifier : la version à 5 paramètres écarte toujours l'auteur ; avec p_auteur_inclus, non", async () => {
    await toutEffacer();
    const appel = (sql: string) =>
      banc.db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [E1]);
        return (await tx.query<{ n: number }>(sql, [`{${E1}}`])).rows[0].n;
      });
    expect(await appel("select public.notifier($1::uuid[], 'sessions_live', 'Titre', '', null) as n")).toBe(0);
    expect(await appel("select public.notifier($1::uuid[], 'sessions_live', 'Titre', '', null, true) as n")).toBe(1);
    await expect(banc.en({ id: E1 }, "select public.notifier(array[$1]::uuid[], 'sessions_live', 'x', '', null, true)", [E1])).rejects.toThrow(REFUS);
  });
});

describe("Programmer, modifier, annuler", () => {
  it("un formateur crée : sa fiche est l'animateur même s'il en donne une autre ; « Nouvelle session live : … » à tous sauf lui et E2", async () => {
    await toutEffacer();
    const id = await creer(F, { titre: "  Excel avancé  ", formateur: FG, parcours: P });
    expect(await un("select titre, formateur_id, parcours_id, cree_par from public.sessions_live where id = $1", [id])).toEqual({ titre: "Excel avancé", formateur_id: FA, parcours_id: P, cree_par: F });
    const attendue = { categorie: "sessions_live", titre: "Nouvelle session live : Excel avancé", texte: `${majuscule(await quand(id))}, avec Mireille Akpo.`, lien: "/evenements" };
    for (const compte of [E1, A, G, S]) expect(await recues(compte)).toEqual([attendue]);
    expect(await recues(F)).toEqual([]);
    expect(await recues(E2)).toEqual([]);
  });

  it("l'équipe crée avec l'animateur choisi, ou Équipe Étudium", async () => {
    await toutEffacer();
    const avec = await creer(A, { formateur: FG });
    expect((await un<{ formateur_id: string }>("select formateur_id from public.sessions_live where id = $1", [avec])).formateur_id).toBe(FG);
    const sans = await creer(A, { titre: "Bienvenue" });
    expect((await un<{ formateur_id: string | null }>("select formateur_id from public.sessions_live where id = $1", [sans])).formateur_id).toBeNull();
    expect((await recues(E1)).map((n) => n.texte)[1]).toBe(`${majuscule(await quand(sans))}, avec Équipe Étudium.`);
  });

  it("refus : étudiant ; date dans 9 min ou dans plus d'un an ; durée 20 ou 50 ; lien http ; titre vide ; description trop longue", async () => {
    await expect(creer(E1)).rejects.toThrow(ACCES);
    await expect(creer(F, { debutDans: "9 minutes" })).rejects.toThrow("Choisissez une date au moins 10 minutes dans le futur.");
    await expect(creer(F, { debutDans: "400 days" })).rejects.toThrow("Choisissez une date dans l’année qui vient.");
    for (const duree of [20, 50, 255]) await expect(creer(F, { duree })).rejects.toThrow("Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure.");
    await expect(creer(F, { lien: "http://meet.google.com/abc" })).rejects.toThrow("Le lien doit commencer par https://");
    await expect(creer(F, { titre: "   " })).rejects.toThrow("Écrivez un titre (120 caractères au plus).");
    await expect(creer(F, { description: "x".repeat(1001) })).rejects.toThrow("La description dépasse 1 000 caractères.");
    expect(await creer(F, { debutDans: "15 minutes", duree: 240 })).toBeTruthy();
  });

  it("modifier le titre : personne n'est prévenu, rappels gardés ; modifier l'heure : les inscrits seulement, rappels remis à zéro", async () => {
    const id = await creer(F, { titre: "Word" });
    await inscrire(E1, id, true);
    await toutEffacer();
    const debut = (await un<{ debut: string }>("select debut::text from public.sessions_live where id = $1", [id])).debut;
    const modifier = (titre: string, debutSql: string, params: unknown[] = []) =>
      banc.en({ id: F }, `select public.modifier_session($1, $2, '', ${debutSql}, 60, 'https://meet.google.com/abc-defg-hij', null, null)`, [id, titre, ...params]);
    await modifier("Word, mise en page", "$3::timestamptz", [debut]);
    expect(await recues(E1)).toEqual([]);
    expect(await un("select rappel_veille_le is not null as v, rappel_heure_le is not null as h from public.inscriptions_sessions where session_id = $1", [id])).toEqual({ v: true, h: true });
    await modifier("Word, mise en page", "now() + interval '3 days'");
    expect(await recues(E1)).toEqual([{ categorie: "sessions_live", titre: "Session live modifiée", texte: `Word, mise en page : ${await quand(id)}.`, lien: "/evenements" }]);
    expect(await recues(G)).toEqual([]);
    expect(await un("select rappel_veille_le, rappel_heure_le from public.inscriptions_sessions where session_id = $1", [id])).toEqual({ rappel_veille_le: null, rappel_heure_le: null });
  });

  it("une session en cours se modifie (lien) ; terminée : refus ; G sur la session de F : refus ; un étudiant : refus", async () => {
    const enCours = await session("-10 minutes");
    const debut = (await un<{ debut: string }>("select debut::text from public.sessions_live where id = $1", [enCours])).debut;
    await banc.en({ id: F }, "select public.modifier_session($1, 'Session', '', $2::timestamptz, 60, 'https://zoom.us/j/9', null, null)", [enCours, debut]);
    expect((await un<{ lien: string }>("select lien from public.sessions_live where id = $1", [enCours])).lien).toBe("https://zoom.us/j/9");
    const finie = await session("-3 hours");
    await expect(banc.en({ id: F }, "select public.modifier_session($1, 'X', '', now() + interval '2 days', 60, 'https://zoom.us/j/9', null, null)", [finie])).rejects.toThrow("Une session terminée ne se modifie plus.");
    const futur = await session("2 days");
    await expect(banc.en({ id: G }, "select public.modifier_session($1, 'X', '', now() + interval '2 days', 60, 'https://zoom.us/j/9', null, null)", [futur])).rejects.toThrow("Cette session n’est pas la vôtre.");
    await expect(banc.en({ id: E1 }, "select public.modifier_session($1, 'X', '', now() + interval '2 days', 60, 'https://zoom.us/j/9', null, null)", [futur])).rejects.toThrow(ACCES);
  });

  it("annuler : « Session live annulée » aux inscrits ; annuler une session terminée : refus ; modifier une session annulée : refus", async () => {
    const id = await creer(F, { titre: "Canva" });
    await inscrire(E1, id);
    await toutEffacer();
    await banc.en({ id: F }, "select public.annuler_session($1)", [id]);
    expect(await un("select statut, annulee_le is not null as date from public.sessions_live where id = $1", [id])).toEqual({ statut: "annulee", date: true });
    expect(await recues(E1)).toEqual([{ categorie: "sessions_live", titre: "Session live annulée", texte: `Canva, prévue ${await quand(id)}.`, lien: "/evenements" }]);
    expect(await recues(G)).toEqual([]);
    await expect(banc.en({ id: F }, "select public.modifier_session($1, 'X', '', now() + interval '2 days', 60, 'https://zoom.us/j/9', null, null)", [id])).rejects.toThrow("Cette session est annulée.");
    const finie = await session("-3 hours");
    await expect(banc.en({ id: F }, "select public.annuler_session($1)", [finie])).rejects.toThrow("Une session terminée ne se modifie plus.");
  });
});

describe("Listes et fiche de l'animateur et de l'équipe", () => {
  it("sessions_animees et sessions_equipe : à venir et passées, inscriptions, animateur ; aucun « @ » dans le résultat", async () => {
    const venir = await session("5 days", { titre: "À venir de F" });
    const passee = await session("-5 days", { titre: "Passée de F" });
    const deG = await session("6 days", { titre: "À venir de G", formateur: FG });
    await inscrire(E1, venir);
    await inscrire(E2, venir);
    type Ligne = { id: string; titre: string; inscriptions: number; animateur: string; plateforme: string; statut: string };
    type Liste = { a_venir: Ligne[]; passees: Ligne[] };
    const [{ r: deF }] = await banc.en<{ r: Liste }>({ id: F }, "select public.sessions_animees() as r");
    expect(deF.a_venir.map((l) => l.id)).toContain(venir);
    expect(deF.a_venir.map((l) => l.id)).not.toContain(deG);
    expect(deF.passees.map((l) => l.id)).toContain(passee);
    expect(deF.a_venir.find((l) => l.id === venir)).toMatchObject({ titre: "À venir de F", inscriptions: 2, animateur: "Mireille Akpo", plateforme: "Google Meet", statut: "programmee" });
    expect(Object.keys(deF.a_venir[0]).sort()).toEqual(["animateur", "debut", "duree_minutes", "id", "inscriptions", "parcours", "plateforme", "statut", "titre"]);
    expect(JSON.stringify(deF)).not.toContain("@");
    const [{ r: equipe }] = await banc.en<{ r: Liste }>({ id: A }, "select public.sessions_equipe() as r");
    expect(equipe.a_venir.map((l) => l.id)).toEqual(expect.arrayContaining([venir, deG]));
    await expect(banc.en({ id: E1 }, "select public.sessions_animees()")).rejects.toThrow(ACCES);
    await expect(banc.en({ id: F }, "select public.sessions_equipe()")).rejects.toThrow("Accès réservé à l’équipe.");
  });

  it("session_detail : lien et inscrits pour l'animateur et l'équipe ; null pour un étudiant ou un autre formateur", async () => {
    const id = await session("5 days", { titre: "Détail" });
    await inscrire(E1, id);
    type Detail = { lien: string; animateur: string; inscrits: { prenom: string; nom: string }[] };
    for (const qui of [F, A]) {
      const [{ r }] = await banc.en<{ r: Detail }>({ id: qui }, "select public.session_detail($1) as r", [id]);
      expect(r).toMatchObject({ lien: "https://meet.google.com/abc-defg-hij", animateur: "Mireille Akpo", inscrits: [{ prenom: "Fifamè", nom: "Adjovi" }] });
      expect(JSON.stringify(r)).not.toContain("@");
    }
    for (const qui of [E1, G]) expect(await banc.en({ id: qui }, "select public.session_detail($1) as r", [id])).toEqual([{ r: null }]);
    await expect(banc.en("anon", "select public.session_detail($1)", [id])).rejects.toThrow(REFUS);
  });

  it("les tables ne se lisent ni ne s'écrivent directement", async () => {
    await expect(banc.en({ id: A }, "select * from public.sessions_live")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "insert into public.inscriptions_sessions (session_id, profil_id) values ($1, $2)", [randomUUID(), E1])).rejects.toThrow(REFUS);
  });

  it("la migration est rejouable", async () => {
    const id = await session("5 days", { titre: "Gardée" });
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect(await un("select titre from public.sessions_live where id = $1", [id])).toEqual({ titre: "Gardée" });
  });
});
