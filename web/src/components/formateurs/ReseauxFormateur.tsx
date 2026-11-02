import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { reseauxRenseignes, type Reseaux } from "@/lib/formateurs/reseaux";

/**
 * Les réseaux renseignés d'un formateur, dans l'ordre de la liste (migration 0070) : une icône par réseau, qui ouvre son
 * adresse dans un nouvel onglet (« Instagram de Koffi Mensah »). Rien si aucun n'est renseigné.
 */
export function ReseauxFormateur({ nom, reseaux, className }: { nom: string; reseaux: Reseaux; className?: string }) {
  const renseignes = reseauxRenseignes(reseaux);
  if (renseignes.length === 0) return null;
  return (
    <ul aria-label={`Réseaux de ${nom}`} className={cn("m-0 flex list-none flex-wrap items-center gap-2 p-0", className)}>
      {renseignes.map((r) => (
        <li key={r.cle} className="flex">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${r.libelle} de ${nom}`}
            className={cn(iconButtonVariants({ variant: "contour", size: "sm" }), "text-texte no-underline hover:bg-page max-sm:size-8")}
          >
            <Icon icon={r.icone} size={18} />
          </a>
        </li>
      ))}
    </ul>
  );
}
