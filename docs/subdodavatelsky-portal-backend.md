# Podaplikácia subdodávok – databáza a uvedenie do prevádzky

**Stav (13. 11. 2026):** sedem migrácií je nasadených v produkčnom Supabase projekte `rnlbgnxyadicbotwgrcp`. Pred nasadením vznikla overená vlastná záloha databázy. Externé účty neprizývaj do súčasného tímu BETPRES APP, pretože ten vie čítať celý spoločný JSON pracovného priestoru; databázový trigger teraz takéto súbežné priradenie pre tú istú stavbu odmietne.

## Ako zapnúť portály

1. V hlavnej aplikácii v časti **Cloud a databáza** ulož Project URL a iba verejný publishable/anon kľúč, prihlás sa ako vlastník a načítaj správny pracovný priestor.
2. Produkčné migrácie sú nasadené. V prehliadači sa používajú iba Project URL a verejný publishable/anon kľúč. Service-role kľúč sa do prehliadača nikdy nevkladá.
3. V **Portáli subdodávok** vyber firmu, zriaď jej oddelený priestor, zverejni položky z vlastného súpisu a zadaj e-mail subdodávateľa. Klikni na **Pripraviť e-mail** a správu odošli. Subdodávateľ otvorí odkaz na svojom zariadení, vytvorí a potvrdí účet s rovnakým e-mailom. Po prihlásení si bezpečne nárokuje iba svoj pridelený priestor. Firma vidí len svoj denník, svoj stav pracovníkov a svoj súpis.
4. Subdodávateľ zadá množstvá za mesiac a stlačí **Odoslať na schválenie**. Vlastník môže položku upraviť s dôvodom; subdodávka vidí schválené množstvo červenou. Tlačidlo **Schváliť a uzatvoriť mesiac** uzamkne odoslaný súpis aj na serveri a prenesie schválené množstvá do hlavného súpisu. Ak sa hlavná položka medzitým ručne zmenila, prenos ju neprepíše a oznámi konflikt.
5. V **Prístupe dozoru a projektanta** zriaď oddelený denník stavby, pozvi potvrdený účet a zverejni dni. Výzvu priraď konkrétnemu účtu. Tlačidlo **Pripraviť e-mail** otvorí poštového klienta; správu treba odoslať. Pozvaný účet vidí zverejnené dni tejto stavby a iba svoje výzvy. Na otvorenú výzvu pridáva odpoveď, denník nemení.

Portál dozoru momentálne zobrazuje text, počasie, pracovníkov a mechanizmy zo zverejneného dňa. Prílohy hlavného denníka sa do oddeleného portálu nekopírujú. Automatické odosielanie e-mailu vyžaduje samostatnú serverovú službu; aktuálne tlačidlo pripravuje správu v poštovom klientovi.

## Rozsah a prístup

- Jeden rozsah `subcontract_scopes` patrí presne jednej kombinácii pracovný priestor / stavba / firma. Používateľ subdodávky je členom len pridelených rozsahov.
- Portál číta výlučne `subcontract_*` tabuľky a súkromný bucket `subcontract-private`; nikdy nevolá `sitedesk_workspaces` ani nepoužíva lokálnu cache hlavnej BETPRES APP.
- Hlavný zhotoviteľ s existujúcou rolou `owner` alebo `editor` môže publikovať rozpočtové položky, čítať zápisy, pridať vlastný nemenný záznam a uzatvárať dni, celý denník a mesačné súpisy. Prístupové účty pridáva a odoberá iba `owner`.
- Subdodávateľ s rolou `supplier_writer` môže meniť len vlastný otvorený denný zápis, počet pracovníkov a množstvá v otvorenom mesačnom súpise. Ceny, jednotky a zmluvné množstvá určuje hlavný zhotoviteľ. Účet s `supplier_viewer` môže len čítať (momentálne bez UI na jeho pozvanie).
- Žiadny klient nemá právo zmazať záznam. Rozpracovaný súpis môže subdodávateľ odoslať na schválenie; po odoslaní už svoje množstvá nemení. Hlavný zhotoviteľ môže revidovať schválené množstvo a potom uzatvoriť iba odoslaný súpis. Uzavretý mesiac sa nedá spätne prepísať. Uzavretý deň zahŕňa aj počet pracovníkov a prílohy; uzavretý denník zahŕňa všetky dni. V prvej verzii nie je odomknutie ani opravný záznam po uzávierke. Potrebné opravy sa zatiaľ musia evidovať mimo portálu podľa interného postupu; budúci modul môže pridať výslovne označený dodatok bez prepisu uzavretého obsahu.
- Neodoslaný text denníka, počet pracovníkov a množstvá súpisu sa ukladajú lokálne podľa účtu, rozsahu a dňa/mesiaca. Po obnovení stránky sa novší miestny návrh obnoví; ak je serverový záznam novší, používateľ ho musí obnoviť ručne. Po potvrdenom uložení sa príslušný miestny návrh odstráni. Ide o ochranu rozpracovaného formulára, nie o cloudovú zálohu: vymazanie dát prehliadača alebo strata zariadenia ho odstráni. Dôležitý zápis treba potvrdiť tlačidlom Uložiť.

