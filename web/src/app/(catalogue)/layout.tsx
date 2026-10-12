import { Suspense, type ReactNode } from "react";
import { CadreSelonVisiteur } from "@/components/site/CadreSelonVisiteur";

/** Catalogue et fiches des formations : ouverts à tous, dans le cadre public ou dans la coque de l'appli. */
export default function CatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CadreSelonVisiteur>{children}</CadreSelonVisiteur>
    </Suspense>
  );
}
