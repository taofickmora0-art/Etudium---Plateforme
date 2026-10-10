import { Panel, Section } from "../Section";
import { ModalesDemo } from "./ModalesDemo";

export function Modales() {
  return (
    <Section
      id="modales"
      title="Modales et confirmations"
      description="Toute action importante demande une confirmation : le titre pose la question, le texte dit ce qui va se passer, le bouton reprend le verbe de l’action."
    >
      <Panel title="Ouvrir une fenêtre">
        <ModalesDemo />
      </Panel>
    </Section>
  );
}
