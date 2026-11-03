"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, ArrowUp01Icon, Delete02Icon, Folder01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { enregistrerCategorie, rangerCategorie, supprimerCategorie } from "@/lib/bibliotheque/actions";
import type { CategorieRangee } from "@/lib/bibliotheque/types";

// Les catégories libres de la Bibliothèque (0074) : la fenêtre « Catégories » de la page du back-office (créer, renommer,
// ranger, supprimer) et la petite fenêtre « Créer une catégorie » de la fiche d'un livre.

const ECHEC = "L’action n’a pas abouti. Vérifiez votre connexion, puis réessayez.";

async function essayer<T>(action: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  try {
    return await action();
  } catch {
    return { ok: false, message: ECHEC };
  }
}

/** Une catégorie de la liste : son nom, ou le champ pour la renommer ; ou la question avant de la supprimer. */
function LigneCategorie({
  categorie,
  premiere,
  derniere,
  occupe,
  onRenommer,
  onDeplacer,
  onSupprimer,
}: {
  categorie: CategorieRangee;
  premiere: boolean;
  derniere: boolean;
  occupe: boolean;
  onRenommer: (nom: string) => Promise<string | null>;
  onDeplacer: (sens: -1 | 1) => void;
  onSupprimer: () => Promise<void>;
}) {
  const id = useId();
  const [mode, setMode] = useState<"vue" | "renommer" | "supprimer">("vue");
  const [nom, setNom] = useState(categorie.nom);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const renommer = async (e: FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    const refus = await onRenommer(nom);
    setEnCours(false);
    setErreur(refus);
    if (!refus) setMode("vue");
  };

  if (mode === "renommer") {
    return (
      <li className="rounded-bouton border border-bordure-carte p-3">
        <form onSubmit={renommer} className="flex flex-wrap items-end gap-2">
          <Field label={`Nouveau nom de « ${categorie.nom} »`} htmlFor={id} error={erreur ?? undefined} className="min-w-0 flex-1 basis-[200px]">
            <TextInput id={id} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} autoFocus />
          </Field>
          <span className="flex gap-2">
            <Button type="button" variant="contour" onClick={() => setMode("vue")} disabled={enCours}>
              Annuler
            </Button>
            <Button type="submit" loading={enCours}>
              Renommer
            </Button>
          </span>
        </form>
      </li>
    );
  }
  if (mode === "supprimer") {
    return (
      <li className="flex flex-col gap-3 rounded-bouton border border-erreur-vif/40 bg-erreur-fond p-3">
        <p className="m-0 text-sm leading-[22px] text-pretty text-encre">
          Supprimer « {categorie.nom} » ? Ses livres restent dans la Bibliothèque, sans catégorie.
        </p>
        <span className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="contour" size="sm" onClick={() => setMode("vue")} disabled={enCours}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={enCours}
            onClick={async () => {
              setEnCours(true);
              await onSupprimer();
              setEnCours(false);
            }}
          >
            Supprimer
          </Button>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 rounded-bouton border border-bordure-carte py-2 pr-2 pl-3.5">
      <Icon icon={Folder01Icon} size={18} className="flex-none text-discret" />
      <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium text-encre" title={categorie.nom}>
        {categorie.nom}
      </span>
      <span role="group" aria-label={`Actions de « ${categorie.nom} »`} className="flex flex-none items-center gap-0.5">
        <IconButton
          icon={ArrowUp01Icon}
          label={`Monter « ${categorie.nom} »`}
          variant="discret"
          size="sm"
          disabled={premiere || occupe}
          onClick={() => onDeplacer(-1)}
        />
        <IconButton
          icon={ArrowDown01Icon}
          label={`Descendre « ${categorie.nom} »`}
          variant="discret"
          size="sm"
          disabled={derniere || occupe}
          onClick={() => onDeplacer(1)}
        />
        <IconButton
          icon={PencilEdit02Icon}
          label={`Renommer « ${categorie.nom} »`}
          variant="discret"
          size="sm"
          disabled={occupe}
          onClick={() => {
            setNom(categorie.nom);
            setErreur(null);
            setMode("renommer");
          }}
        />
        <IconButton
          icon={Delete02Icon}
          label={`Supprimer « ${categorie.nom} »`}
          variant="discret"
          size="sm"
          disabled={occupe}
          onClick={() => setMode("supprimer")}
        />
      </span>
    </li>
  );
}