## API kontrakt

Všetky REST požiadavky idú na Supabase `/rest/v1/` s verejným publishable key a JWT prihláseného používateľa. Databáza dopĺňa `created_by`, `created_at`, čas uzávierky a ceny v historických riadkoch; klient tieto polia neposiela.

| Tabuľka | Účel | Stabilné obmedzenie |
|---|---|---|
| `subcontract_scopes` | Stavba a firma | unikátne `(workspace_id,project_id,company_id)` |
| `subcontract_scope_members` | Overené účty | unikátne `(scope_id,user_id)`, serverové pozvanie |
| `subcontract_diary_days` | Práce a mechanizmy podľa dňa | unikátne `(scope_id,day)` |
| `subcontract_daily_crew` | Počet pracovníkov a profesie | unikátne `(scope_id,day)` |
| `subcontract_work_items` | Rozpočtové položky hlavného zhotoviteľa | UPSERT podľa `(scope_id,source_item_id)`; vypnutie `is_active=false` zachová históriu |
| `subcontract_statements` | Mesačný súpis | unikátne `(scope_id,period)`; stavy `draft`, `submitted`, `closed` |
| `subcontract_statement_rows` | Množstvá po položkách | UPSERT podľa `(statement_id,work_item_id)`; navrhnuté `quantity` ostáva po odoslaní nemenné, hlavný zhotoviteľ nastavuje `reviewed_quantity` a `review_note`; ceny nastavuje server |
| `subcontract_owner_notes` | Nemenný záznam hlavného zhotoviteľa | iba INSERT pred uzávierkou dňa |
| `subcontract_attachments` | Prílohy denníka | súkromné objekty a metadata len v otvorenom dni |
| `subcontract_audit` | História každej zmeny | iba čítanie v povolenom rozsahu; bez klientského INSERT/UPDATE/DELETE |

RPC funkcie: `subcontract_invite(p_scope_id,p_email)`, `subcontract_claim_invite(p_scope_id)`, `subcontract_revoke_invite(p_scope_id,p_email)`, `subcontract_add_member(p_scope_id,p_email)` pre existujúci potvrdený účet, `subcontract_remove_member(p_scope_id,p_user_id)`, `subcontract_close_day(p_scope_id,p_day)`, `subcontract_close_diary(p_scope_id)`, `subcontract_submit_statement(p_statement_id)` a `subcontract_close_statement(p_statement_id)`. Vlastník môže zadať e-mail ešte pred založením účtu. Prístup sa aktivuje až po potvrdení toho istého e-mailu. Heslo hlavný zhotoviteľ nevytvára ani nepozná.

Prílohy: najprv musí existovať `subcontract_diary_days` v stave `draft`. Klient vytvorí UUID prílohy a nahrá súbor bez upsertu cez `/storage/v1/object/subcontract-private/<path>`, kde `path` je presne `<scope_uuid>/<diary_day_uuid>/<attachment_uuid>/<safe_filename>`. Bezpečný názov začína ASCII písmenom alebo číslicou, ďalej obsahuje len ASCII písmená, číslice, bodku, podčiarkovník alebo pomlčku a má najviac 180 znakov. Potom vloží `subcontract_attachments(id,scope_id,diary_day_id,path,name,mime_type,size_bytes)`; server prepíše veľkosť a typ hodnotami zo Storage metadát. Súbor sa číta výlučne cez `/storage/v1/object/authenticated/subcontract-private/<path>` s JWT; bucket je súkromný, limit 20 MiB, podporuje JPEG, PNG, WebP, PDF, DOCX, XLSX a TXT. Prehliadač má používať `cache: no-store`; podpísané verejné URL sa nevytvárajú. Štandardný Storage upload vyžaduje iba `INSERT` policy, takže následný zápis metadát je možný aj keď objekt ešte nemá prístup na čítanie.

## Nasadenie a prevádzkové kontroly

