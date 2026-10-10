import { useId, type ReactNode } from "react";

/** Groupe d'entrées de la barre latérale : intertitre en capitales suivi d'un filet (planche « Navigation »). */
export function SidebarGroup({ title, children }: { title?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role={title ? "group" : undefined} aria-labelledby={title ? id : undefined} className="flex flex-col gap-3">
      {title && (
        <div className="flex h-12 items-center gap-2.5 pr-1 pl-3">
          <span id={id} className="text-[13.5px] tracking-[0.04em] text-ardoise uppercase">
            {title}
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-filet" />
        </div>
      )}
      {children}
    </div>
  );
}
