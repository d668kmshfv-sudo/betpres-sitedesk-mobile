# Individuálne oprávnenia modulov – stav prípravy

Každému kolegovi možno pripraviť pravidlá osobitne pre konkrétnu stavbu a modul. Pracovná pozícia je iba popis. O tom, čo môže človek vidieť a upravovať, rozhodujú samostatné voľby `can_view` a `can_edit`. Úprava vždy vyžaduje zobrazenie.

## Čo je v repozitári

- `supabase/migrations/202611090002_module_permissions.sql` vytvorí `sitedesk_module_people`, `sitedesk_module_grants` a rezervovanú tabuľku `sitedesk_module_records`, RLS pravidlá a RPC na uloženie, načítanie a odobratie práv. Migrácia je transakčná a pred DDL kontroluje závislosti.
- Nastavenia vlastníka v časti **Cloud a databáza** sú označené „Zatiaľ neaktívne“. Umožnia uložiť pravidlá iba po úspešnom načítaní novej RPC z databázy. Vytvorenie účtu ani prístup do hlavnej aplikácie tým nevzniká.
- `sitedesk_module_records` je pre klienta iba na čítanie. Zápis, zmena aj vymazanie sú zatiaľ zakázané. Nikto nemôže nepozorovane prepísať záznam bez budúcej kontroly verzie a auditu.

## Prečo sú práva zatiaľ neaktívne

Hlavná aplikácia ukladá všetky moduly jednej stavby do jedného JSON záznamu `sitedesk_workspaces.data`. Staré roly **Editor** a **Čítanie** môžu načítať celý tento záznam. Skrytie menu alebo políčok vo webovom prehliadači by dáta neochránilo. Používateľ s obmedzenými právami nesmie byť pridaný do starého zoznamu členov pracovného priestoru. RPC na prípravu práv to pri udeľovaní kontroluje a neznámy formát zoznamu odmietne.

V produkčnej databáze nie sú v repozitári definície existujúcich RPC ani presná schéma členských tabuliek. Migráciu treba najprv overiť v testovacej databáze. Samotné nasadenie tejto migrácie **neaktivuje obmedzený prístup**.

## Podmienky aktivácie

1. Skontrolovať v cieľovej databáze signatúry a správanie `sitedesk_current_role(uuid)`, `sitedesk_list_members(uuid)`, `sitedesk_workspaces` a ich RLS. Migrácia sa pri chýbajúcich závislostiach vráti späť bez čiastočného nasadenia.
2. Vytvoriť samostatného klienta pre obmedzené účty, ktorý nikdy nenačítava `sitedesk_workspaces.data` ani staré lokálne zálohy plného pracovného priestoru. Prístup musí ísť výlučne cez serverom oddelené záznamy stavby a modulu.
3. Pre každý modul zaviesť explicitný formát a serverovú kontrolu povolených polí. Z hlavného JSON premiestniť len príslušné dáta. Pri zápise zaviesť optimistickú verziu záznamu, nemenný audit a pravidlá uzatvárania; až potom povoliť `can_edit` operácie cez modulové RPC. Pritom zachovať existujúce údaje a bezpečnú synchronizáciu s hlavnou aplikáciou.
4. Overiť test dvoma účtami a potom aktívne role kolegov preniesť bez udelenia starej plnej roly. Až po úspešnom overení zmeniť označenie „Zatiaľ neaktívne“ v UI.

## Povinný test dvoma účtami pred sprístupnením

Vlastník nastaví pre účet A na stavbe X iba zobrazenie denníka, pre účet B na stavbe X úpravu pracovníkov. Na stavbe Y nedá žiadne práva. Potom priamo cez REST a RPC, nielen kliknutím v rozhraní, overí:

- A vidí iba denník X a nedokáže ho zmeniť; B dokáže meniť iba pracovníkov X. Ani jeden nevidí ani nemení stavbu Y a ostatné moduly X.
- Priamy `GET /rest/v1/sitedesk_workspaces` a `sitedesk_save_workspace` nikdy nevydajú ani nezmenia celý JSON pre obmedzený účet.
- Priame `SELECT`, `INSERT`, `UPDATE`, `DELETE` na modulových tabuľkách a pokus zmeniť `workspace_id`, `project_id` alebo `module_key` rešpektujú RLS a práva stĺpcov. V terajšej prípravnej fáze musia všetky klientské zápisy do `sitedesk_module_records` zlyhať.
- A ani B nedokážu volať vlastnícke RPC na pridanie alebo odobratie práv. Neplatný modul, neplatné JSON hodnoty, nepotvrdený účet a účet s plnou rolou sú odmietnuté.
- Odobratie práv sa prejaví po obnovení tokenu aj pri otvorení ďalšej karty; zdieľaný prehliadač nevydá staré údaje z lokálnej pamäte. Súbežné úpravy neprepíšu novšiu verziu a všetky zmeny zostanú v audite.

Táto kontrola je nutná aj v prípade, že rozhranie podľa zaškrtnutých modulov vyzerá správne. Rozhodujú odpovede databázy na priamy pokus o prístup.