1. Pred nasadením sa overili existujúce `public.sitedesk_workspaces`, `public.sitedesk_current_role(uuid)` a `public.sitedesk_list_members(uuid)`. Zoznam členov vracia `user_id` a `email` aj pre vlastníka. Záloha celej databázy je v súkromnom adresári profilu na tomto počítači, mimo Git repozitára.
2. Nasadené sú migrácie `202611090001`, `202611090002`, `202611090003`, `202611100001`, `202611100002`, `202611100003` a `202611100004`. Všetky sú uvedené v produkčnej histórii migrácií. Posledná pridáva pozvania čakajúce na potvrdenie e-mailu a databázové triggery, ktoré nedovolia spojiť externý účet s celým tímom alebo vnútorným modulovým prístupom tej istej stavby.
3. Produkčné RLS je zapnuté na všetkých tabuľkách subdodávok a dozoru. Pred bežným používaním ešte otestuj reálnymi samostatnými účtami prístup vlastníka, firmy A, firmy B a dozoru; lokálny test s náhradnými účtami už prešiel.
4. Testuj reálnymi Auth účtami: vlastník, subdodávka A, subdodávka B, dozor a neprihlásený návštevník. Skontroluj, že A nevidí B ani `sitedesk_workspaces`, dozor nevidí hlavný pracovný priestor ani súpisy a reaguje iba na svoju výzvu. Nesmie prejsť priame REST PATCH `scope_id`, `day`, `status`, `unit_price`, `contract_qty`, `closed_at`, cudzí `work_item_id`, navrhnuté `quantity` po odoslaní, ani zápis po uzávierke. Otestuj aj Storage GET/POST/PATCH/DELETE pre cudziu cestu, uzavretý deň a neexistujúce metadata.
5. Otestuj súbeh: súčasné uloženie a uzávierka dňa/súpisu. Jeden zápis môže dostať konflikt a vyžadovať zopakovanie; po uzávierke nesmie vzniknúť zmena. Over audit pre INSERT, UPDATE aj odobranie člena.
6. Až po testoch zapni externé prihlasovanie a zverejni portál. Pri odobratí účtu zruš session podľa politiky organizácie a rieš cache Storage; aj súkromný bucket môže mať krátkodobú cache odpovede. Používaj krátky cache čas a po závažnom odobratí prístupu vyčisti CDN cache.

Ak Storage upload prejde, ale vloženie `subcontract_attachments` zlyhá, vznikne súkromný objekt bez metadát. RLS ho nedovolí stiahnuť. Klient môže zopakovať **iba metadata POST** s rovnakým UUID/cestou, pokiaľ je deň otvorený. Po uzávierke musí správca vyhľadať orphan objekt a odstrániť ho cez Storage API so serverovým service-role účtom; nemaž priamo riadok v `storage.objects`, lebo fyzický súbor by mohol zostať v úložisku. Takúto kontrolu je vhodné vykonávať pravidelne.

## Zámerné hranice

- Hlavný pracovný priestor stále obsahuje údaje v jednom JSON. Nový portál ho nečíta; položky súpisu a názvy stavby sa do nových tabuliek publikujú osobitne. Po uzávierke klient prenesie schválené množstvá do hlavného súpisu, no pri konflikte ručne upravené položky neprepisuje. Toto nie je jedna databázová transakcia medzi oboma úložiskami; pri zlyhaní prenosu ostane uzatvorený portálový súpis a vlastník môže prenos zopakovať tlačidlom.
- Po uzávierke SQL blokuje aj nové záznamy hlavného zhotoviteľa. Na dodatky k uzavretému denníku treba samostatný append-only postup a UI; aktuálny portál ich nevytvára.
- Sedem migrácií prešlo lokálnym spustením v izolovanom PostgreSQL WASM s náhradnou schémou Auth, Storage a pôvodného BETPRES pracovného priestoru. Skúška overila RLS na účtoch vlastníka, firmy a dozoru, revíziu a uzávierku mesačného súpisu, pozvania, ochranu hlavného tímu a odobratie člena. Migrácie sú nasadené aj v produkčnej databáze a zapnutie RLS bolo overené. Zostáva skúška skutočného Supabase Storage API a prihlásenia viacerých reálnych externých účtov.
- Pri rollbacku po nasadení najprv vypni portál a odober klientské GRANT/RPC, ale nemaž tabuľky alebo bucket s údajmi bez overenej zálohy a exportu. Nové dáta by sa pri `DROP` stratili.

Použité pravidlá: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [zabezpečenie Data API](https://supabase.com/docs/guides/api/securing-your-api), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) a [súkromné buckety](https://supabase.com/docs/guides/storage/buckets/fundamentals).
