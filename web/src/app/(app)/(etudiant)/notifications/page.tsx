import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuNotifications } from "@/components/notifications/ContenuNotifications";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Notifications · Étudium" };

/** Notifications (NdNotifications ; spec des notifications, §3) : toutes celles du compte, groupées par jour. */
export default function Page() {
  return (
    <>
      <Suspense fallback={<Skeleton className="h-96 rounded-panneau" />}>
        <ContenuNotifications />
      </Suspense>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
