// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Delete02Icon, Flag01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it, vi } from "vitest";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Menu } from "@/components/ui/Menu";
import { NotificationsPanel } from "@/components/ui/NotificationsPanel";
import { ProfileMenu } from "@/components/ui/ProfileMenu";
import { SelectMenu } from "@/components/ui/SelectMenu";

const USER = { initials: "AK", name: "Aïcha Kpadé", email: "aicha.k@exemple.com" };

function MenuPublication({ onDelete = () => {} }: { onDelete?: () => void }) {
  return (
    <Menu
      label="Actions de la publication"
      trigger={<button type="button">Actions</button>}
      items={[
        { label: "Modifier", icon: PencilEdit02Icon },
        { label: "Signaler", icon: Flag01Icon },
        { separator: true },
        { label: "Supprimer", icon: Delete02Icon, danger: true, onSelect: onDelete },
      ]}
    />
  );
}

describe("Menus", () => {
  it("le menu s'ouvre et se ferme au clavier", async () => {
    const user = userEvent.setup();
    render(<MenuPublication />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeVisible();
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    // Le contour bleu n'apparaît qu'au clavier (:focus-visible) : la souris garde le simple fond de la planche.
    expect(items[1]).toHaveClass("focus-etudium");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("une action dangereuse est signalée", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<MenuPublication onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const supprimer = screen.getByRole("menuitem", { name: "Supprimer" });
    expect(supprimer).toHaveClass("text-erreur-texte");
    await user.click(supprimer);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("le menu du profil masque le back-office aux étudiants", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ProfileMenu user={USER} roles={["etudiant"]} onSignOut={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.queryByRole("menuitem", { name: "Back-office" })).not.toBeInTheDocument();
    unmount();
    render(<ProfileMenu user={USER} roles={["etudiant", "admin"]} onSignOut={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.getByRole("menuitem", { name: "Back-office" })).toBeInTheDocument();
  });

  it("le menu du profil déconnecte", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<ProfileMenu user={USER} roles={["etudiant"]} onSignOut={onSignOut} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    await user.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("le panneau vide l'annonce", async () => {
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[]} onMarkAllRead={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByText("Vous êtes à jour")).toBeVisible();
  });

  it("FilterMenu applique les cases cochées", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <FilterMenu
        title="Parcours"
        options={[
          { value: "academique", label: "Académique" },
          { value: "digital", label: "Digital" },
          { value: "business", label: "Business" },
        ]}
        values={[]}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Filtrer/ }));
    await user.click(screen.getByRole("checkbox", { name: "Digital" }));
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(onApply).toHaveBeenCalledWith(["digital"]);
  });

  it("la liste de choix sélectionne une option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SelectMenu
        label="Niveau d’études"
        options={[
          { value: "l3", label: "Licence 3" },
          { value: "m1", label: "Master 1" },
        ]}
        value="l3"
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Niveau d’études" }));
    await user.click(screen.getByRole("option", { name: "Master 1" }));
    expect(onValueChange).toHaveBeenCalledWith("m1");
  });
});
