"use client";

import { usePathname } from "next/navigation";
import { BottomBar } from "@/components/ui/BottomBar";
import { cn } from "@/lib/cn";
import { NAV_BAS, isActive } from "@/lib/navigation";

/** Barre du bas du téléphone, collée sous le panneau blanc (NdMobAccueil). */
export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <BottomBar
      items={NAV_BAS.map((e) => ({ ...e, active: isActive(pathname, e.href) }))}
      className={cn("mx-2 mb-2 flex-none rounded-t-none", className)}
    />
  );
}
