import type { ComponentPropsWithoutRef } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { controlClasses, isInvalid } from "./TextInput";

type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "children"> & {
  options: { value: string; label: string }[];
  invalid?: boolean;
};

/** Liste déroulante native : la liste ouverte est celle du système, la plus simple au doigt sur téléphone. */
export function Select({ options, invalid, className, "aria-invalid": ariaInvalid, ...props }: SelectProps) {
  return (
    <span className="relative block">
      <select
        aria-invalid={isInvalid(invalid, ariaInvalid)}
        className={cn(controlClasses, "cursor-pointer appearance-none pr-10", className)}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-[15px] right-3.5 text-discret">
        <Icon icon={ArrowDown01Icon} size={18} />
      </span>
    </span>
  );
}
