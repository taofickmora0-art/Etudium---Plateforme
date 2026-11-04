import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Heading } from "@/components/ui/Text";
import { lireContacts, lireConversations, lireFil, MIGRATION_MESSAGES } from "@/lib/messages/data";
import type { EspaceMessages } from "@/lib/messages/types";
import { Messagerie } from "./Messagerie";

/**
 * La page Messages d'un espace (lot 5, étape A) : les conversations, celle choisie par `?c=` (l'ouvrir la marque lue),
 * et à qui écrire. Les deux volets restent montés d'une conversation à l'autre (la liste garde sa place et sa
 * recherche). Avant la 0035, le bandeau de la migration pour l'équipe, un message neutre pour les autres.
 */
export async function PageMessages({ espace, base, c }: { espace: EspaceMessages; base: string; c: string | null }) {
  const [conversations, fil, contacts] = await Promise.all([
    lireConversations(espace),
    c ? lireFil(c) : null,
    espace === "equipe" ? null : lireContacts(espace),
  ]);
  if (conversations.migrationAbsente) {
    return (
      <div className="flex max-w-[960px] min-w-0 flex-col gap-6">
        <Heading level="page">Messages</Heading>
        {espace === "equipe" ? (
          <Banner tone="attention" title="La messagerie n’est pas encore dans la base.">
            {MIGRATION_MESSAGES}
          </Banner>
        ) : (
          <BandeauIndisponible />
        )}
      </div>
    );
  }
  return (
    <Messagerie
      espace={espace}
      base={base}
      conversations={conversations.donnees}
      fil={fil && !fil.migrationAbsente ? fil.donnees : null}
      choisie={c}
      contacts={contacts && !contacts.migrationAbsente ? contacts.donnees : []}
    />
  );
}
