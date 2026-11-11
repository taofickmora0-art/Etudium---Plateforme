import { Tag } from "@/components/ui/Tag";
import type { Role } from "@/lib/auth/permissions";
import { LIBELLES_ROLES, ROLES_ORDONNES } from "@/lib/utilisateurs/regles";

/**
 * Les rôles d'un compte, et « Suspendu » le cas échéant. « Étudiant » ne se montre que pour un formateur qui l'est aussi
 * (0079) : sinon, tout compte qui n'est pas formateur est étudiant.
 */
export function EtiquettesRoles({ roles, suspendu }: { roles: Role[]; suspendu: boolean }) {
  const affiches = ROLES_ORDONNES.filter((r) => roles.includes(r) && (r !== "etudiant" || roles.includes("formateur")));
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
