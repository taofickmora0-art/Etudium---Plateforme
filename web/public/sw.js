// Service worker d'Étudium (lot 5, étape B) : il affiche les notifications push et, au clic, ouvre la page concernée.
// Il ne met rien en cache et n'intercepte aucune requête.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Prend la main sur les onglets déjà ouverts : au clic, ils peuvent changer de page.
  event.waitUntil(self.clients.claim());
});

/** Un lien interne (« /… ») ; tout autre lien mène à l'accueil. */
function lienInterne(lien) {
  return typeof lien === "string" && lien.startsWith("/") && !lien.startsWith("//") && !lien.startsWith("/\\") ? lien : "/accueil";
}

self.addEventListener("push", (event) => {
  let contenu = {};
  try {
    contenu = event.data ? event.data.json() : {};
  } catch {
    contenu = {};
  }
  const titre = typeof contenu.titre === "string" && contenu.titre.trim() ? contenu.titre : "Étudium";
  const texte = typeof contenu.texte === "string" ? contenu.texte : "";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: texte,
      icon: "/icons/icone-192.png",
      lang: "fr",
      data: { lien: lienInterne(contenu.lien) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const adresse = new URL(lienInterne(event.notification.data && event.notification.data.lien), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onglet = fenetres.find((f) => new URL(f.url).origin === self.location.origin);
      if (onglet) {
        try {
          await onglet.focus();
          await onglet.navigate(adresse);
          return;
        } catch {
          // Un onglet que le service worker ne contrôle pas ne peut pas changer de page : nouvelle fenêtre.
        }
      }
      await self.clients.openWindow(adresse);
    })(),
  );
});
