import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { controlClasses, isInvalid, type TextInputProps } from "./TextInput";

/** Champ de recherche : loupe à gauche (planche « Formulaires »). */
export function SearchInput({ invalid, className, "aria-invalid": ariaInvalid, ...props }: Omit<TextInputProps, "type">) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-3.5 left-3.5 text-discret">
        <Icon icon={Search01Icon} size={20} />
      </span>
      <input
        type="search"
        aria-invalid={isInvalid(invalid, ariaInvalid)}
        className={cn(controlClasses, "pl-11 [&::-webkit-search-cancel-button]:appearance-none", className)}
        {...props}
      />
    </span>
  );
}
