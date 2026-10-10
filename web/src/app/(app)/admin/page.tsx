import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("admin");

export default function Page() {
  return <ComingSoon page="admin" />;
}
