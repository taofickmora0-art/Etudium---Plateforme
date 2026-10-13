import { ComingSoon, comingSoonMetadata } from "@/components/layout/ComingSoon";

export const metadata = comingSoonMetadata("exercices");

export default function Page() {
  return <ComingSoon page="exercices" />;
}
