import { Tag } from "@/components/ui/Tag";
import type { Role } from "@/lib/auth/permissions";
import { LIBELLES_ROLES, ROLES_ORDONNES } from "@/lib/utilisateurs/regles";

/** Les rôles d'un compte autres qu'Étudiant (tout compte l'est), et « Suspendu » le cas échéant. */
export function EtiquettesRoles({ roles, suspendu }: { roles: Role[]; suspendu: boolean }) {
  const affiches = ROLES_ORDONNES.filter((r) => r !== "etudiant" && roles.includes(r));
  if (affiches.length === 0 && !suspendu) return null;
  return (
    <span className="flex max-w-[45%] flex-none flex-wrap justify-end gap-1.5">
      {affiches.map((r) => (
        <Tag key={r} tone={r === "formateur" ? "nouveau" : "complementaire"}>
          {LIBELLES_ROLES[r]}
        </Tag>
      ))}
      {suspendu && <Tag tone="echoue">Suspendu</Tag>}
    </span>
  );
}