/** Le bouton « Catégories » de la page Bibliothèque et sa fenêtre de gestion. */
export function GestionCategories({ categories: initiales }: { categories: CategorieRangee[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const champ = useId();
  const [ouverte, setOuverte] = useState(false);
  const [categories, setCategories] = useState(initiales);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  // La liste suit les actions de la fenêtre ; la page est relue en même temps (router.refresh) pour la fiche des livres.
  const [occupe, setOccupe] = useState(false);

  const ajouter = async (e: FormEvent) => {
    e.preventDefault();
    setOccupe(true);
    const resultat = await essayer(() => enregistrerCategorie({ nom }));
    setOccupe(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    setErreur(null);
    setNom("");
    setCategories((liste) => [...liste, resultat.categorie]);
    toast({ tone: "reussite", title: "Catégorie créée" });
    router.refresh();
  };

  const renommer = (c: CategorieRangee) => async (nouveau: string) => {
    const resultat = await essayer(() => enregistrerCategorie({ id: c.id, nom: nouveau }));
    if (!resultat.ok) return resultat.message;
    setCategories((liste) => liste.map((x) => (x.id === c.id ? { ...x, nom: resultat.categorie.nom } : x)));
    toast({ tone: "reussite", title: "Catégorie renommée" });
    router.refresh();
    return null;
  };

  const deplacer = (index: number) => async (sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= categories.length) return;
    setOccupe(true);
    const resultat = await essayer(() => rangerCategorie(categories[index].id, cible + 1));
    setOccupe(false);
    if (!resultat.ok) {
      toast({ tone: "erreur", title: resultat.message });
      return;
    }
    setCategories((liste) => {
      const copie = [...liste];
      const [deplacee] = copie.splice(index, 1);
      copie.splice(cible, 0, deplacee);
      return copie;
    });
    router.refresh();
  };

  const supprimer = (c: CategorieRangee) => async () => {
    const resultat = await essayer(() => supprimerCategorie(c.id));
    if (!resultat.ok) {
      toast({ tone: "erreur", title: resultat.message });
      return;
    }
    setCategories((liste) => liste.filter((x) => x.id !== c.id));
    toast({ tone: "reussite", title: "Catégorie supprimée" });
    router.refresh();
  };

  return (
    <>
      <Button type="button" variant="contour" onClick={() => setOuverte(true)}>
        Catégories
      </Button>
      <Dialog
        open={ouverte}
        onOpenChange={setOuverte}
        title="Catégories de la Bibliothèque"
        description="Elles classent les livres, en plus des parcours. Les étudiants pourront filtrer la Bibliothèque par catégorie."
        footer={
          <DialogClose asChild>
            <Button variant="contour">Fermer</Button>
          </DialogClose>
        }
      >
        <div className="flex flex-col gap-4">
          {categories.length === 0 ? (
            <p className="m-0 text-[13px] leading-5 text-discret">Aucune catégorie pour le moment.</p>
          ) : (
            <ul aria-label="Catégories" className="m-0 flex list-none flex-col gap-2 p-0">
              {categories.map((c, i) => (
                <LigneCategorie
                  key={c.id}
                  categorie={c}
                  premiere={i === 0}
                  derniere={i === categories.length - 1}
                  occupe={occupe}
                  onRenommer={renommer(c)}
                  onDeplacer={deplacer(i)}
                  onSupprimer={supprimer(c)}
                />
              ))}
            </ul>
          )}
          <form onSubmit={ajouter} noValidate className="flex flex-wrap items-end gap-2">
            <Field
              label="Nouvelle catégorie"
              htmlFor={champ}
              hint="Par exemple « Modèles de mémoire » ou « Guides pratiques »."
              error={erreur ?? undefined}
              className="min-w-0 flex-1 basis-[220px]"
            >
              <TextInput id={champ} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
            </Field>
            <Button type="submit" loading={occupe} disabled={!nom.trim()}>
              Ajouter
            </Button>
          </form>
        </div>
      </Dialog>
    </>
  );
}

/** « Créer une catégorie » depuis la fiche d'un livre : la catégorie créée est aussitôt choisie. */
export function FenetreNouvelleCategorie({
  ouverte,
  onOuverteChange,
  onCreee,
}: {
  ouverte: boolean;
  onOuverteChange: (o: boolean) => void;
  onCreee: (c: CategorieRangee) => void;
}) {
  const champ = useId();
  const formulaire = useId();
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    const resultat = await essayer(() => enregistrerCategorie({ nom }));
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    setNom("");
    setErreur(null);
    onCreee(resultat.categorie);
    onOuverteChange(false);
  };

  return (
    <Dialog
      open={ouverte}
      onOpenChange={(o) => {
        if (!o) setErreur(null);
        onOuverteChange(o);
      }}
      title="Créer une catégorie"
      description="Elle sera choisie pour ce livre, et proposée pour les suivants."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="contour" disabled={enCours}>
              Annuler
            </Button>
          </DialogClose>
          <Button type="submit" form={formulaire} loading={enCours} disabled={!nom.trim()}>
            Créer la catégorie
          </Button>
        </>
      }
    >
      <form id={formulaire} onSubmit={creer} noValidate>
        <Field label="Nom de la catégorie" htmlFor={champ} error={erreur ?? undefined}>
          <TextInput id={champ} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
