"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Book02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { FileRow } from "@/components/ui/FileRow";
import { Icon } from "@/components/ui/Icon";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { tailleLisible } from "@/lib/admin/fichiers";
import { enregistrerLivre } from "@/lib/bibliotheque/actions";
import { envoyerFichier, retirerDeposes } from "@/lib/bibliotheque/envoi";
import { couvertureDePremierePage, lirePdfLocal } from "@/lib/bibliotheque/pdf-local";
import { ESPACE_LIVRES, LANGUES, pages, TYPE_PDF, verifierPdf } from "@/lib/bibliotheque/regles";
import type { AccesLivre, CategorieRangee, ChampLivre, LivreAdmin } from "@/lib/bibliotheque/types";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { COUVERTURE_MAX_OCTETS, verifierCouverture, type TypeCouverture } from "@/lib/couvertures/regles";
import { identifiantAleatoire } from "@/lib/identifiant";
import type { DocumentPdf } from "@/lib/ressources/pdf";
import { createClient } from "@/lib/supabase/client";
import { FenetreNouvelleCategorie } from "./Categories";

// La fiche d'un livre au back-office (nouveau ou existant ; Bibliothèque, 0074). Le PDF et la couverture restent dans le
// navigateur jusqu'à « Enregistrer » : ils sont alors déposés directement dans Supabase (le PDF avec sa progression), puis
// l'action enregistre la fiche ; si elle échoue, les fichiers déposés sont retirés. Le nombre de pages est lu dans le
// PDF par pdf.js, et la couverture peut être fabriquée à partir de sa première page.

const CARTE = "flex max-w-[680px] flex-col gap-5 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:gap-4 max-sm:p-4";
const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(180px,calc((100%-32px)/3))),1fr))] gap-4";
const ECHEC = "L’enregistrement n’a pas abouti. Vérifiez votre connexion, puis réessayez.";
const PDF_ILLISIBLE = "Ce PDF ne s’ouvre pas : il est peut-être abîmé ou protégé par un mot de passe. Choisissez-en un autre.";
const PAGE_ILLISIBLE = "La première page n’a pas pu être dessinée. Choisissez une image.";

type CouvertureLocale =
  | { etat: "actuelle" }
  | { etat: "aucune" }
  | {
      etat: "nouvelle";
      blob: Blob;
      type: TypeCouverture;
      extension: "jpg" | "png" | "webp";
      apercu: string;
    };

type Envoi = {
  etape: "pdf" | "couverture" | "enregistrement";
  progression: number;
};

type Props = {
  /** Le livre à modifier ; null : un nouveau livre. */
  livre: LivreAdmin | null;
  categories: CategorieRangee[];
  parcours: { id: string; nom: string }[];
};

const sansExtension = (nom: string) => (nom.lastIndexOf(".") > 0 ? nom.slice(0, nom.lastIndexOf(".")) : nom).replace(/[_]+/g, " ").trim().slice(0, 200);

function libelleBouton(envoi: Envoi | null, nouveau: boolean) {
  if (envoi?.etape === "pdf") return `Envoi du PDF… ${envoi.progression} %`;
  if (envoi?.etape === "couverture") return "Envoi de la couverture…";
  if (envoi?.etape === "enregistrement") return "Enregistrement…";
  return nouveau ? "Ajouter le livre" : "Enregistrer";
}

