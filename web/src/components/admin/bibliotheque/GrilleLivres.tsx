import { Download04Icon, Folder01Icon } from "@hugeicons/core-free-icons";
import { CardShell } from "@/components/ui/CourseCard";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { compter } from "@/lib/admin/parcours-chiffres";
import { ETATS_LIVRE, LIBELLES_ACCES, pages, TON_ACCES, TON_ETAT_LIVRE } from "@/lib/bibliotheque/regles";
import type { LivreAdmin } from "@/lib/bibliotheque/types";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { MenuLivre } from "./MenuLivre";

// Les livres du back-office, au style des cartes Formations (CardShell) : la couverture du livre montrée entière, son
// accès et son état posés dessus ; dessous, son auteur, son résumé, ses pages, ses lectures et ses téléchargements, et ce
// qui manque pour le publier. En haut à gauche de la couverture, hors du lien de la carte, son menu ⋮ (MenuLivre).

function CarteLivreAdmin({ livre: l }: { livre: LivreAdmin }) {
  const meta = [l.nbPages ? pages(l.nbPages) : null, compter(l.lectures, "lecture")].filter(Boolean).join(" · ");
  const manques: string[] = [];
  if (l.statut === "brouillon" && !l.fichier) manques.push("PDF à déposer");
  if (l.statut === "brouillon" && !l.droitsConfirmes) manques.push("Droits à confirmer");
  return (
    <CardShell
      href={`/admin/bibliotheque/${l.id}`}
      title={l.titre}
      sousTitre={
        <p data-testid="auteur-livre" className="m-0 mt-1 truncate text-[13px] leading-5 text-texte">
          {l.auteur || "Auteur non renseigné"}
        </p>
      }
      description={l.resume || "Pas encore de résumé."}
      parcours={l.parcours[0]?.couleur ?? "academique"}
      couverture={urlCouverture(l.couverture)}
      formatCouverture="livre"
      parcoursTag={{ tone: TON_ACCES[l.acces], label: LIBELLES_ACCES[l.acces] }}
      tag={{ tone: TON_ETAT_LIVRE[l.statut], label: ETATS_LIVRE[l.statut] }}
      titleAs="h2"
      coinGaucheOccupe
      horsLien={
        <div className="absolute top-3 left-3 flex">
          <MenuLivre livre={{ id: l.id, titre: l.titre, statut: l.statut }} />
        </div>
      }
    >
      <div aria-hidden="true" className="mt-4 h-px bg-bordure-carte" />
      <p data-testid="meta-livre" className="m-0 mt-3 text-xs leading-[18px] text-discret">
        {meta}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-[18px] text-discret">
        <span className="flex items-center gap-1">
          <Icon icon={Download04Icon} size={16} className="-mx-px" />
          {l.telechargeable ? compter(l.telechargements, "téléchargement") : "Lecture dans le site"}
        </span>
        {l.categorie && (
          <span className="flex min-w-0 items-center gap-1">
            <Icon icon={Folder01Icon} size={16} className="-mx-px flex-none" />
            <span className="truncate">{l.categorie.nom}</span>
          </span>
        )}
      </div>
      {manques.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {manques.map((m) => (
            <Tag key={m} tone="aCorriger">
              {m}
            </Tag>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function GrilleLivres({ livres }: { livres: LivreAdmin[] }) {
  return (
    <ul aria-label="Livres de la Bibliothèque" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5 p-0 max-sm:gap-4">
      {livres.map((l) => (
        <li key={l.id} className="flex min-w-0 [&>*]:flex-1">
          <CarteLivreAdmin livre={l} />
        </li>
      ))}
    </ul>
  );
}
