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

  it("la migration est rejouable (tâche 1)", async () => {
    const id = await session("5 days", { titre: "Gardée" });
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect(await un("select titre from public.sessions_live where id = $1", [id])).toEqual({ titre: "Gardée" });
  });
});

describe("Inscriptions, lecture et rappels", () => {
  type Carte = { id: string; titre: string; lien: string | null; inscriptions: number; inscrit: boolean; statut: string; plateforme: string; animateur: string };
  const vue = async (qui: string, v: string) => (await banc.en<{ r: Carte[] }>({ id: qui }, "select public.sessions_live($1) as r", [v]))[0].r;
  const carte = async (qui: string, v: string, id: string) => (await vue(qui, v)).find((c) => c.id === id);
  const sInscrire = (qui: string, id: string) => banc.en({ id: qui }, "select public.sinscrire_session($1)", [id]);
  const rappels = async (qui: string) => (await banc.en<{ n: number }>({ id: qui }, "select public.rappels_sessions() as n"))[0].n;
  const nouveau = async (prenom = "Test", nom = "Compte") => {
    const id = randomUUID();
    await banc.creerCompte(id);
    await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
    return id;
  };

  it("le lien : absent à 11 min du début, présent à 9 min et pendant, absent après la fin ; toujours là pour l'animateur et l'équipe", async () => {
    const E = await nouveau();
    const [s11, s9, enCours, finie] = [await session("11 minutes"), await session("9 minutes"), await session("-20 minutes"), await session("-2 hours")];
    expect((await carte(E, "a_venir", s11))?.lien).toBeNull();
    expect((await carte(E, "a_venir", s9))?.lien).toBe("https://meet.google.com/abc-defg-hij");
    expect((await carte(E, "a_venir", enCours))?.lien).toBe("https://meet.google.com/abc-defg-hij");
    expect(await carte(E, "a_venir", finie)).toBeUndefined();
    for (const qui of [F, A]) expect((await carte(qui, "a_venir", s11))?.lien).toBe("https://meet.google.com/abc-defg-hij");
    expect((await carte(G, "a_venir", s11))?.lien).toBeNull();
    expect(await carte(E, "a_venir", s11)).toMatchObject({ plateforme: "Google Meet", animateur: "Mireille Akpo", statut: "programmee", inscrit: false });
  });

  it("prochaine_session et session_detail ne livrent pas le lien à un étudiant avant la fenêtre", async () => {
    const E = await nouveau();
    const id = await session("15 minutes", { lien: "https://zoom.us/j/secret-123" });
    await sInscrire(E, id);
    const [{ r }] = await banc.en<{ r: Carte }>({ id: E }, "select public.prochaine_session() as r");
    expect(r.id).toBe(id);
    expect(JSON.stringify(r)).not.toContain("secret-123");
    expect(JSON.stringify(await vue(E, "inscriptions"))).not.toContain("secret-123");
    expect(await banc.en({ id: E }, "select public.session_detail($1) as r", [id])).toEqual([{ r: null }]);
  });

  it("vues : à venir (sans les annulées), mes inscriptions (avec « annulee »), passées ; inscriptions et inscrit", async () => {
    const E = await nouveau();
    const autre = await nouveau();
    const [venir, annulee, passee] = [await session("2 days"), await session("3 days", { statut: "annulee" }), await session("-2 days")];
    for (const id of [venir, annulee, passee]) await inscrire(E, id);
    await inscrire(autre, venir);
    expect(await carte(E, "a_venir", venir)).toMatchObject({ inscrit: true, inscriptions: 2 });
    expect(await carte(E, "a_venir", annulee)).toBeUndefined();
    expect((await vue(E, "inscriptions")).map((c) => [c.id, c.statut])).toEqual([[venir, "programmee"], [annulee, "annulee"]]);
    expect((await vue(E, "passees")).map((c) => c.id)).toEqual([passee]);
    expect(await carte(autre, "passees", passee)).toBeUndefined();
  });

  it("prochaine_session : la plus proche de mes inscriptions, sinon la prochaine ; 3 initiales", async () => {
    const E = await nouveau();
    const [{ r: sans }] = await banc.en<{ r: Carte }>({ id: E }, "select public.prochaine_session() as r");
    expect(sans.id).toBe((await vue(E, "a_venir"))[0].id);
    const loin = await session("20 days");
    const plusLoin = await session("25 days");
    for (const [prenom, nom] of [["Rodrigue", "Houngbo"], ["Fifamè", "Adjovi"], ["Sèdjro", "Dossou"], ["Awa", "Bio"]]) await inscrire(await nouveau(prenom, nom), loin);
    await inscrire(E, plusLoin);
    await inscrire(E, loin);
    const [{ r }] = await banc.en<{ r: Carte & { initiales: string[] } }>({ id: E }, "select public.prochaine_session() as r");
    expect(r.id).toBe(loin);
    expect(r.initiales).toEqual(["RH", "FA", "SD"]);
  });

  it("s'inscrire deux fois ne compte qu'une ; session annulée ou terminée : « Les inscriptions à cette session sont closes. »", async () => {
    const E = await nouveau();
    const id = await session("4 days");
    await sInscrire(E, id);
    await sInscrire(E, id);
    expect(await carte(E, "a_venir", id)).toMatchObject({ inscriptions: 1, inscrit: true });
    for (const close of [await session("4 days", { statut: "annulee" }), await session("-3 hours")]) {
      await expect(sInscrire(E, close)).rejects.toThrow("Les inscriptions à cette session sont closes.");
    }
  });

  it("se désinscrire avant le début ; après : « La session a commencé. »", async () => {
    const E = await nouveau();
    const id = await session("4 days");
    await sInscrire(E, id);
    await banc.en({ id: E }, "select public.se_desinscrire_session($1)", [id]);
    expect(await carte(E, "a_venir", id)).toMatchObject({ inscrit: false, inscriptions: 0 });
    const commencee = await session("-5 minutes");
    await inscrire(E, commencee);
    await expect(banc.en({ id: E }, "select public.se_desinscrire_session($1)", [commencee])).rejects.toThrow("La session a commencé.");
  });

  it("rappels : la veille (23 h avant) puis 1 h avant (50 min), une seule fois chacun, à l'inscrit seulement", async () => {
    const E = await nouveau();
    const voisin = await nouveau();
    const veille = await session("23 hours", { titre: "Veille" });
    const heure = await session("50 minutes", { titre: "Heure" });
    await inscrire(E, veille);
    await inscrire(E, heure);
    await inscrire(voisin, veille);
    expect(await rappels(E)).toBe(2);
    expect(await rappels(E)).toBe(0);
    const titres = (await recues(E)).map((n) => [n.titre, n.texte]);
    expect(titres).toContainEqual(["Session live dans moins d’une heure", expect.stringMatching(/^Heure, à \d{1,2} h \d{2}\. Le lien s’ouvre 10 min avant\.$/)]);
    expect(titres.find(([t]) => t.startsWith("Session live demain") || t.startsWith("Session live aujourd’hui"))?.[1]).toMatch(/^Veille, à \d{1,2} h \d{2}\.$/);
    expect(await recues(voisin)).toEqual([]);
    expect((await recues(E)).every((n) => n.categorie === "sessions_live" && n.lien === "/evenements")).toBe(true);
  });

  it("rappel « aujourd’hui » ou « demain » selon le jour au Bénin", async () => {
    const E = await nouveau();
    const id = await session("23 hours", { titre: "Jour" });
    await inscrire(E, id);
    await rappels(E);
    const { meme } = await un<{ meme: boolean }>(
      "select ((debut at time zone 'UTC') + interval '1 hour')::date = ((now() at time zone 'UTC') + interval '1 hour')::date as meme from public.sessions_live where id = $1",
      [id],
    );
    expect((await recues(E)).map((n) => n.titre)).toEqual([meme ? "Session live aujourd’hui" : "Session live demain"]);
  });

  it("s'inscrire 30 min avant : aucun rappel ; 5 h avant : seulement celui d'1 h, plus tard", async () => {
    const E = await nouveau();
    const proche = await session("30 minutes");
    const cinq = await session("5 hours", { titre: "Cinq heures" });
    await sInscrire(E, proche);
    await sInscrire(E, cinq);
    expect(await rappels(E)).toBe(0);
    await banc.db.query("update public.sessions_live set debut = now() + interval '50 minutes' where id = $1", [cinq]);
    expect(await rappels(E)).toBe(1);
    expect((await recues(E)).map((n) => n.titre)).toEqual(["Session live dans moins d’une heure"]);
  });

  it("compte suspendu : refus ; visiteur : refus", async () => {
    const E = await nouveau();
    const id = await session("4 days");
    await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [E]);
    await expect(vue(E, "a_venir")).rejects.toThrow("Accès réservé aux comptes connectés.");
    await expect(sInscrire(E, id)).rejects.toThrow("Accès réservé aux comptes connectés.");
    await expect(rappels(E)).rejects.toThrow("Accès réservé aux comptes connectés.");
    for (const sql of ["select public.sessions_live('a_venir')", "select public.prochaine_session()", "select public.rappels_sessions()"]) {
      await expect(banc.en("anon", sql)).rejects.toThrow(REFUS);
    }
  });

  it("sans aucune session à venir : prochaine_session vaut null ; la migration reste rejouable", async () => {
    await banc.db.query("update public.sessions_live set statut = 'annulee'");
    expect(await banc.en({ id: E1 }, "select public.prochaine_session() as r")).toEqual([{ r: null }]);
    await banc.appliquer(MIGRATION);
  });
});
