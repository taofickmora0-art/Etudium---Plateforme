import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("evenements");

export default function Page() {
  return <ComingSoon page="evenements" />;
}
