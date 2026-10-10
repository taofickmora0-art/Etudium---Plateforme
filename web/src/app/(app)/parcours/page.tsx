import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("parcours");

export default function Page() {
  return <ComingSoon page="parcours" />;
}
