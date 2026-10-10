"use client";

import { useState } from "react";
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { controlClasses, isInvalid, type TextInputProps } from "./TextInput";

/** Mot de passe avec bouton œil pour l'afficher ou le masquer. */
export function PasswordInput({ invalid, className, "aria-invalid": ariaInvalid, ...props }: Omit<TextInputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        type={visible ? "text" : "password"}
        aria-invalid={isInvalid(invalid, ariaInvalid)}
        className={cn(controlClasses, "pr-12", className)}
        {...props}
      />
      <IconButton
        icon={visible ? ViewOffSlashIcon : ViewIcon}
        label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        variant="discret"
        size="sm"
        disabled={props.disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1.5 right-1.5"
      />
    </span>
  );
}
