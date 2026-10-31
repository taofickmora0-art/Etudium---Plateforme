"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, Image01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChampDate } from "@/components/ui/ChampDate";
import { ChampHeure } from "@/components/ui/ChampHeure";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Heading } from "@/components/ui/Text";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { formatDe, formatParMime } from "@/lib/admin/fichiers";
import type { EspaceEdition } from "@/lib/admin/espace";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { reconnaitreVideo } from "@/lib/communaute/video";
import { identifiantAleatoire } from "@/lib/identifiant";
import { creerSession, modifierSession } from "@/lib/sessions/actions";
import {
  champsDepuis,
  debutDepuis,
  DESCRIPTION_MAX,
  DUREE_PAR_DEFAUT,
  DUREES,
  dureeLisible,
  plateformeDepuisLien,
  refusSession,
  TITRE_MAX,
} from "@/lib/sessions/regles";
import type { DonneesSession, PieceSession, SessionDetail } from "@/lib/sessions/types";
import { aujourdhui } from "@/lib/dates/saisie";
import { createClient } from "@/lib/supabase/client";
import { ApercuSessionCommunaute } from "./ApercuSessionCommunaute";
import { baseSessions } from "./cadre";

type Props = {
  espace: EspaceEdition;
  parcours: { id: string; nomCourt: string }[];
  /** Au back-office seulement : le choix de l'animateur. */
  formateurs?: { id: string; nom: string }[];
  /** En modification : la session telle qu'elle est. */
  initial?: SessionDetail;
  /** Le compte qui programme : l'auteur de la publication, et le dossier de l'affiche. */
  moi?: MoiCommunaute;
};

const SANS_COMPTE: MoiCommunaute = { compteId: "", prenom: "", nom: "", initiales: "", photoUrl: null };
const TYPES_AFFICHE = ["image/jpeg", "image/png", "image/webp"];
const AFFICHE_MAX_OCTETS = 10 * 1024 * 1024;
const REFUS_AFFICHE = "L’affiche doit être une image (JPG, PNG ou WebP), 10 Mo au plus.";
const ECHEC_AFFICHE = "L’affiche n’a pas pu être envoyée. Réessayez.";
const ADRESSE_VIDEO = "Collez l’adresse complète de la vidéo (https://…).";
const LIEN_LIVE = "Le lien du live ne peut pas servir de vidéo de promotion.";

/** L'affiche : déjà déposée (session modifiée) ou choisie dans le navigateur, à déposer à l'enregistrement. */
type Affiche = { deposee: PieceSession | null; fichier: File | null; type: string; extension: string; url: string };

/**
 * Programmer ou modifier une session live (spec des sessions live, §2 et §4 ; promotion, §1). Le formateur anime toujours
 * ses sessions ; l'équipe choisit l'animateur. Le visuel de promotion (une affiche ou une vidéo) paraît avec la session
 * dans la communauté ; à droite, l'aperçu de cette publication. Les limites sont vérifiées ici puis par la base.
 */
