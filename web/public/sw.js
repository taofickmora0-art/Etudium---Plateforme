// Service worker d'Étudium (lot 5, étape B) : il affiche les notifications push et, au clic, ouvre la page concernée.
// Il ne met rien en cache et n'intercepte aucune requête. Il est enregistré dès l'espace connecté : avec lui, Chrome
// propose d'installer l'application (« Installer l'application », menu du profil).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Prend la main sur les onglets déjà ouverts : au clic, ils peuvent changer de page.
  event.waitUntil(self.clients.claim());
});

// Chrome demande encore un gestionnaire « fetch » pour proposer l'installation. Vide : Chrome le reconnaît et ne
// réveille pas le service worker pour lui ; chaque requête va au réseau comme avant, rien n'est mis en cache.
self.addEventListener("fetch", () => {});

/**
 * Un lien interne (« /… », comme les liens enregistrés par la base) ; tout autre lien mène à l'accueil. Ni espace, ni
 * tabulation, ni barre oblique inversée : new URL les retire ou les change, et « /<tabulation>/site » sortirait du site.
 */
function lienInterne(lien) {
  return typeof lien === "string" && /^\/(?!\/)[^\s\\]*$/.test(lien) ? lien : "/accueil";
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
      // Une notification par page (une conversation, une annonce…) : la nouvelle remplace la précédente et sonne encore.
      tag: lienInterne(contenu.lien),
      renotify: true,
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
