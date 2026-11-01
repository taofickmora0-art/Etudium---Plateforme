// Les adresses de push acceptées (même règle que la migration 0058) : celles des services de push des navigateurs
// (Chrome, Edge, Opera, Samsung : Google ; Firefox : Mozilla ; Safari : Apple ; Windows : WNS). Le serveur n'envoie
// jamais rien à une adresse choisie par un compte.

const SERVICES_PUSH =
  /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//;

export function adresseDePush(v: unknown): v is string {
  return typeof v === "string" && v.length <= 1000 && SERVICES_PUSH.test(v);
}
