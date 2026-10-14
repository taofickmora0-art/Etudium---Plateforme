"use client";

import { useId, useState } from "react";
import { Cancel01Icon, Delete02Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { CarteAnnonce } from "@/components/communaute/CarteAnnonce";
import { Button } from "@/components/ui/Button";
import { choiceInputClasses, choiceRowClasses } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { formatDe, formatParMime } from "@/lib/admin/fichiers";
import { enregistrerAnnonce, retirerAnnonce } from "@/lib/communaute/actions-annonce";
import { idYoutube } from "@/lib/communaute/liens";
import { tailleLisible } from "@/lib/communaute/regles";
import type { AnnonceEquipe, DonneesAnnonce } from "@/lib/communaute/types";
import { createClient } from "@/lib/supabase/client";
import { identifiantAleatoire } from "@/lib/identifiant";

const TITRE_MAX = 120;
const TEXTE_MAX = 500;
const AFFICHE_MAX = 10_485_760;
const TYPES_AFFICHE = ["image/jpeg", "image/png", "image/webp"];
const REFUS_AFFICHE = "Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ECHEC_ENVOI = "L’envoi de l’affiche n’a pas abouti. Réessayez.";

type Media = "youtube" | "image";
/** L'affiche : celle déjà enregistrée (un chemin), ou un fichier choisi, déposé à l'enregistrement. */
type Affiche = { chemin: string | null; fichier: File | null; type: string; extension: string; url: string | null };

const lienLocal = (fichier: File) => (typeof URL.createObjectURL === "function" ? URL.createObjectURL(fichier) : null);

function depuis(a: AnnonceEquipe) {
  return {
    active: a.active,
    titre: a.titre,
    texte: a.texte,
    media: (a.media ?? "youtube") as Media,
    youtube: a.youtubeId ? `https://youtu.be/${a.youtubeId}` : "",
    affiche: (a.imageChemin ? { chemin: a.imageChemin, fichier: null, type: "", extension: "", url: a.image } : null) as Affiche | null,
    public: a.public,
    parcoursId: a.parcoursId ?? "",
  };
}

/**
 * Le réglage de l'annonce épinglée (design NdAdminAnnonceCommunaute ; spec du fil « Actualités », §2) : l'interrupteur,
 * le titre, le texte, une vidéo YouTube ou une affiche, le public, et à droite l'aperçu dans le fil. L'affiche part du
 * navigateur vers le dossier du compte dans l'espace de stockage « communaute » au moment d'enregistrer ; la base vérifie
 * son type et sa taille réels.
 */
export function FormulaireAnnonceCommunaute({ initial, parcours, compteId }: { initial: AnnonceEquipe; parcours: { id: string; nom: string }[]; compteId: string }) {
  const ids = { titre: useId(), texte: useId(), parcours: useId() };
  const { toast } = useToast();
  const [r, setR] = useState(() => depuis(initial));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retrait, setRetrait] = useState(false);
  const [erreurRetrait, setErreurRetrait] = useState<string>();

  const idVideo = idYoutube(r.youtube.trim());
  // Sans adresse ni affiche : pas de média (l'annonce garde son titre et son texte).
  const media = r.media === "youtube" ? (r.youtube.trim() ? "youtube" : null) : r.affiche ? "image" : null;

  async function choisir(fichiers: File[]) {
    const fichier = fichiers[0];
    if (!fichier) return;
    // Le type se lit sur les premiers octets : un « .png » qui n'en est pas un est refusé.
    const type = formatDe(fichier.name, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    const extension = type ? formatParMime(type)?.extensions[0] : undefined;
    if (!type || !extension || !TYPES_AFFICHE.includes(type) || fichier.size > AFFICHE_MAX) {
      setErreur(REFUS_AFFICHE);
      return;
    }
    setErreur(null);
    setR((actuel) => ({ ...actuel, affiche: { chemin: null, fichier, type, extension, url: lienLocal(fichier) } }));
  }

  /** Dépose l'affiche choisie dans le dossier du compte ; null si l'envoi échoue. */
  async function deposer(a: Affiche & { fichier: File }): Promise<string | null> {
    const chemin = `${compteId}/${identifiantAleatoire()}.${a.extension}`;
    try {
      const { error } = await createClient()
        .storage.from("communaute")
        .upload(chemin, a.fichier.slice(0, a.fichier.size, a.type), { contentType: a.type, upsert: false });
      return error ? null : chemin;
    } catch {
      return null;
    }
  }

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      let imageChemin: string | null = null;
      if (media === "image" && r.affiche) {
        imageChemin = r.affiche.fichier ? await deposer({ ...r.affiche, fichier: r.affiche.fichier }) : r.affiche.chemin;
        if (!imageChemin) {
          setErreur(ECHEC_ENVOI);
          return;
        }
      }
      const donnees: DonneesAnnonce = {
        active: r.active,
        titre: r.titre.trim(),
        texte: r.texte.trim(),
        media,
        youtube: media === "youtube" ? r.youtube.trim() : "",
        imageChemin,
        public: r.public,
        parcoursId: r.public === "parcours" && r.parcoursId ? r.parcoursId : null,
      };
      const reponse = await enregistrerAnnonce(donnees).catch(() => ({ ok: false as const, message: ECHEC }));
      if (!reponse.ok) {
        setErreur(reponse.message);
        return;
      }
      // L'affiche déposée est désormais celle de l'annonce.
      if (imageChemin && r.affiche?.fichier) setR((actuel) => ({ ...actuel, affiche: actuel.affiche && { ...actuel.affiche, chemin: imageChemin, fichier: null } }));
      toast({ tone: "reussite", title: "Annonce enregistrée", description: r.active ? "Elle est en haut du fil « Actualités »." : "Elle n’est pas affichée tant que l’interrupteur est coupé." });
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer() {
    const reponse = await retirerAnnonce().catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreurRetrait(reponse.message);
      throw new Error(reponse.message);
    }
    setR(depuis({ active: false, titre: "", texte: "", media: null, youtubeId: null, image: null, imageChemin: null, public: "tous", parcoursId: null }));
    setErreur(null);
    toast({ tone: "reussite", title: "Annonce retirée" });
  }

  const choixPublic = [
    { valeur: "tous", libelle: "Tous les membres", precision: null, desactive: false },
    { valeur: "parcours", libelle: "Les membres d’un parcours", precision: "Ceux qui ont commencé une formation du parcours choisi.", desactive: false },
    { valeur: "formule", libelle: "Une formule d’abonnement", precision: "Avec les abonnements (lot 2).", desactive: true },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
      <form
        className="box-border flex max-w-[640px] min-w-0 flex-1 flex-col gap-5 rounded-carte border border-bordure-carte bg-panneau p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void enregistrer();
        }}
      >
        <Switch
          label="Afficher l’annonce"
          description="Désactivée, elle disparaît du fil sans être supprimée."
          checked={r.active}
          onCheckedChange={(active) => setR({ ...r, active })}
        />
        <div className="h-px bg-bordure-carte" />
        <Field label="Titre" htmlFor={ids.titre}>
          <TextInput id={ids.titre} value={r.titre} maxLength={TITRE_MAX} onChange={(e) => setR({ ...r, titre: e.target.value })} />
        </Field>
        <Field label="Texte" htmlFor={ids.texte} hint={`${r.texte.length} / ${TEXTE_MAX}`}>
          <Textarea id={ids.texte} value={r.texte} maxLength={TEXTE_MAX} rows={4} onChange={(e) => setR({ ...r, texte: e.target.value })} />
        </Field>
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-sm leading-5 font-medium text-encre">Média</span>
          <FilterChips
            label="Type de média"
            options={[
              { value: "youtube", label: "Vidéo YouTube" },
              { value: "image", label: "Affiche" },
            ]}
            value={r.media}
            onValueChange={(valeur) => {
              setErreur(null);
              setR({ ...r, media: valeur as Media });
            }}
          />
          {r.media === "youtube" ? (
            <>
              <TextInput
                aria-label="Adresse de la vidéo YouTube"
                placeholder="https://www.youtube.com/watch?v=…"
                value={r.youtube}
                onChange={(e) => setR({ ...r, youtube: e.target.value })}
              />
              <span className="text-[13px] leading-5 text-discret">
                {r.youtube.trim() && !idVideo ? "Cette adresse YouTube n’est pas reconnue." : "La vidéo se lit dans le fil, sans cookies, au clic du membre."}
              </span>
            </>
          ) : r.affiche ? (
            <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-bordure-carte px-3.5 py-2.5">
              <IconTile icon={Image01Icon} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5 font-medium text-encre">{r.affiche.fichier?.name ?? "Affiche actuelle"}</span>
                {r.affiche.fichier && <span className="text-xs leading-[18px] text-discret">{tailleLisible(r.affiche.fichier.size)}</span>}
              </span>
              <IconButton icon={Cancel01Icon} label="Retirer l’affiche" variant="discret" size="sm" disabled={envoi} onClick={() => setR({ ...r, affiche: null })} />
            </div>
          ) : (
            <FileDrop accept="image/jpeg,image/png,image/webp" maxSizeLabel="JPEG, PNG ou WebP, 10 Mo au plus" title="Déposez l’affiche ici" onFiles={(f) => void choisir(f)} />
          )}
        </div>
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="mb-2.5 p-0 text-sm leading-5 font-medium text-encre">Qui la voit</legend>
          {choixPublic.map((c) => (
            <label key={c.valeur} className={choiceRowClasses}>
              <input
                type="radio"
                name="public-annonce"
                value={c.valeur}
                className={choiceInputClasses}
                checked={r.public === c.valeur}
                disabled={c.desactive}
                onChange={() => setR({ ...r, public: c.valeur as "tous" | "parcours" })}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-encre">{c.libelle}</span>
                {c.precision && <span className="text-[13px] leading-5 text-discret">{c.precision}</span>}
              </span>
            </label>
          ))}
          {r.public === "parcours" && (
            <Field label="Parcours" htmlFor={ids.parcours} className="mt-1 sm:pl-7">
              <Select
                id={ids.parcours}
                value={r.parcoursId}
                onChange={(e) => setR({ ...r, parcoursId: e.target.value })}
                options={[{ value: "", label: "Choisissez un parcours" }, ...parcours.map((p) => ({ value: p.id, label: p.nom }))]}
              />
            </Field>
          )}
        </fieldset>
        {erreur && (
          <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
            {erreur}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-bordure-carte pt-4">
          <Button
            variant="contour"
            iconLeft={Delete02Icon}
            disabled={envoi}
            onClick={() => {
              setErreurRetrait(undefined);
              setRetrait(true);
            }}
          >
            Retirer l’annonce
          </Button>
          <Button type="submit" loading={envoi}>
            Enregistrer
          </Button>
        </div>
        <ConfirmDialog
          open={retrait}
          onOpenChange={setRetrait}
          tone="danger"
          icon={Delete02Icon}
          title="Retirer l’annonce ?"
          description="Elle disparaît du fil. Vous pourrez en écrire une autre."
          confirmLabel="Retirer"
          errorMessage={erreurRetrait}
          onConfirm={retirer}
        />
      </form>
      <aside aria-label="Aperçu dans le fil" className="flex min-w-0 flex-col gap-3 xl:w-[420px] xl:flex-none">
        <h2 className="m-0 text-sm leading-5 font-medium text-discret">Aperçu dans le fil</h2>
        <div className={r.active ? undefined : "opacity-60"}>
          <CarteAnnonce
            annonce={{
              titre: r.titre.trim() || "Titre de l’annonce",
              texte: r.texte.trim(),
              media: media === "youtube" && !idVideo ? null : media,
              youtubeId: idVideo,
              image: media === "image" ? (r.affiche?.url ?? null) : null,
            }}
          />
        </div>
        {!r.active && <p className="m-0 text-[13px] leading-5 text-discret">Interrupteur coupé : l’annonce n’apparaît pas dans le fil.</p>}
      </aside>
    </div>
  );
}
