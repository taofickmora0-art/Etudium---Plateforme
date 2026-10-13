import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0010 : avis des étudiants (spec du lot 1, Q8, §4, §7). Écritures par fonctions seulement, à partir de 50 %
// de progression ; lecture publique sans l'identifiant de l'auteur ; moyenne et nombre tenus à jour par la base.
const MIGRATION = "supabase/migrations/0010_avis.sql";

type Ligne = { auteur: string; initiales: string; note: number; commentaire: string; est_moi: boolean; masque: boolean; id: string };

describe("Migration 0010 : avis", () => {
  let banc: Banc;
  const A = randomUUID(); // Fifamè Adjovi, 6 leçons d'Excel terminées sur 12
  const B = randomUUID(); // Rodrigue Houngbo, 5 sur 12
  const C = randomUUID(); // Prénom sans nom, Excel terminée
  const D = randomUUID(); // Sans prénom, Excel terminée
  const ADMIN = randomUUID();
  let excel: string;
  let brouillon: string;

  const formation = async () =>
    (await banc.db.query<{ note_moyenne: string | null; nb_avis: number }>("select note_moyenne, nb_avis from public.formations where id = $1", [excel])).rows[0];
  const terminer = async (qui: string, n: number) => {
    const { rows } = await banc.db.query<{ id: string }>(
      "select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1 order by m.ordre, l.ordre limit $2",
      [excel, n],
    );
    for (const { id } of rows) await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, terminee_le) values ($1, $2, now())", [qui, id]);
  };
  const enregistrer = (qui: string, note: number, commentaire = "", f = excel) =>
    banc.en({ id: qui }, "select public.enregistrer_avis($1, $2::smallint, $3)", [f, note, commentaire]);
  const lire = (qui: "anon" | { id: string }) => banc.en<Ligne>(qui, "select * from public.avis_formation($1)", [excel]);

  beforeAll(async () => {
    banc = await creerBanc([
      ...MIGRATIONS_LOT_0,
      "supabase/migrations/0004_contenus.sql",
      "supabase/migrations/0005_back_office.sql",
      "supabase/migrations/0006_notes.sql",
      "supabase/migrations/0007_visionnage.sql",
      "supabase/migrations/0008_progression.sql",
      "supabase/migrations/0009_favoris.sql",
      "supabase/exemples/lot-1.sql",
      MIGRATION,
    ]);
    for (const qui of [A, B, C, D]) await banc.creerCompte(qui);
    await banc.creerCompte(ADMIN, ["admin"]);
    await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'adjovi' where id = $1", [A]);
    await banc.db.query("update public.profils set prenom = 'Rodrigue', nom = 'Houngbo' where id = $1", [B]);
    await banc.db.query("update public.profils set prenom = 'Aïcha', nom = '' where id = $1", [C]);
    await banc.db.query("update public.profils set prenom = '', nom = '' where id = $1", [D]);
    excel = (await banc.db.query<{ id: string }>("select id from public.formations where slug = 'maitriser-microsoft-excel'")).rows[0].id;
    brouillon = (await banc.db.query<{ id: string }>("insert into public.formations (slug, titre, statut) values ('brouillon-avis', 'Brouillon', 'brouillon') returning id")).rows[0].id;
    await terminer(A, 6);
    await terminer(B, 5);
    await terminer(C, 12);
    await terminer(D, 12);
  });

  it("à partir de 50 % de progression seulement (6 leçons sur 12), jamais en visiteur", async () => {
    await expect(enregistrer(B, 4)).rejects.toMatchObject({ code: "42501" });
    await expect(banc.en("anon", "select public.enregistrer_avis($1, 4::smallint, '')", [excel])).rejects.toThrow();
    await enregistrer(A, 5, "Les tableaux croisés m’ont fait gagner un temps fou.");
    expect(await formation()).toEqual({ note_moyenne: "5.0", nb_avis: 1 });
    expect((await banc.en<{ peut: boolean }>({ id: A }, "select public.peut_donner_avis($1) as peut", [excel]))[0].peut).toBe(true);
    expect((await banc.en<{ peut: boolean }>({ id: B }, "select public.peut_donner_avis($1) as peut", [excel]))[0].peut).toBe(false);
  });

  it("un seul avis par compte : le second envoi remplace le premier", async () => {
    const avant = (await banc.db.query<{ modifie_le: Date }>("select modifie_le from public.avis where profil_id = $1", [A])).rows[0].modifie_le;
    await new Promise((r) => setTimeout(r, 5));
    await enregistrer(A, 4, "  Très clair.  ");
    const { rows } = await banc.db.query<{ note: number; commentaire: string; modifie_le: Date }>("select note, commentaire, modifie_le from public.avis where profil_id = $1", [A]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ note: 4, commentaire: "Très clair." });
    expect(rows[0].modifie_le.getTime()).toBeGreaterThan(avant.getTime());
  });

  it("note de 1 à 5, commentaire de 1 000 caractères au plus, espaces seuls enregistrés vides", async () => {
    await expect(enregistrer(C, 0)).rejects.toMatchObject({ code: "22023" });
    await expect(enregistrer(C, 6)).rejects.toMatchObject({ code: "22023" });
    await expect(enregistrer(C, 5, "a".repeat(1001))).rejects.toMatchObject({ code: "22023" });
    await enregistrer(C, 5, "   ");
    expect((await banc.db.query<{ commentaire: string }>("select commentaire from public.avis where profil_id = $1", [C])).rows[0].commentaire).toBe("");
    await expect(enregistrer(C, 5, "", brouillon)).rejects.toMatchObject({ code: "42501" });
  });

  it("lecture publique : prénom et initiale, jamais l'identifiant ; le sien d'abord", async () => {
    await enregistrer(D, 3, "<script>alert(1)</script>");
    const visiteur = await lire("anon");
    expect(visiteur.map((l) => l.auteur).sort()).toEqual(["Aïcha", "Fifamè A.", "Membre d’Étudium"]);
    expect(visiteur.find((l) => l.auteur === "Fifamè A.")).toMatchObject({ initiales: "FA", note: 4, est_moi: false });
    expect(visiteur.find((l) => l.auteur === "Aïcha")?.initiales).toBe("A");
    expect(Object.keys(visiteur[0])).not.toContain("profil_id");
    expect((await lire({ id: A }))[0]).toMatchObject({ auteur: "Fifamè A.", est_moi: true });
    const repartition = await banc.en<{ note: number; nombre: number }>("anon", "select * from public.repartition_avis($1) order by note", [excel]);
    expect(repartition).toEqual([
      { note: 3, nombre: 1 },
      { note: 4, nombre: 1 },
      { note: 5, nombre: 1 },
    ]);
    expect(await banc.en("anon", "select * from public.avis_formation($1)", [brouillon])).toEqual([]);
  });

  it("moyenne et nombre suivent chaque changement", async () => {
    expect(await formation()).toEqual({ note_moyenne: "4.0", nb_avis: 3 });
    await banc.en({ id: D }, "select public.supprimer_avis($1)", [excel]);
    expect(await formation()).toEqual({ note_moyenne: "4.5", nb_avis: 2 });
  });

  it("masquer : réservé à l'équipe ; l'avis sort de la moyenne et de la lecture publique, son auteur le voit encore", async () => {
    const id = (await lire({ id: A }))[0].id;
    await expect(banc.en({ id: B }, "select public.masquer_avis($1, true)", [id])).rejects.toMatchObject({ code: "42501" });
    await banc.en({ id: ADMIN }, "select public.masquer_avis($1, true)", [id]);
    expect(await formation()).toEqual({ note_moyenne: "5.0", nb_avis: 1 });
    expect((await lire("anon")).map((l) => l.auteur)).toEqual(["Aïcha"]);
    expect((await lire({ id: A }))[0]).toMatchObject({ est_moi: true, masque: true });
    expect(await banc.en("anon", "select * from public.repartition_avis($1)", [excel])).toEqual([{ note: 5, nombre: 1 }]);
    await enregistrer(A, 2, "Modifié.");
    expect((await lire({ id: A }))[0]).toMatchObject({ note: 2, masque: true });
    expect(await banc.en({ id: B }, "select * from public.avis_equipe()")).toEqual([]);
    const equipe = await banc.en<{ auteur: string; masque: boolean; formation_slug: string }>({ id: ADMIN }, "select * from public.avis_equipe()");
    expect(equipe).toHaveLength(2);
    expect(equipe.find((e) => e.auteur === "Fifamè A.")).toMatchObject({ masque: true, formation_slug: "maitriser-microsoft-excel" });
    await banc.en({ id: ADMIN }, "select public.masquer_avis($1, false)", [id]);
    expect(await formation()).toEqual({ note_moyenne: "3.5", nb_avis: 2 });
  });

  it("aucune écriture directe ; chacun ne lit que ses avis dans la table", async () => {
    await expect(banc.en({ id: B }, "insert into public.avis (formation_id, note) values ($1, 5)", [excel])).rejects.toThrow();
    await expect(banc.en({ id: A }, "update public.avis set masque = false")).rejects.toThrow();
    await expect(banc.en({ id: A }, "delete from public.avis")).rejects.toThrow();
    await expect(banc.en("anon", "select * from public.avis")).rejects.toThrow();
    expect(await banc.en({ id: B }, "select * from public.avis")).toEqual([]);
    expect(await banc.en({ id: A }, "select note from public.avis")).toEqual([{ note: 2 }]);
  });

  it("un compte supprimé emporte son avis ; sans avis, la moyenne redevient vide", async () => {
    await banc.db.query("delete from auth.users where id = $1", [C]);
    expect(await formation()).toEqual({ note_moyenne: "2.0", nb_avis: 1 });
    await banc.en({ id: A }, "select public.supprimer_avis($1)", [excel]);
    expect(await formation()).toEqual({ note_moyenne: null, nb_avis: 0 });
  });

  it("la migration se rejoue", async () => {
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect(await formation()).toEqual({ note_moyenne: null, nb_avis: 0 });
  });
});