export function FormulaireSession({ espace, parcours, formateurs, initial, moi = SANS_COMPTE }: Props) {
  const router = useRouter();
  const id = useId();
  const champFichier = useRef<HTMLInputElement>(null);
  const champs = initial ? champsDepuis(initial.debut) : { date: "", heure: "" };
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(champs.date);
  const [heure, setHeure] = useState(champs.heure);
  const [duree, setDuree] = useState(String(initial?.dureeMinutes ?? DUREE_PAR_DEFAUT));
  const [lien, setLien] = useState(initial?.lien ?? "");
  const [parcoursId, setParcoursId] = useState(initial?.parcours?.id ?? "");
  const [formateurId, setFormateurId] = useState(initial?.formateurId ?? "");
  const [affiche, setAffiche] = useState<Affiche | null>(() =>
    initial?.promoImage
      ? { deposee: initial.promoImage, fichier: null, type: initial.promoImage.type, extension: "", url: initial.promoImage.url ?? "" }
      : null,
  );
  const [videoOuverte, setVideoOuverte] = useState(Boolean(initial?.promoVideo));
  const [video, setVideo] = useState(initial?.promoVideo?.url ?? "");
  const [erreurVisuel, setErreurVisuel] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [maintenant] = useState(() => new Date());

  // Une image choisie dans le navigateur a une adresse « blob: » : rendue en quittant le formulaire ou en la remplaçant.
  const urlLocale = affiche?.fichier ? affiche.url : null;
  useEffect(() => () => void (urlLocale && URL.revokeObjectURL(urlLocale)), [urlLocale]);

  async function choisirAffiche(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    // Le type se lit sur les premiers octets : un « .png » qui n'en est pas un est refusé.
    const type = formatDe(fichier.name, new Uint8Array(await fichier.slice(0, 16).arrayBuffer()));
    const extension = type ? formatParMime(type)?.extensions[0] : undefined;
    if (!type || !extension || !TYPES_AFFICHE.includes(type) || fichier.size < 1 || fichier.size > AFFICHE_MAX_OCTETS) {
      setErreurVisuel(REFUS_AFFICHE);
      return;
    }
    setErreurVisuel(null);
    setVideoOuverte(false);
    setVideo("");
    setAffiche({ deposee: null, fichier, type, extension, url: URL.createObjectURL(fichier) });
  }

  function retirerVisuel() {
    setAffiche(null);
    setVideoOuverte(false);
    setVideo("");
    setErreurVisuel(null);
  }

  /** Dépose l'affiche choisie dans le dossier du compte ; celle déjà déposée est gardée. Null si l'envoi échoue. */
  async function deposer(a: Affiche): Promise<PieceSession | null> {
    if (a.deposee) return a.deposee;
    if (!a.fichier) return null;
    const chemin = `${moi.compteId}/${identifiantAleatoire()}.${a.extension}`;
    try {
      // Une copie typée (sans recopier les octets) transmet le type vérifié, pas celui qu'annonce le navigateur.
      const { error } = await createClient()
        .storage.from("communaute")
        .upload(chemin, a.fichier.slice(0, a.fichier.size, a.type), { contentType: a.type, upsert: false });
      return error ? null : { chemin, nom: a.fichier.name, type: a.type, taille: a.fichier.size };
    } catch {
      return null;
    }
  }

  async function enregistrer() {
    const adresseVideo = videoOuverte ? video.trim() : "";
    const d: DonneesSession = {
      titre: titre.trim(),
      description: description.trim(),
      date,
      heure,
      dureeMinutes: Number(duree),
      lien: lien.trim(),
      parcoursId: parcoursId || null,
      formateurId: espace === "admin" ? formateurId || null : null,
      image: null,
      video: adresseVideo || null,
    };
    // En modification, le début n'est revérifié que s'il change (corriger le lien d'une session en cours).
    const debut = debutDepuis(date, heure);
    const verifierDebut = !initial || debut === null || Date.parse(debut) !== Date.parse(initial.debut);
    const refusVideo = !adresseVideo ? null : plateformeDepuisLien(adresseVideo) !== "En ligne" ? LIEN_LIVE : !reconnaitreVideo(adresseVideo) ? ADRESSE_VIDEO : null;
    const refus = refusSession(d, new Date(), { verifierDebut }) ?? refusVideo;
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    if (affiche) {
      const piece = await deposer(affiche);
      if (!piece) {
        setEnvoi(false);
        setErreur(ECHEC_AFFICHE);
        return;
      }
      d.image = piece;
      setAffiche({ ...affiche, deposee: piece });
    }
    const reponse = initial ? await modifierSession(initial.id, d) : await creerSession(d);
    setEnvoi(false);
    if (!reponse.ok) {
      // Une affiche nouvellement déposée a été retirée par le serveur : elle sera redéposée au prochain essai.
      if (affiche?.fichier) setAffiche({ ...affiche, deposee: null });
      setErreur(reponse.message ?? "L’opération n’a pas abouti. Réessayez.");
      return;
    }
    setErreur(null);
    const cible = initial ? initial.id : "id" in reponse ? reponse.id : "";
    router.push(`${baseSessions(espace)}/${cible}`);
  }

  // L'aperçu : la publication telle qu'elle paraîtra (espace du parcours, plateforme d'après le lien).
  const debutApercu = debutDepuis(date, heure);
  const nomAnimateur =
    espace === "admin" ? (formateurs?.find((f) => f.id === formateurId)?.nom ?? "Équipe Étudium") : `${moi.prenom} ${moi.nom}`.trim() || "Formateur";
  const videoApercu = videoOuverte && video.trim() ? reconnaitreVideo(video.trim()) : null;

  return (
    <div className="flex min-w-0 flex-col gap-8 xl:flex-row xl:items-start">
      <form
        className="flex w-full max-w-[680px] min-w-0 flex-col gap-4 xl:flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void enregistrer();
        }}
      >
        {erreur && <Banner tone="erreur" title={erreur} />}
        <Field label="Titre" htmlFor={`${id}-titre`}>
          <TextInput id={`${id}-titre`} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={TITRE_MAX} />
        </Field>
        <Field label="Description" htmlFor={`${id}-description`} hint="Facultative : ce que la session va aborder.">
          <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={4} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label="Date" htmlFor={`${id}-date`} className="min-w-0 flex-[1_1_180px]">
            <ChampDate id={`${id}-date`} value={date} onChange={setDate} min={aujourdhui()} />
          </Field>
          <Field label="Heure" htmlFor={`${id}-heure`} hint="Heure du Bénin." className="min-w-0 flex-[1_1_140px]">
            <ChampHeure id={`${id}-heure`} value={heure} onChange={setHeure} />
          </Field>
          <Field label="Durée" htmlFor={`${id}-duree`} className="min-w-0 flex-[1_1_140px]">
            <Select id={`${id}-duree`} value={duree} onChange={(e) => setDuree(e.target.value)} options={DUREES.map((m) => ({ value: String(m), label: dureeLisible(m) }))} />
          </Field>
        </div>
        <Field label="Lien du live" htmlFor={`${id}-lien`} hint="Google Meet, Zoom… Il s’affiche aux participants 10 min avant le début.">
          <TextInput id={`${id}-lien`} type="url" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://meet.google.com/…" maxLength={500} />
        </Field>
        <Field label="Parcours" htmlFor={`${id}-parcours`}>
          <Select
            id={`${id}-parcours`}
            value={parcoursId}
            onChange={(e) => setParcoursId(e.target.value)}
            options={[{ value: "", label: "Tous les parcours" }, ...parcours.map((p) => ({ value: p.id, label: p.nomCourt }))]}
          />
        </Field>
        {espace === "admin" && (
          <Field label="Animateur" htmlFor={`${id}-animateur`}>
            <Select
              id={`${id}-animateur`}
              value={formateurId}
              onChange={(e) => setFormateurId(e.target.value)}
              options={[{ value: "", label: "Équipe Étudium" }, ...(formateurs ?? []).map((f) => ({ value: f.id, label: f.nom }))]}
            />
          </Field>
        )}

        {/* Le visuel de promotion : une affiche ou une vidéo, qui paraît avec la session dans la communauté. */}
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte p-4">
          <legend className="px-1 text-sm leading-[22px] font-medium text-encre">Visuel de promotion</legend>
          <p className="m-0 -mt-1 text-[13px] leading-5 text-discret">Facultatif : une affiche (image) ou une vidéo de présentation, pas les deux.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="contour" size="sm" iconLeft={Image01Icon} onClick={() => champFichier.current?.click()}>
              {affiche ? "Changer l’affiche" : "Ajouter une affiche"}
            </Button>
            {!videoOuverte && (
              <Button
                type="button"
                variant="contour"
                size="sm"
                iconLeft={Video01Icon}
                onClick={() => {
                  setAffiche(null);
                  setErreurVisuel(null);
                  setVideoOuverte(true);
                }}
              >
                Ajouter une vidéo
              </Button>
            )}
            {(affiche || videoOuverte) && <IconButton icon={Cancel01Icon} label="Retirer le visuel" variant="discret" size="sm" onClick={retirerVisuel} />}
            <input
              ref={champFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choisir l’affiche"
              hidden
              onChange={(e) => void choisirAffiche(e)}
            />
          </div>
          {affiche && <p className="m-0 truncate text-[13px] leading-5 text-discret">{affiche.fichier?.name ?? affiche.deposee?.nom ?? "Affiche"}</p>}
          {videoOuverte && (
            <Field label="Adresse de la vidéo" htmlFor={`${id}-video`} hint="YouTube, Vimeo, TikTok, Facebook…">
              <TextInput id={`${id}-video`} type="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" maxLength={1000} />
            </Field>
          )}
          {erreurVisuel && (
            <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
              {erreurVisuel}
            </p>
          )}
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" loading={envoi}>
            {initial ? "Enregistrer" : "Programmer la session"}
          </Button>
        </div>
      </form>

      <section aria-labelledby={`${id}-apercu`} className="flex w-full max-w-[560px] min-w-0 flex-col gap-3 xl:sticky xl:top-6 xl:w-[440px] xl:flex-none">
        <Heading level="card" as="h2">
          <span id={`${id}-apercu`}>Aperçu dans la communauté</span>
        </Heading>
        <ApercuSessionCommunaute
          moi={moi}
          role={espace === "admin" ? "equipe" : "formateur"}
          espaceNom={parcours.find((p) => p.id === parcoursId)?.nomCourt ?? "Général"}
          titre={titre}
          description={description}
          affiche={affiche?.url || null}
          video={videoApercu}
          session={
            debutApercu
              ? {
                  id: initial?.id ?? "apercu",
                  debut: debutApercu,
                  dureeMinutes: Number(duree),
                  plateforme: plateformeDepuisLien(lien),
                  animateur: nomAnimateur,
                  statut: "programmee",
                  inscriptions: initial?.inscrits.length ?? 0,
                  inscrit: false,
                }
              : null
          }
          maintenant={maintenant}
        />
      </section>
    </div>
  );
}
