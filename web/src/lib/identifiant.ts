/**
 * Un identifiant aléatoire (UUID v4), pour nommer les fichiers que le navigateur dépose. `crypto.randomUUID` n'existe
 * que sur https ou localhost : en http sur le Wi-Fi (essais sur téléphone), l'identifiant est construit avec
 * `crypto.getRandomValues`, disponible partout.
 */
export function identifiantAleatoire(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const h = Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
