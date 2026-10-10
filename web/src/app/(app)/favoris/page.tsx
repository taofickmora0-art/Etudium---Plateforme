import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("favoris");

export default function Page() {
  return <ComingSoon page="favoris" />;
}
