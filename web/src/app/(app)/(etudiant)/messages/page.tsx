import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("messages");

export default function Page() {
  return <ComingSoon page="messages" />;
}
