import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { LienContact, LienPage, Liste, MISE_A_JOUR, P, SousTitre, TexteJuridique, type SectionJuridique } from "@/components/juridique/TexteJuridique";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Conditions d’utilisation · Étudium",
  description:
    "Les règles d’utilisation d’Étudium : votre compte, les abonnements et le paiement par Mobile Money, les remboursements, les certificats, la communauté et la messagerie.",
};

// Le texte décrit ce que fait vraiment la plateforme (inscription, abonnements, Payiz, annulation au back-office,
// certificats, modération, suspension et suppression de compte). Toute évolution du service doit s’y retrouver, avec
// une nouvelle date de mise à jour (MISE_A_JOUR).
const SECTIONS: SectionJuridique[] = [
  {
    id: "editeur",
    titre: "Qui édite Étudium",
    contenu: (
      <>
        <P>
          Étudium est un service de formation en ligne pour les étudiants et les jeunes diplômés, accessible sur le site etudium.online et dans
          l’application installée depuis le navigateur. Étudium est un service édité par l’équipe Étudium, basée à Parakou (Bénin).
        </P>
        <P>
          Pour toute question, écrivez-nous à <LienContact />.
        </P>
        <P>Dans ce texte, « nous » désigne l’équipe Étudium, et « vous » la personne qui utilise le service.</P>
      </>
    ),
  },
  {
    id: "acceptation",
    titre: "Acceptation des conditions",
    contenu: (
      <>
        <P>
          En créant un compte, avec votre adresse e-mail ou avec Google, vous acceptez ces conditions et la{" "}
          <LienPage href="/confidentialite">politique de confidentialité</LienPage>. Si vous ne les acceptez pas, n’utilisez pas Étudium.
        </P>
        <P>
          Sans compte, vous pouvez consulter le catalogue et les fiches des formations, et vérifier un certificat. Ces conditions s’appliquent aussi à
          cet usage.
        </P>
        <P>Si vous êtes mineur, demandez l’accord de vos parents ou de votre tuteur avant de créer un compte et avant tout paiement.</P>
      </>
    ),
  },
  {
    id: "compte",
    titre: "Votre compte",
    contenu: (
      <>
        <P>
          Vous créez votre compte avec votre prénom, votre nom, votre adresse e-mail et un mot de passe d’au moins 8 caractères. Vous confirmez
          ensuite votre adresse avec le code reçu par e-mail. Vous pouvez aussi vous inscrire avec votre compte Google.
        </P>
        <Liste>
          <li>Donnez des informations exactes : votre prénom et votre nom figurent sur vos certificats.</li>
          <li>Votre compte est personnel. Ne le partagez pas et ne prêtez pas vos identifiants. Vous êtes responsable de ce qui est fait avec votre compte.</li>
          <li>
            Gardez votre mot de passe secret. Si vous pensez qu’une autre personne le connaît, changez-le dans « Mon profil », onglet Sécurité, et
            prévenez-nous.
          </li>
          <li>
            Vous pouvez supprimer votre compte à tout moment, dans « Mon profil », onglet Sécurité. La suppression est définitive. La{" "}
            <LienPage href="/confidentialite#conservation">politique de confidentialité</LienPage> précise ce qui est effacé et ce qui est gardé.
          </li>
        </Liste>
      </>
    ),
  },
  {
    id: "formations",
    titre: "Formations et certificats",
    contenu: (
      <>
        <SousTitre>Ce que vous trouvez sur Étudium</SousTitre>
        <Liste>
          <li>
            Un compte gratuit donne accès aux formations gratuites, au catalogue, au suivi de votre progression, à vos certificats et à une partie de
            la communauté.
          </li>
          <li>Les formations payantes peuvent proposer des leçons en aperçu, ouvertes sans abonnement.</li>
          <li>
            Un abonnement ouvre toutes les formations, tous les espaces de la communauté, les sessions en direct et leurs replays (voir la section
            « Abonnements »).
          </li>
          <li>Le catalogue évolue : nous pouvons ajouter, mettre à jour ou retirer des formations.</li>
        </Liste>
        <SousTitre>Les certificats</SousTitre>
        <P>
          Quand vous terminez une formation (leçons terminées, quiz réussis et, si la formation le demande, exercices validés), Étudium vous délivre
          un certificat. Il porte un identifiant unique et un QR Code.
        </P>
        <P>
          N’importe qui peut le vérifier, sans compte, sur la page <LienPage href="/verifier">Vérifier un certificat</LienPage>. Cette page affiche
          votre prénom et votre nom, la formation, le formateur, le parcours et la date de délivrance. Vous pouvez télécharger votre certificat en
          PDF et partager son lien de vérification.
        </P>
        <P>
          Un certificat atteste que vous avez suivi et terminé une formation sur Étudium. Ce n’est pas un diplôme délivré par l’État ou par un
          établissement d’enseignement.
        </P>
      </>
    ),
  },
  {
    id: "abonnements",
    titre: "Abonnements",
    contenu: (
      <>
        <P>Trois abonnements sont proposés. Ils ne diffèrent que par leur durée, et chacun ouvre toutes les formations :</P>
        <Liste>
          <li>Basique : 3 mois ;</li>
          <li>Standard : 6 mois ;</li>
          <li>Premium : 1 an.</li>
        </Liste>
        <Liste>
          <li>
            Les prix sont affichés en francs CFA sur le site et avant le paiement. Le prix affiché est le prix payé : les frais du paiement sont à notre
            charge.
          </li>
          <li>L’abonnement commence dès que le paiement est confirmé.</li>
          <li>Un abonnement pris avant la fin du précédent ajoute sa durée à la date de fin.</li>
          <li>
            Il n’y a ni reconduction ni prélèvement automatique. Des rappels vous sont envoyés 7 jours avant la fin, la veille et le jour de
            l’expiration. Vous renouvelez si vous le souhaitez.
          </li>
          <li>
            À la fin de l’abonnement, les formations payantes se verrouillent. Rien n’est supprimé : votre progression, vos certificats et vos
            publications restent. Tout se rouvre dès que vous renouvelez.
          </li>
          <li>L’équipe peut aussi vous attribuer un abonnement, réglé autrement ou offert. Il fonctionne de la même façon.</li>
        </Liste>
        <SousTitre>Les codes promo</SousTitre>
        <P>
          Un code promo donne une remise sur un abonnement. Chaque code ne sert qu’une fois par compte, pendant ses dates de validité et dans la
          limite de ses utilisations. Il ne peut pas être échangé contre de l’argent.
        </P>
      </>
    ),
  },
  {
    id: "paiement",
    titre: "Paiement et remboursements",
    contenu: (
      <>
        <P>
          Le paiement se fait par Mobile Money (MTN ou Moov), sans quitter Étudium, par l’intermédiaire de notre prestataire de paiement Payiz.
          Vous saisissez votre numéro, puis vous validez la demande sur votre téléphone.
        </P>
        <Liste>
          <li>Votre accès s’ouvre dès que le paiement est confirmé. Votre reçu est disponible dans « Mon abonnement ».</li>
          <li>Si le paiement n’aboutit pas (solde insuffisant, refus, délai dépassé), l’abonnement ne s’ouvre pas. Vous pouvez réessayer.</li>
          <li>Étudium ne conserve ni votre code secret Mobile Money, ni votre numéro complet.</li>
        </Liste>
        <SousTitre>Les remboursements</SousTitre>
        <P>
          Pour demander un remboursement, écrivez à <LienContact /> en indiquant le numéro de votre reçu et la raison de votre demande. Chaque
          demande est étudiée au cas par cas.
        </P>
        <P>
          Si un remboursement est accordé, il passe par Payiz, et l’abonnement concerné est annulé : l’accès qu’il ouvrait se ferme aussitôt, et
          vous en êtes prévenu.
        </P>
      </>
    ),
  },
  {
    id: "communaute",
    titre: "Communauté et messagerie",
    contenu: (
      <>
        <P>
          Dans la communauté, vous pouvez publier, répondre, réagir et voter dans des sondages. Sous les leçons, vous pouvez commenter. La messagerie
          vous permet d’écrire aux formateurs de vos formations et à l’équipe Étudium, avec des pièces jointes.
        </P>
        <Liste>
          <li>Vos publications et vos réponses sont visibles des membres qui ont accès à l’espace concerné, avec votre nom et votre photo.</li>
          <li>Vous restez responsable de ce que vous publiez et de ce que vous envoyez.</li>
          <li>
            En publiant, vous autorisez Étudium à afficher votre contenu sur la plateforme, aux membres concernés, tant qu’il reste en ligne. Vos
            contenus restent les vôtres.
          </li>
          <li>Un message envoyé dans la messagerie ne peut pas être retiré.</li>
        </Liste>
      </>
    ),
  },
  {
    id: "conduite",
    titre: "Règles de conduite",
    contenu: (
      <>
        <P>Respectez les autres membres, les formateurs et l’équipe. Sur Étudium, il est interdit :</P>
        <Liste>
          <li>d’envoyer du spam, de la publicité non sollicitée ou des messages répétés ;</li>
          <li>de proposer des arnaques, de fausses offres ou de demander de l’argent ;</li>
          <li>de publier des contenus illicites, haineux, violents, harcelants, discriminatoires ou pornographiques ;</li>
          <li>de vous faire passer pour une autre personne ;</li>
          <li>de publier les données personnelles d’une autre personne sans son accord ;</li>
          <li>de partager des contenus dont vous n’avez pas les droits, notamment les contenus des formations ;</li>
          <li>de chercher à contourner les protections du service ou à accéder au compte d’une autre personne.</li>
        </Liste>
      </>
    ),
  },
  {
    id: "moderation",
    titre: "Modération et sanctions",
    contenu: (
      <>
        <Liste>
          <li>Chaque membre peut signaler une publication ou une réponse. Les signalements arrivent à l’équipe, qui les examine.</li>
          <li>
            Lorsqu’elle est activée, une analyse automatique par un service d’intelligence artificielle (Anthropic) vérifie les nouvelles
            publications. Elle peut les laisser paraître, les signaler à l’équipe ou les bloquer. L’équipe peut rétablir une publication bloquée.
          </li>
        </Liste>
        <P>En cas de manquement à ces conditions, l’équipe peut, selon la gravité :</P>
        <Liste>
          <li>retirer le contenu concerné (son auteur en est prévenu) ou masquer un avis ;</li>
          <li>suspendre le compte : il ne peut plus se connecter ni utiliser le service ;</li>
          <li>supprimer le compte, de façon définitive.</li>
        </Liste>
        <P>
          Pour contester une décision, écrivez à <LienContact />.
        </P>
      </>
    ),
  },
  {
    id: "contenus",
    titre: "Propriété des contenus",
    contenu: (
      <>
        <P>
          Les formations (vidéos, textes, documents, quiz et exercices), ainsi que le nom, le logo et le design d’Étudium, sont protégés. Ils
          appartiennent à Étudium ou à leurs auteurs, notamment les formateurs.
        </P>
        <P>
          Votre accès est personnel et réservé à votre propre apprentissage. Sans notre accord écrit, il est interdit de copier, d’enregistrer, de
          partager, de diffuser ou de revendre tout ou partie de ces contenus. Les fichiers proposés au téléchargement sont réservés à votre usage
          personnel.
        </P>
      </>
    ),
  },
  {
    id: "responsabilite",
    titre: "Responsabilité et disponibilité",
    contenu: (
      <Liste>
        <li>
          Nous faisons notre possible pour qu’Étudium soit accessible et fonctionne correctement. Le service peut toutefois être interrompu, par
          exemple pour une maintenance, une mise à jour ou une panne chez un prestataire.
        </li>
        <li>
          Les formations transmettent des connaissances et des méthodes. Elles ne garantissent pas un résultat précis, comme la réussite à un
          examen, un emploi ou un revenu.
        </li>
        <li>
          Les vidéos intégrées, les outils des sessions en direct et les liens publiés par les membres mènent à des services extérieurs, qui ont
          leurs propres conditions. Nous n’en sommes pas responsables.
        </li>
        <li>Vous êtes responsable de l’usage que vous faites du service et de vos contenus.</li>
      </Liste>
    ),
  },
  {
    id: "modifications",
    titre: "Modification des conditions",
    contenu: (
      <>
        <P>
          Nous pouvons modifier ces conditions, notamment quand le service évolue. La date de la dernière mise à jour figure en haut de cette page.
        </P>
        <P>
          En cas de changement important, nous vous en informons sur le site ou par e-mail. Si vous continuez à utiliser Étudium ensuite, vous
          acceptez les nouvelles conditions.
        </P>
      </>
    ),
  },
  {
    id: "droit",
    titre: "Droit applicable et contact",
    contenu: (
      <>
        <P>Ces conditions sont soumises au droit béninois.</P>
        <P>
          En cas de désaccord, écrivez-nous d’abord à <LienContact /> : nous chercherons ensemble une solution amiable. À défaut, le litige sera
          porté devant les juridictions compétentes du Bénin.
        </P>
      </>
    ),
  },
];

/** Page publique, ouverte depuis la case à cocher de l’inscription et depuis le pied de page du site. */
export default function Page() {
  return (
    <AuthLayout aside="compte" back={{ href: "/inscription", label: "Retour à l’inscription" }}>
      <AuthHeading title="Conditions d’utilisation">Dernière mise à jour : {MISE_A_JOUR}</AuthHeading>
      <P>
        Ces conditions fixent les règles d’utilisation d’Étudium. Elles vont de pair avec la{" "}
        <LienPage href="/confidentialite">politique de confidentialité</LienPage>, qui explique ce que nous faisons de vos données.
      </P>
      <TexteJuridique sections={SECTIONS} />
      <Button asChild variant="contour" size="lg" className="w-full">
        <Link href="/inscription">Retour à l’inscription</Link>
      </Button>
    </AuthLayout>
  );
}
