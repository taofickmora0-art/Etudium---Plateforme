import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { LienContact, LienPage, Liste, MISE_A_JOUR, P, SousTitre, TexteJuridique, type SectionJuridique } from "@/components/juridique/TexteJuridique";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Politique de confidentialité · Étudium",
  description:
    "Les données qu’Étudium traite, pourquoi, avec quels prestataires et combien de temps, les cookies utilisés, et comment exercer vos droits.",
};

// Le texte décrit ce que fait vraiment la plateforme : colonnes du profil (0001), cookies (lib/auth/session-cookies.ts),
// paiements avec numéro masqué (0049), suppression d’un compte et ce qui reste (0002, 0013, 0035, 0061), purges
// (0020, 0053, 0058), analyse par l’IA (lib/moderation/analyse.ts). Toute évolution doit s’y retrouver, avec une
// nouvelle date de mise à jour (MISE_A_JOUR).
const SECTIONS: SectionJuridique[] = [
  {
    id: "responsable",
    titre: "Responsable du traitement",
    contenu: (
      <>
        <P>
          Le responsable du traitement de vos données est Étudium, service de formation en ligne édité par l’équipe Étudium, basée à Parakou
          (Bénin).
        </P>
        <P>
          Pour toute question sur vos données, écrivez à <LienContact />.
        </P>
      </>
    ),
  },
  {
    id: "donnees",
    titre: "Les données que nous traitons",
    contenu: (
      <>
        <SousTitre>Votre compte</SousTitre>
        <Liste>
          <li>Votre prénom, votre nom et votre adresse e-mail.</li>
          <li>Votre mot de passe, enregistré sous une forme protégée (hachée) : personne chez Étudium ne peut le lire.</li>
          <li>Si vous vous connectez avec Google : votre nom, votre adresse e-mail et les informations de base de votre profil Google.</li>
        </Liste>
        <SousTitre>Votre profil, si vous le complétez</SousTitre>
        <P>
          Votre photo, votre téléphone, votre pays, votre niveau d’études, votre établissement, votre filière et vos objectifs d’apprentissage. Vos
          préférences de notifications et votre objectif de la semaine.
        </P>
        <SousTitre>Votre apprentissage</SousTitre>
        <Liste>
          <li>Les formations commencées, les leçons ouvertes et terminées, votre avancement dans les vidéos et vos jours d’activité.</li>
          <li>Vos réponses et vos scores aux quiz, vos exercices rendus (fichiers compris) et leurs corrections.</li>
          <li>Vos certificats, vos points et vos badges.</li>
          <li>Vos notes personnelles sur les leçons (vous seul les lisez), vos favoris, vos avis et vos inscriptions aux sessions en direct.</li>
          <li>Les remarques de suivi que vos formateurs peuvent noter à votre sujet (lues par eux et par l’équipe).</li>
        </Liste>
        <SousTitre>Communauté et messagerie</SousTitre>
        <P>
          Vos publications, réponses, réactions, votes aux sondages, signalements et publications enregistrées. Vos commentaires sous les leçons.
          Vos messages et leurs pièces jointes, échangés avec les formateurs et l’équipe.
        </P>
        <SousTitre>Abonnements et paiements</SousTitre>
        <Liste>
          <li>
            L’abonnement choisi et ses dates, le code promo utilisé, le montant, l’état du paiement, le pays et l’opérateur, la référence de la
            transaction chez le prestataire de paiement et le numéro de reçu.
          </li>
          <li>
            Votre numéro de téléphone est transmis au prestataire de paiement (Payiz ou SasPay) pour la demande de paiement. Étudium ne le garde que masqué (par exemple
            +229 •• •• •• •• 00).
          </li>
          <li>Étudium ne reçoit ni ne conserve votre code secret Mobile Money, et ne traite aucune carte bancaire.</li>
        </Liste>
        <SousTitre>Notifications</SousTitre>
        <P>
          Les notifications de l’application. Si vous activez les notifications push, l’adresse technique que votre navigateur fournit pour les
          recevoir. L’historique récent des e-mails et des notifications push envoyés.
        </P>
        <SousTitre>Journal de l’équipe</SousTitre>
        <P>
          Les actions des membres de l’équipe (suspension, suppression d’un compte, abonnement attribué ou annulé, modération…) sont inscrites
          dans un journal interne, avec le nom du compte concerné. Seul l’administrateur principal le lit.
        </P>
        <SousTitre>Données techniques</SousTitre>
        <P>
          Les cookies et le stockage de votre navigateur (voir la section « Cookies et stockage local »). Nos hébergeurs peuvent aussi tenir des
          journaux techniques (adresse IP, date, page demandée) pour la sécurité et le bon fonctionnement du service.
        </P>
      </>
    ),
  },
  {
    id: "finalites",
    titre: "Pourquoi nous les utilisons",
    contenu: (
      <>
        <Liste>
          <li>Créer et sécuriser votre compte, et vous connecter.</li>
          <li>Vous donner accès aux formations, suivre votre progression, délivrer vos certificats et permettre leur vérification.</li>
          <li>Gérer vos abonnements, vos paiements et vos reçus.</li>
          <li>Faire fonctionner la communauté et la messagerie, et les modérer.</li>
          <li>
            Vous envoyer les notifications et les e-mails utiles : code de vérification, nouveau mot de passe, rappels d’abonnement, paiements,
            messages, selon vos préférences.
          </li>
          <li>Vous suggérer des formations d’après votre activité.</li>
          <li>Répondre à vos demandes.</li>
          <li>Établir des statistiques globales pour améliorer le service. Nous les calculons nous-mêmes, sans outil de mesure d’audience extérieur.</li>
          <li>Assurer la sécurité du service et respecter nos obligations légales.</li>
        </Liste>
        <P>
          Ces traitements reposent sur le contrat qui nous lie (les <LienPage href="/conditions">conditions d’utilisation</LienPage>), sur votre
          consentement (par exemple pour les notifications push) ou sur notre intérêt légitime à sécuriser et à améliorer le service.
        </P>
        <P>Nous ne vendons ni ne louons vos données, et Étudium n’affiche aucune publicité.</P>
      </>
    ),
  },
  {
    id: "destinataires",
    titre: "Qui voit vos données",
    contenu: (
      <Liste>
        <li>
          Les autres membres voient votre nom et votre photo avec vos publications, vos réponses et vos réactions, dans les espaces de la
          communauté auxquels ils ont accès, ainsi que vos commentaires sous les leçons. Sous un avis, seuls votre prénom et l’initiale de votre nom
          apparaissent.
        </li>
        <li>
          Vos formateurs voient, pour les formations qu’ils animent, votre progression, vos résultats aux quiz et vos exercices rendus, ainsi que
          les messages que vous leur envoyez.
        </li>
        <li>
          L’équipe Étudium accède, selon son rôle, aux comptes, aux abonnements et aux paiements, aux contenus signalés et aux messages adressés à
          l’équipe. Une conversation entre un étudiant et un formateur n’est lisible que par eux deux.
        </li>
        <li>
          Tout le monde, sans compte, peut vérifier un certificat grâce à son identifiant ou à son QR Code : la page affiche votre prénom et votre
          nom, la formation, le formateur, le parcours et la date.
        </li>
        <li>Votre photo de profil est publique : toute personne qui connaît son adresse peut l’afficher.</li>
        <li>Nos prestataires reçoivent ce qui est nécessaire à leur mission (section suivante).</li>
        <li>Les autorités, si la loi nous y oblige.</li>
      </Liste>
    ),
  },
  {
    id: "prestataires",
    titre: "Nos prestataires",
    contenu: (
      <>
        <Liste>
          <li>Supabase : base de données, fichiers et authentification, hébergés dans l’Union européenne (région de Paris).</li>
          <li>Vercel : hébergement du site.</li>
          <li>Resend : envoi des e-mails.</li>
          <li>Google : connexion avec votre compte Google, si vous la choisissez.</li>
          <li>Payiz : paiements par Mobile Money. Payiz reçoit votre numéro de téléphone, votre pays, le montant et la référence du paiement.</li>
          <li>
            SasPay : paiements par Mobile Money, dans les pays et pour les opérateurs que Payiz ne propose pas. SasPay reçoit votre numéro de
            téléphone, votre pays, vos nom, prénom et adresse e-mail, le montant et la référence du paiement.
          </li>
          <li>
            Anthropic : analyse automatique des publications de la communauté, pour la modération, lorsqu’elle est activée. Anthropic reçoit le
            titre et le texte de la publication, ses liens, l’adresse de sa vidéo et son fichier joint (image ou PDF).
          </li>
          <li>
            YouTube, Vimeo et les autres plateformes qui hébergent les vidéos intégrées (Loom, TikTok, Google Drive…). Elles peuvent déposer leurs
            propres cookies (voir la section « Cookies et stockage local »).
          </li>
          <li>Si vous activez les notifications push : le service de notification de votre navigateur (Google, Mozilla, Apple ou Microsoft).</li>
        </Liste>
        <P>
          Les sessions en direct ont lieu sur un outil extérieur, indiqué dans chaque événement : sa propre politique de confidentialité
          s’applique.
        </P>
        <P>
          Certains de ces prestataires sont établis ou traitent des données hors du Bénin, notamment dans l’Union européenne et aux États-Unis.
          Nous ne leur transmettons que ce qui est nécessaire à leur service.
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    titre: "Cookies et stockage local",
    contenu: (
      <>
        <P>Étudium n’utilise que des cookies nécessaires à son fonctionnement. Il n’y a ni cookie publicitaire, ni outil de mesure d’audience.</P>
        <Liste>
          <li>
            « sb-… » (Supabase) : votre session de connexion. Il dure 30 jours si « Se souvenir de moi » est coché, sinon jusqu’à la fermeture du
            navigateur.
          </li>
          <li>« etudium-souvenir » : votre choix « Se souvenir de moi ». Il dure un an.</li>
          <li>« etudium-verification » : l’adresse e-mail en attente de vérification, pendant 30 minutes.</li>
          <li>« etudium-suite » : la page à retrouver après la vérification de votre adresse, pendant 30 minutes.</li>
        </Liste>
        <P>
          Le stockage local de votre navigateur garde aussi quelques préférences : la barre latérale réduite ou ouverte, le bandeau « Renouveler »
          masqué pour la journée et, pour les formateurs, une copie de secours de ce qu’ils écrivent dans l’éditeur des formations.
        </P>
        <P>
          Les plateformes vidéo peuvent déposer leurs propres cookies quand une vidéo intégrée se charge ou se lance, et Google quand vous vous
          connectez avec Google. Pour YouTube, Étudium utilise le mode de confidentialité renforcée.
        </P>
        <P>Vous pouvez effacer les cookies depuis votre navigateur. Vous serez alors déconnecté.</P>
      </>
    ),
  },
  {
    id: "conservation",
    titre: "Durée de conservation",
    contenu: (
      <>
        <P>Vos données sont conservées tant que votre compte existe. Certaines sont effacées plus tôt :</P>
        <Liste>
          <li>l’historique des e-mails et des notifications push envoyés : effacé après 7 jours ;</li>
          <li>les notifications de l’application : effacées au fur et à mesure après 6 mois ;</li>
          <li>les traces qui servent à limiter les abus (essais de codes promo, nombre d’analyses de modération) : effacées au fur et à mesure après un jour ;</li>
          <li>un appareil inscrit aux notifications push : retiré quand son navigateur ne l’accepte plus, ou au-delà de 10 appareils par compte.</li>
        </Liste>
        <SousTitre>Quand votre compte est supprimé</SousTitre>
        <P>
          Vous pouvez supprimer votre compte dans « Mon profil », onglet Sécurité. L’équipe peut aussi le supprimer (voir les{" "}
          <LienPage href="/conditions#moderation">conditions d’utilisation</LienPage>).
        </P>
        <P>Sont effacés :</P>
        <Liste>
          <li>votre profil et votre photo ;</li>
          <li>votre progression, vos notes, vos favoris, vos points et vos badges ;</li>
          <li>vos résultats aux quiz, vos exercices rendus et leurs fichiers ;</li>
          <li>vos avis, vos publications, vos réponses, vos réactions, vos votes et vos signalements ;</li>
          <li>vos conversations, des deux côtés, et leurs pièces jointes ;</li>
          <li>vos abonnements, vos notifications et vos appareils inscrits.</li>
        </Liste>
        <P>Sont gardés :</P>
        <Liste>
          <li>vos certificats déjà délivrés, qui restent vérifiables à votre nom ;</li>
          <li>
            la trace de vos paiements (date, abonnement, montant, pays, opérateur, numéro masqué, numéro de reçu), détachée de votre compte, pour le suivi
            comptable ;
          </li>
          <li>si l’équipe supprime le compte, une ligne du journal interne avec votre nom, votre adresse e-mail et le motif.</li>
        </Liste>
        <P>Le journal des actions de l’équipe est conservé pour la sécurité du service : il n’est pas effacé avec les comptes.</P>
      </>
    ),
  },
  {
    id: "droits",
    titre: "Vos droits",
    contenu: (
      <>
        <P>
          La loi n° 2017-20 du 20 avril 2018 portant Code du numérique en République du Bénin vous donne des droits sur vos données :
        </P>
        <Liste>
          <li>accès : savoir quelles données nous avons sur vous et en obtenir une copie ;</li>
          <li>
            rectification : corriger vos informations dans « Mon profil », onglet Informations, ou en nous écrivant (par exemple pour changer
            d’adresse e-mail) ;
          </li>
          <li>suppression : supprimer votre compte dans « Mon profil », onglet Sécurité, ou nous le demander ;</li>
          <li>
            opposition : vous opposer à un traitement pour un motif légitime. Vous pouvez aussi couper les notifications dans « Mon profil », onglet
            Notifications.
          </li>
        </Liste>
        <P>
          Pour exercer ces droits, écrivez à <LienContact />, de préférence depuis l’adresse de votre compte. Nous pouvons vous demander de
          confirmer votre identité.
        </P>
        <P>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à l’Autorité de protection des données à
          caractère personnel (APDP) du Bénin.
        </P>
      </>
    ),
  },
  {
    id: "securite",
    titre: "Sécurité",
    contenu: (
      <>
        <P>
          Les échanges avec Étudium sont chiffrés (https). Des règles d’accès strictes protègent vos données : chaque compte ne lit que ce qui le
          concerne, et l’équipe selon son rôle. Vos exercices rendus et les pièces jointes des messages ne sont accessibles qu’aux personnes
          concernées.
        </P>
        <P>
          Aucun système n’est parfaitement sûr. Protégez votre mot de passe, et prévenez-nous à <LienContact /> si vous remarquez une utilisation
          suspecte de votre compte.
        </P>
      </>
    ),
  },
  {
    id: "modifications",
    titre: "Modification de cette politique",
    contenu: (
      <P>
        Nous pouvons mettre à jour cette politique quand le service évolue, par exemple avec un nouveau prestataire ou une nouvelle fonction. La
        date de la dernière mise à jour figure en haut de cette page. En cas de changement important, nous vous en informons sur le site ou par
        e-mail.
      </P>
    ),
  },
  {
    id: "contact",
    titre: "Contact",
    contenu: (
      <P>
        Pour toute question ou demande sur vos données : <LienContact />. Étudium, Parakou, Bénin.
      </P>
    ),
  },
];

/** Page publique, ouverte depuis la case à cocher de l’inscription et depuis le pied de page du site. */
export default function Page() {
  return (
    <AuthLayout aside="compte" back={{ href: "/inscription", label: "Retour à l’inscription" }}>
      <AuthHeading title="Politique de confidentialité">Dernière mise à jour : {MISE_A_JOUR}</AuthHeading>
      <P>
        Cette politique explique quelles données Étudium traite, pourquoi, avec quels prestataires et combien de temps, et comment exercer vos
        droits. Elle complète les <LienPage href="/conditions">conditions d’utilisation</LienPage>.
      </P>
      <TexteJuridique sections={SECTIONS} />
      <Button asChild variant="contour" size="lg" className="w-full">
        <Link href="/inscription">Retour à l’inscription</Link>
      </Button>
    </AuthLayout>
  );
}
