import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("notifications");

export default function Page() {
  return <ComingSoon page="notifications" />;
}
