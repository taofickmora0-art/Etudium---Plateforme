import { beforeAll, describe, expect, it } from "vitest";
import { aDomaine, DOMAINES_PAR_ROLE, domainesDe } from "@/lib/auth/domaines";
import type { Role } from "@/lib/auth/permissions";
import { creerBanc, migrationsJusqua, type Banc } from "../db/banc";

// Les domaines du back-office par rôle (lot 6 A, spec §1) : la même table dans l'appli et dans la base (0060).

let banc: Banc;
beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0060"));
});

describe("Les domaines du back-office", () => {
  it("la table de l'appli est celle de la base, rôle par rôle", async () => {
    for (const role of Object.keys(DOMAINES_PAR_ROLE) as Role[]) {
      const { rows } = await banc.db.query<{ d: string[] }>("select public.domaines_role($1) as d", [role]);
      expect(DOMAINES_PAR_ROLE[role], role).toEqual(rows[0].d);
    }
  });

  it("les domaines d'un compte : ceux de ses rôles, sans doublon", () => {
    expect(domainesDe(["etudiant"])).toEqual([]);
    expect(domainesDe(["etudiant", "moderateur"])).toEqual(["communaute"]);
    expect(domainesDe(["etudiant", "admin"])).toEqual(["communaute", "contenus", "utilisateurs", "paiements", "statistiques"]);
    expect(aDomaine(["etudiant", "super_admin"], "journal")).toBe(true);
    expect(aDomaine(["etudiant", "admin"], "journal")).toBe(false);
    expect(aDomaine(["etudiant", "moderateur"], "contenus")).toBe(false);
  });
});
