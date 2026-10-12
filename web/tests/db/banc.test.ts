import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Le banc exécute vraiment les migrations (Postgres en WebAssembly) : ce qui passe ici passera dans l'éditeur SQL de Supabase.
describe("Banc d'essai SQL", () => {
  let banc: Banc;
  const A = randomUUID();
  const B = randomUUID();

  beforeAll(async () => {
    // Deux fois : les migrations doivent se rejouer sans erreur.
    banc = await creerBanc([...MIGRATIONS_LOT_0, ...MIGRATIONS_LOT_0]);
    await banc.creerCompte(A);
    await banc.creerCompte(B);
  });

  it("les migrations du lot 0 s'appliquent et se rejouent", async () => {
    const [{ n }] = await banc.en<{ n: number }>({ id: A }, "select count(*)::int as n from public.profils");
    expect(n).toBe(1);
  });

  it("un nouveau compte reçoit son profil et le rôle étudiant", async () => {
    expect(await banc.en({ id: A }, "select role from public.roles")).toEqual([{ role: "etudiant" }]);
  });

  it("chacun ne lit que son profil", async () => {
    expect(await banc.en({ id: A }, "select id from public.profils")).toEqual([{ id: A }]);
    expect(await banc.en("anon", "select id from public.profils")).toEqual([]);
  });

  it("la base refuse une adresse de photo forgée", async () => {
    await expect(banc.en({ id: A }, "update public.profils set photo_url = 'https://ailleurs.example/x.png' where id = $1", [A])).rejects.toThrow(
      /profils_photo_chemin/,
    );
    await banc.en({ id: A }, "update public.profils set photo_url = $2 where id = $1", [A, `${A}/${randomUUID()}.jpg`]);
    const [{ photo_url }] = await banc.en<{ photo_url: string }>({ id: A }, "select photo_url from public.profils");
    expect(photo_url).toMatch(new RegExp(`^${A}/`));
  });
});
