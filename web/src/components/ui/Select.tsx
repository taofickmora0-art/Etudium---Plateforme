"use client";

import { useEffect, useInsertionEffect, useRef, useState, type ComponentPropsWithoutRef, type FocusEventHandler } from "react";
import { ArrowDown01Icon, ArrowUp01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { menuItemClasses, menuSurfaceClasses } from "./Menu";
import { isInvalid } from "./TextInput";

export type SelectOption = { value: string; label: string; icon?: IconSvgElement };

export type SelectProps = {
  /**
   * Les choix. Une option de valeur `""` est un vrai choix (« Aucun », « Tous les parcours ») ; pour une simple
   * invitation à choisir (« Choisir… »), passer `placeholder` à la place.
   */
  options: SelectOption[];
  /** Valeur choisie (liste contrôlée) ; `""` sans option vide : l'indication s'affiche. */
  value?: string;
  /** Valeur de départ (liste libre). Sans elle ni indication, la première option, comme une liste du système. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Indication grise tant que rien n'est choisi ; le formulaire envoie alors une valeur vide. */
  placeholder?: string;
  /** Nom du champ dans un formulaire envoyé. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Relie le libellé (`Field`, `<label htmlFor>`) au déclencheur. */
  id?: string;
  /** Champ en erreur : bordure rouge et `aria-invalid`. `Field` le règle tout seul quand il a un `error`. */
  invalid?: boolean;
  "aria-invalid"?: ComponentPropsWithoutRef<"button">["aria-invalid"];
  "aria-describedby"?: string;
  "aria-label"?: string;
  /** Le focus quitte le déclencheur (il passe aussi dans la liste quand elle s'ouvre). */
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  /**
   * À la fermeture, la liste rend le focus à son déclencheur. Renvoyer faux pour le laisser ailleurs : l'éditeur de
   * texte, par exemple, reprend le sien (et sa sélection) après un choix dans sa barre d'outils.
   */
  rendreLeFocus?: () => boolean;
  /** Classes du déclencheur (hauteur, largeur, taille du texte d'une liste compacte). */
  className?: string;
};

// Radix réserve la valeur "" à « rien de choisi » : une option vide passe sous ce nom, le temps de la liste.
const OPTION_VIDE = "__etudium-option-vide__";

// Planche « Formulaires » (champ de 48 px) et planche « Menus », « Liste de choix ouverte » : même habillage que les
// autres champs, flèche qui se retourne à l'ouverture, indication grise tant que rien n'est choisi. Une liste compacte
// (barre d'outils, sondage) garde au doigt une zone de 44 px (cible-tactile).
const declencheurClasses =
  "group cible-tactile relative box-border flex h-12 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-champ border border-bordure-champ bg-panneau px-3.5 text-left text-[15px] text-texte outline-none transition-[border-color,box-shadow] focus-visible:border-bleu focus-visible:shadow-focus aria-[invalid=true]:border-erreur-vif disabled:cursor-not-allowed disabled:bg-page disabled:text-discret data-[placeholder]:text-indice data-[state=open]:border-bleu data-[state=open]:shadow-focus";
const defilementClasses = "flex h-6 flex-none cursor-default items-center justify-center text-discret";

/**
 * Liste déroulante au dessin d'Étudium (Radix Select) : la liste ouverte est la surface des menus, l'option choisie
 * cochée ; flèches, Entrée, Échap et recherche par la frappe au clavier ; une longue liste (pays) défile.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  name,
  required,
  disabled,
  id,
  invalid,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
  "aria-label": ariaLabel,
  onBlur,
  rendreLeFocus,
  className,
}: SelectProps) {
  const controlee = value !== undefined;
  const depart = defaultValue ?? (placeholder === undefined ? options[0]?.value : undefined);
  const [libre, setLibre] = useState(depart);
  const courante = controlee ? value : libre;
  const optionVide = options.some((o) => o.value === "");
  const versListe = (v: string | undefined) => (v === "" && optionVide ? OPTION_VIDE : (v ?? ""));
  const libelle = options.find((o) => o.value === courante)?.label;

  // Une remise à zéro du formulaire (après une action serveur, React la fait de lui-même) ramène la valeur de départ
  // la plus récente, comme un champ de texte, et non celle du premier affichage. React la fait pendant l'application du
  // rendu qui apporte cette valeur, avant les useEffect : la référence se met donc à jour dans un useInsertionEffect.
  const declencheur = useRef<HTMLButtonElement>(null);
  const departActuel = useRef(depart);
  useInsertionEffect(() => {
    departActuel.current = depart;
  });
  useEffect(() => {
    const formulaire = declencheur.current?.closest("form");
    if (controlee || !formulaire) return;
    const remettre = () => setLibre(departActuel.current);
    formulaire.addEventListener("reset", remettre);
    return () => formulaire.removeEventListener("reset", remettre);
  }, [controlee]);

  const choisir = (v: string) => {
    const choix = v === OPTION_VIDE ? "" : v;
    if (!controlee) setLibre(choix);
    onValueChange?.(choix);
  };

  return (
    <>
      <RadixSelect.Root value={versListe(courante)} onValueChange={choisir} required={required} disabled={disabled}>
        <RadixSelect.Trigger
          ref={declencheur}
          id={id}
          // Le bouton n'appartient à aucun formulaire : Radix y remettrait sinon, à chaque remise à zéro, la valeur du
          // premier affichage. La remise à zéro est gérée plus haut ; la valeur part avec le champ caché ci-dessous.
          form=""
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedby}
          aria-invalid={isInvalid(invalid, ariaInvalid)}
          onBlur={onBlur}
          className={cn(declencheurClasses, className)}
        >
          <span className="min-w-0 flex-1 truncate">
            {/* Le libellé est donné ici : il paraît dès le rendu serveur, sans attendre la liste. */}
            <RadixSelect.Value placeholder={placeholder}>{libelle}</RadixSelect.Value>
          </span>
          <RadixSelect.Icon className="flex flex-none text-discret transition-transform group-data-[state=open]:rotate-180">
            <Icon icon={ArrowDown01Icon} size={18} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={2}
            collisionPadding={8}
            onCloseAutoFocus={(e) => {
              if (rendreLeFocus && !rendreLeFocus()) e.preventDefault();
            }}
            className={cn(
              menuSurfaceClasses,
              "w-[var(--radix-select-trigger-width)] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-40",
            )}
          >
            <RadixSelect.ScrollUpButton className={defilementClasses}>
              <Icon icon={ArrowUp01Icon} size={16} />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport>
              {options.map((o) => (
                <RadixSelect.Item
                  key={o.value}
                  value={versListe(o.value)}
                  className={cn(menuItemClasses, "text-[15px] leading-[22px] font-medium data-[state=checked]:bg-coque max-sm:text-sm max-sm:leading-5")}
                >
                  {o.icon && <Icon icon={o.icon} size={20} />}
                  <span className="min-w-0 flex-1">
                    <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  </span>
                  <RadixSelect.ItemIndicator className="flex flex-none">
                    <Icon icon={Tick02Icon} size={18} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className={defilementClasses}>
              <Icon icon={ArrowDown01Icon} size={16} />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {name !== undefined && <input type="hidden" name={name} value={courante ?? ""} disabled={disabled} />}
    </>
  );
}