export function FormulaireLivre({ livre, categories: categoriesInitiales, parcours }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const ids = useId();
  const champ = (nom: string) => `${ids}-${nom}`;
  const [idNouveau] = useState(() => identifiantAleatoire());
  const id = livre?.id ?? idNouveau;

  const [titre, setTitre] = useState(livre?.titre ?? "");
  const [auteur, setAuteur] = useState(livre?.auteur ?? "");
  const [resume, setResume] = useState(livre?.resume ?? "");
  const [langue, setLangue] = useState(livre?.langue ?? "fr");
  const [annee, setAnnee] = useState(livre?.annee ? String(livre.annee) : "");
  const [motsCles, setMotsCles] = useState((livre?.motsCles ?? []).join(", "));
  const [nbPages, setNbPages] = useState(livre?.nbPages ? String(livre.nbPages) : "");
  const [categories, setCategories] = useState(categoriesInitiales);
  const [categorieId, setCategorieId] = useState(livre?.categorie?.id ?? "");
  const [parcoursCoches, setParcoursCoches] = useState<string[]>(livre?.parcours.map((p) => p.id) ?? []);
  // Choix de l'utilisateur : un nouveau livre est « inclus dans l'abonnement » et non téléchargeable.
  const [acces, setAcces] = useState<AccesLivre>(livre?.acces ?? "abonnes");
  const [telechargeable, setTelechargeable] = useState(livre?.telechargeable ?? false);
  const [droits, setDroits] = useState(livre?.droitsConfirmes ?? false);

  const [pdf, setPdf] = useState<{ fichier: File; pages: number } | null>(null);
  const [lecturePdf, setLecturePdf] = useState(false);
  const [erreurPdf, setErreurPdf] = useState<string | null>(null);
  const [couverture, setCouverture] = useState<CouvertureLocale>(livre?.couverture ? { etat: "actuelle" } : { etat: "aucune" });
  const [fabrication, setFabrication] = useState(false);
  const [erreurCouverture, setErreurCouverture] = useState<string | null>(null);
  const [creationCategorie, setCreationCategorie] = useState(false);

  const [envoi, setEnvoi] = useState<Envoi | null>(null);
  const [erreurs, setErreurs] = useState<Partial<Record<ChampLivre, string>>>({});
  const [message, setMessage] = useState<string | null>(null);

  // Le PDF choisi, ouvert par pdf.js (pages, première page) ; le PDF actuel, téléchargé seulement pour fabriquer une
  // couverture. Fermés au remplacement et en quittant la page.
  const documentChoisi = useRef<DocumentPdf | null>(null);
  const documentActuel = useRef<DocumentPdf | null>(null);
  const champImage = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      documentChoisi.current?.fermer();
      documentActuel.current?.fermer();
    },
    [],
  );
  // L'aperçu d'une couverture locale est une adresse « blob: » à libérer.
  useEffect(() => {
    if (couverture.etat !== "nouvelle") return;
    const apercu = couverture.apercu;
    return () => URL.revokeObjectURL(apercu);
  }, [couverture]);

  const occupe = envoi !== null;
  const nouveau = livre === null;

  // ─── Le PDF ───────────────────────────────────────────────────────────────────────────────────────
  const choisirPdf = async (fichier: File) => {
    setErreurPdf(null);
    setErreurs((e) => ({ ...e, fichier: undefined }));
    const controle = verifierPdf(fichier, new Uint8Array(await fichier.slice(0, 8).arrayBuffer()));
    if (!controle.ok) {
      setErreurPdf(controle.erreur);
      return;
    }
    setLecturePdf(true);
    try {
      const document = await lirePdfLocal(fichier);
      documentChoisi.current?.fermer();
      documentChoisi.current = document;
      setPdf({ fichier, pages: document.pages });
      setNbPages(String(document.pages));
      if (!titre.trim()) setTitre(sansExtension(fichier.name));
    } catch {
      setErreurPdf(PDF_ILLISIBLE);
    } finally {
      setLecturePdf(false);
    }
  };

  const retirerPdfChoisi = () => {
    documentChoisi.current?.fermer();
    documentChoisi.current = null;
    setPdf(null);
    setNbPages(livre?.nbPages ? String(livre.nbPages) : "");
  };

  // ─── La couverture ────────────────────────────────────────────────────────────────────────────────
  const choisirImage = async (fichier: File) => {
    setErreurCouverture(null);
    const controle = verifierCouverture(fichier, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    if (!controle.ok) {
      setErreurCouverture(controle.erreur);
      return;
    }
    setCouverture({
      etat: "nouvelle",
      blob: fichier,
      type: controle.type,
      extension: controle.extension,
      apercu: URL.createObjectURL(fichier),
    });
  };

  const fabriquer = async () => {
    setErreurCouverture(null);
    setFabrication(true);
    try {
      let document = documentChoisi.current ?? documentActuel.current;
      if (!document && livre?.fichier) {
        // Le PDF déjà enregistré : téléchargé une fois (l'équipe peut le lire), gardé pour un autre essai.
        const { data, error } = await createClient().storage.from(ESPACE_LIVRES).download(livre.fichier);
        if (error || !data) throw new Error("PDF illisible");
        document = await lirePdfLocal(data);
        documentActuel.current = document;
      }
      if (!document) {
        setErreurCouverture("Déposez d’abord le PDF du livre.");
        return;
      }
      const blob = await couvertureDePremierePage(document);
      if (blob.size > COUVERTURE_MAX_OCTETS) {
        setErreurCouverture(PAGE_ILLISIBLE);
        return;
      }
      setCouverture({
        etat: "nouvelle",
        blob,
        type: "image/jpeg",
        extension: "jpg",
        apercu: URL.createObjectURL(blob),
      });
    } catch {
      setErreurCouverture(PAGE_ILLISIBLE);
    } finally {
      setFabrication(false);
    }
  };

  const apercu = couverture.etat === "nouvelle" ? couverture.apercu : couverture.etat === "actuelle" ? urlCouverture(livre?.couverture ?? null) : null;
  const pdfDisponible = pdf !== null || Boolean(livre?.fichier);

  // ─── L'enregistrement ─────────────────────────────────────────────────────────────────────────────
  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    if (occupe || lecturePdf || fabrication) return;
    setMessage(null);
    setErreurs({});
    if (!titre.trim()) {
      setErreurs({ titre: "Entrez le titre du livre." });
      return;
    }
    const deposes: { espace: string; chemin: string }[] = [];
    try {
      let fichier: { chemin: string; tailleOctets: number } | undefined;
      if (pdf) {
        const chemin = `${id}/${identifiantAleatoire()}.pdf`;
        setEnvoi({ etape: "pdf", progression: 0 });
        // Une copie typée (sans recopier les octets) : le navigateur annoncerait sinon son propre type (RessourcesEditor).
        const resultat = await envoyerFichier({
          espace: ESPACE_LIVRES,
          chemin,
          fichier: pdf.fichier.slice(0, pdf.fichier.size, TYPE_PDF),
          type: TYPE_PDF,
          onProgression: (p) => setEnvoi({ etape: "pdf", progression: p }),
        });
        if (!resultat.ok) {
          setErreurs({ fichier: resultat.message });
          return;
        }
        deposes.push({ espace: ESPACE_LIVRES, chemin });
        fichier = { chemin, tailleOctets: pdf.fichier.size };
      }
      let cheminCouverture: string | null | undefined;
      if (couverture.etat === "nouvelle") {
        const chemin = `livres/${id}/${identifiantAleatoire()}.${couverture.extension}`;
        setEnvoi({ etape: "couverture", progression: 0 });
        const resultat = await envoyerFichier({
          espace: "couvertures",
          chemin,
          fichier: couverture.blob.slice(0, couverture.blob.size, couverture.type),
          type: couverture.type,
          cacheSecondes: 31_536_000,
        });
        if (!resultat.ok) {
          await retirerDeposes(deposes);
          setErreurCouverture(resultat.message);
          return;
        }
        deposes.push({ espace: "couvertures", chemin });
        cheminCouverture = chemin;
      } else if (couverture.etat === "aucune" && livre?.couverture) {
        cheminCouverture = null;
      }

      setEnvoi({ etape: "enregistrement", progression: 100 });
      const resultat = await enregistrerLivre({
        id,
        nouveau,
        titre,
        auteur,
        resume,
        langue,
        annee,
        motsCles,
        nbPages,
        categorieId: categorieId || null,
        parcours: parcoursCoches,
        acces,
        telechargeable,
        droitsConfirmes: droits,
        ...(fichier ? { fichier } : {}),
        ...(cheminCouverture !== undefined ? { couverture: cheminCouverture } : {}),
      });
      if (!resultat.ok) {
        await retirerDeposes(deposes);
        setErreurs(resultat.erreurs ?? {});
        setMessage(resultat.message ?? (resultat.erreurs ? null : ECHEC));
        return;
      }
      toast({
        tone: "reussite",
        title: nouveau ? "Livre ajouté" : "Livre enregistré",
      });
      if (nouveau) {
        router.push(`/admin/bibliotheque/${id}`);
        return;
      }
      documentChoisi.current?.fermer();
      documentChoisi.current = null;
      setPdf(null);
      if (cheminCouverture !== undefined) setCouverture(cheminCouverture ? { etat: "actuelle" } : { etat: "aucune" });
    } catch {
      await retirerDeposes(deposes);
      setMessage(ECHEC);
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <>
      <form
        onSubmit={enregistrer}
        noValidate
        aria-label={livre ? `Fiche de « ${livre.titre} »` : "Ajouter un livre"}
        className="flex flex-col gap-5 max-sm:gap-4"
      >
        {message && <Banner tone="erreur" title={message} className="max-w-[680px]" />}

        <section aria-labelledby={champ("titre-pdf")} className={CARTE}>
          <Heading level="card" as="h2">
            <span id={champ("titre-pdf")}>Le fichier PDF</span>
          </Heading>
          {envoi?.etape === "pdf" && pdf ? (
            <FileRow name={pdf.fichier.name} meta="" progress={envoi.progression} />
          ) : pdf ? (
            <FileRow
              name={pdf.fichier.name}
              meta={`${tailleLisible(pdf.fichier.size)} · ${pages(pdf.pages)} · envoyé à l’enregistrement`}
              onRemove={occupe ? undefined : retirerPdfChoisi}
            />
          ) : livre?.fichier ? (
            <FileRow
              name="PDF du livre"
              meta={[livre.tailleOctets ? tailleLisible(livre.tailleOctets) : null, livre.nbPages ? pages(livre.nbPages) : null].filter(Boolean).join(" · ")}
            />
          ) : null}
          {!(envoi?.etape === "pdf") && (
            <FileDrop
              title={lecturePdf ? "Lecture du PDF…" : pdf || livre?.fichier ? "Déposez un autre PDF pour le remplacer" : "Déposez le PDF du livre"}
              maxSizeLabel="PDF seulement · 50 Mo au maximum"
              accept="application/pdf,.pdf"
              disabled={occupe || lecturePdf}
              onFiles={(fichiers) => fichiers[0] && void choisirPdf(fichiers[0])}
            />
          )}
          {(erreurPdf || erreurs.fichier) && (
            <p role="alert" className="m-0 text-sm leading-[22px] text-pretty text-erreur-texte">
              {erreurPdf ?? erreurs.fichier}
            </p>
          )}
        </section>

        <section aria-labelledby={champ("titre-couverture")} className={CARTE}>
          <Heading level="card" as="h2">
            <span id={champ("titre-couverture")}>Couverture</span>
          </Heading>
          <div className="flex flex-wrap items-start gap-5 max-sm:gap-4">
            <div className="relative aspect-[2/3] w-[132px] flex-none overflow-hidden rounded-champ border border-bordure-carte bg-bleu-pale max-sm:w-[112px]">
              {apercu ? (
                <Image src={apercu} alt="Aperçu de la couverture" fill sizes="132px" unoptimized={apercu.startsWith("blob:")} className="object-cover" />
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-bleu">
                  <Icon icon={Book02Icon} size={36} />
                  <span className="text-xs leading-[18px] text-discret">Sans couverture</span>
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
              <p className="m-0 text-sm leading-[22px] text-pretty text-discret">
                JPG, PNG ou WebP, 5 Mo au plus, en portrait (par exemple 600 × 900 pixels). Ou fabriquez-la à partir de la première page du PDF.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="contour" size="sm" disabled={occupe} onClick={() => champImage.current?.click()}>
                  {apercu ? "Changer d’image" : "Choisir une image"}
                </Button>
                <Button
                  type="button"
                  variant="contour"
                  size="sm"
                  loading={fabrication}
                  disabled={occupe || !pdfDisponible || lecturePdf}
                  onClick={() => void fabriquer()}
                >
                  Fabriquer à partir de la 1re page
                </Button>
                {apercu && (
                  <Button type="button" variant="dangerDoux" size="sm" disabled={occupe} onClick={() => setCouverture({ etat: "aucune" })}>
                    Retirer
                  </Button>
                )}
              </div>
              {erreurCouverture && (
                <p role="alert" className="m-0 text-sm leading-[22px] text-pretty text-erreur-texte">
                  {erreurCouverture}
                </p>
              )}
              <input
                ref={champImage}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                data-testid="champ-image"
                onChange={(e) => {
                  const fichier = e.target.files?.[0];
                  if (fichier) void choisirImage(fichier);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={champ("titre-infos")} className={CARTE}>
          <Heading level="card" as="h2">
            <span id={champ("titre-infos")}>Informations</span>
          </Heading>
          <Field label="Titre" htmlFor={champ("titre")} error={erreurs.titre}>
            <TextInput id={champ("titre")} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} required />
          </Field>
          <Field label="Auteur" htmlFor={champ("auteur")} hint="Une personne, un organisme, ou Étudium." error={erreurs.auteur}>
            <TextInput id={champ("auteur")} value={auteur} onChange={(e) => setAuteur(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Résumé" htmlFor={champ("resume")} hint="Affiché sur la fiche du livre : de quoi il parle, à qui il sert." error={erreurs.resume}>
            <Textarea id={champ("resume")} value={resume} onChange={(e) => setResume(e.target.value)} rows={4} maxLength={2000} />
          </Field>
          <div className={GRILLE}>
            <Field label="Langue" htmlFor={champ("langue")} error={erreurs.langue}>
              <Select id={champ("langue")} options={LANGUES} value={langue} onValueChange={setLangue} />
            </Field>
            <Field label="Année" htmlFor={champ("annee")} error={erreurs.annee}>
              <TextInput id={champ("annee")} value={annee} onChange={(e) => setAnnee(e.target.value)} inputMode="numeric" maxLength={4} placeholder="2025" />
            </Field>
            <Field label="Nombre de pages" htmlFor={champ("pages")} hint={pdf ? "Lu dans le PDF." : "Lu dans le PDF au dépôt."} error={erreurs.nbPages}>
              <TextInput id={champ("pages")} value={nbPages} onChange={(e) => setNbPages(e.target.value)} inputMode="numeric" maxLength={6} />
            </Field>
          </div>
          <Field label="Mots-clés" htmlFor={champ("mots")} hint="Séparés par des virgules : ils aident la recherche." error={erreurs.motsCles}>
            <TextInput
              id={champ("mots")}
              value={motsCles}
              onChange={(e) => setMotsCles(e.target.value)}
              maxLength={600}
              placeholder="mémoire, méthodologie, rédaction"
            />
          </Field>
        </section>

        <section aria-labelledby={champ("titre-classement")} className={CARTE}>
          <Heading level="card" as="h2">
            <span id={champ("titre-classement")}>Classement</span>
          </Heading>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Catégorie" htmlFor={champ("categorie")} error={erreurs.categorieId} className="min-w-0 flex-[1_1_240px]">
              <Select
                id={champ("categorie")}
                options={[{ value: "", label: "Aucune" }, ...categories.map((c) => ({ value: c.id, label: c.nom }))]}
                value={categorieId}
                onValueChange={setCategorieId}
              />
            </Field>
            <Button type="button" variant="contour" className="h-12" onClick={() => setCreationCategorie(true)}>
              Créer une catégorie
            </Button>
          </div>
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 p-0 text-sm leading-5 font-medium text-encre">Parcours</legend>
            <p className="m-0 mb-1 text-[13px] leading-5 text-discret">Aucun, un ou plusieurs : le livre apparaîtra dans les filtres de ces parcours.</p>
            {parcours.length === 0 ? (
              <p className="m-0 text-[13px] leading-5 text-discret">Aucun parcours : créez-en un dans la rubrique Parcours.</p>
            ) : (
              parcours.map((p) => (
                <Checkbox
                  key={p.id}
                  label={p.nom}
                  checked={parcoursCoches.includes(p.id)}
                  onChange={(e) => setParcoursCoches((liste) => (e.target.checked ? [...liste, p.id] : liste.filter((x) => x !== p.id)))}
                />
              ))
            )}
          </fieldset>
        </section>

        <section aria-labelledby={champ("titre-reglages")} className={CARTE}>
          <Heading level="card" as="h2">
            <span id={champ("titre-reglages")}>Réglages</span>
          </Heading>
          <RadioGroup
            label="Accès"
            showLabel
            name={champ("acces")}
            value={acces}
            onValueChange={(v) => setAcces(v === "gratuit" ? "gratuit" : "abonnes")}
            options={[
              {
                value: "abonnes",
                label: "Inclus dans l’abonnement : lu par les abonnés",
              },
              {
                value: "gratuit",
                label: "Gratuit : lu par tout compte connecté",
              },
            ]}
          />
          <Switch
            label="Téléchargement autorisé"
            description="Les lecteurs peuvent enregistrer le PDF. Sinon, le livre se lit dans le site seulement."
            checked={telechargeable}
            onCheckedChange={setTelechargeable}
          />
          <div className="flex flex-col gap-1.5 rounded-champ border border-bordure-carte bg-page p-4">
            <Checkbox
              label={<span className="font-medium text-encre">J’ai le droit de diffuser ce livre</span>}
              checked={droits}
              onChange={(e) => setDroits(e.target.checked)}
            />
            <p className="m-0 pl-7 text-[13px] leading-5 text-pretty text-discret">
              Je l’ai écrit (moi ou un formateur d’Étudium), son auteur a donné son accord écrit, ou il est libre de droits. Obligatoire pour publier.
            </p>
            {erreurs.droitsConfirmes && (
              <p role="alert" className="m-0 pl-7 text-[13px] leading-5 text-erreur-texte">
                {erreurs.droitsConfirmes}
              </p>
            )}
          </div>
        </section>

        <div className="flex max-w-[680px] justify-end">
          <Button type="submit" loading={occupe} disabled={lecturePdf || fabrication} className="max-sm:w-full">
            {libelleBouton(envoi, nouveau)}
          </Button>
        </div>
      </form>

      {/* Hors du formulaire du livre : l'envoi de cette fenêtre ne doit pas remonter jusqu'à lui (portail React). */}
      <FenetreNouvelleCategorie
        ouverte={creationCategorie}
        onOuverteChange={setCreationCategorie}
        onCreee={(c) => {
          // La nouvelle option d'abord, puis le choix : la liste (Radix) remettrait à vide une valeur qu'elle n'a pas encore.
          flushSync(() => setCategories((liste) => [...liste, c]));
          setCategorieId(c.id);
          toast({ tone: "reussite", title: "Catégorie créée" });
        }}
      />
    </>
  );
}
