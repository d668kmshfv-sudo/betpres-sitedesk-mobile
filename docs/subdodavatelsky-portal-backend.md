# Podaplikácia subdodávok – databáza a uvedenie do prevádzky

**Stav:** pripravené SQL a klientské rozhranie; migrácie ešte nie sú nasadené do produkčného Supabase. Externé účty neprizývaj do súčasného tímu BETPRES APP, pretože ten vie čítať celý spoločný JSON pracovného priestoru.

## Ako zapnúť portály

1. V hlavnej aplikácii v časti **Cloud a databáza** ulož Project URL a iba verejný publishable/anon kľúč, prihlás sa ako vlastník a načítaj správny pracovný priestor.
2. Správca databázy musí po zálohe a skúške na testovacom projekte spustiť všetkých päť migrácií uvedených nižšie. Bez toho zostane karta „Vyžaduje nastavenie databázy“ a prístup subdodávky ani dozoru nefunguje. Service-role kľúč sa do prehliadača nikdy nevkladá.
3. V **Portáli subdodávok** vyber firmu, zriaď jej oddelený priestor a zverejni položky z vlastného súpisu. Subdodávateľ si na svojom zariadení otvorí odkaz do portálu, vytvorí a e-mailom potvrdí vlastný účet. Vlastník ho potom pridá podľa e-mailu. Firma vidí len svoj denník, svoj stav pracovníkov a svoj súpis.
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

RPC funkcie: `subcontract_add_member(p_scope_id,p_email)`, `subcontract_remove_member(p_scope_id,p_user_id)`, `subcontract_close_day(p_scope_id,p_day)`, `subcontract_close_diary(p_scope_id)`, `subcontract_submit_statement(p_statement_id)` a `subcontract_close_statement(p_statement_id)`. Účet subdodávateľa si najprv sám vytvorí a potvrdí e-mail; vlastník ho potom priradí podľa e-mailu. Heslo hlavný zhotoviteľ nevytvára ani nepozná.

Prílohy: najprv musí existovať `subcontract_diary_days` v stave `draft`. Klient vytvorí UUID prílohy a nahrá súbor bez upsertu cez `/storage/v1/object/subcontract-private/<path>`, kde `path` je presne `<scope_uuid>/<diary_day_uuid>/<attachment_uuid>/<safe_filename>`. Bezpečný názov začína ASCII písmenom alebo číslicou, ďalej obsahuje len ASCII písmená, číslice, bodku, podčiarkovník alebo pomlčku a má najviac 180 znakov. Potom vloží `subcontract_attachments(id,scope_id,diary_day_id,path,name,mime_type,size_bytes)`; server prepíše veľkosť a typ hodnotami zo Storage metadát. Súbor sa číta výlučne cez `/storage/v1/object/authenticated/subcontract-private/<path>` s JWT; bucket je súkromný, limit 20 MiB, podporuje JPEG, PNG, WebP, PDF, DOCX, XLSX a TXT. Prehliadač má používať `cache: no-store`; podpísané verejné URL sa nevytvárajú. Štandardný Storage upload vyžaduje iba `INSERT` policy, takže následný zápis metadát je možný aj keď objekt ešte nemá prístup na čítanie.

## Pred produkčným nasadením

1. Zálohuj produkčný Supabase a na testovacej databáze over existujúce `public.sitedesk_workspaces`, `public.sitedesk_current_role(uuid)` a `public.sitedesk_list_members(uuid)`. Posledná funkcia musí vracať riadky s `user_id` a `email` vrátane volajúceho vlastníka. Invite RPC pri neznámom tvare bezpečne zlyhá.
2. Spusti v poradí `supabase/migrations/202611090001_subcontract_portal.sql`, `202611090002_module_permissions.sql`, `202611090003_subcontract_attachments.sql`, `202611100001_subcontract_statement_review.sql` a `202611100002_diary_reviewer_portal.sql`. Každý súbor je samostatná transakcia. Nenasaď iba klienta bez databázových pravidiel.
3. Over existujúce RLS na `sitedesk_workspaces` a funkciu `sitedesk_save_workspace`. Externý účet **nesmie** byť členom pôvodného tímu. Invite RPC odmieta účet, ktorý už je v zozname plných členov; treba tiež zabrániť neskoršiemu pridaniu toho istého účtu do plného tímu. Bez overenia a úpravy existujúceho `sitedesk_add_member` to nemožno garantovať iba novými tabuľkami.
4. Testuj reálnymi Auth účtami: vlastník, subdodávka A, subdodávka B, dozor a neprihlásený návštevník. Skontroluj, že A nevidí B ani `sitedesk_workspaces`, dozor nevidí hlavný pracovný priestor ani súpisy a reaguje iba na svoju výzvu. Nesmie prejsť priame REST PATCH `scope_id`, `day`, `status`, `unit_price`, `contract_qty`, `closed_at`, cudzí `work_item_id`, navrhnuté `quantity` po odoslaní, ani zápis po uzávierke. Otestuj aj Storage GET/POST/PATCH/DELETE pre cudziu cestu, uzavretý deň a neexistujúce metadata.
5. Otestuj súbeh: súčasné uloženie a uzávierka dňa/súpisu. Jeden zápis môže dostať konflikt a vyžadovať zopakovanie; po uzávierke nesmie vzniknúť zmena. Over audit pre INSERT, UPDATE aj odobranie člena.
6. Až po testoch zapni externé prihlasovanie a zverejni portál. Pri odobratí účtu zruš session podľa politiky organizácie a rieš cache Storage; aj súkromný bucket môže mať krátkodobú cache odpovede. Používaj krátky cache čas a po závažnom odobratí prístupu vyčisti CDN cache.

Ak Storage upload prejde, ale vloženie `subcontract_attachments` zlyhá, vznikne súkromný objekt bez metadát. RLS ho nedovolí stiahnuť. Klient môže zopakovať **iba metadata POST** s rovnakým UUID/cestou, pokiaľ je deň otvorený. Po uzávierke musí správca vyhľadať orphan objekt a odstrániť ho cez Storage API so serverovým service-role účtom; nemaž priamo riadok v `storage.objects`, lebo fyzický súbor by mohol zostať v úložisku. Takúto kontrolu je vhodné vykonávať pravidelne.

## Zámerné hranice

- Hlavný pracovný priestor stále obsahuje údaje v jednom JSON. Nový portál ho nečíta; položky súpisu a názvy stavby sa do nových tabuliek publikujú osobitne. Po uzávierke klient prenesie schválené množstvá do hlavného súpisu, no pri konflikte ručne upravené položky neprepisuje. Toto nie je jedna databázová transakcia medzi oboma úložiskami; pri zlyhaní prenosu ostane uzatvorený portálový súpis a vlastník môže prenos zopakovať tlačidlom.
- Po uzávierke SQL blokuje aj nové záznamy hlavného zhotoviteľa. Na dodatky k uzavretému denníku treba samostatný append-only postup a UI; aktuálny portál ich nevytvára.
- Päť migrácií prešlo lokálnym spustením v izolovanom PostgreSQL WASM s náhradnou schémou Auth, Storage a pôvodného BETPRES pracovného priestoru. Skúška overila RLS na účtoch vlastníka, firmy a dozoru, revíziu a uzávierku mesačného súpisu, súkromné prílohy a odobratie člena. Toto nie je test skutočného Supabase Storage API ani produkčnej schémy. V repozitári nie je produkčné pripojenie; migrácie neboli nasadené ani overené na cieľovej databáze. Zobrazenie portálu preto nesmie byť zamieňané za hotovú serverovú izoláciu.
- Pri rollbacku po nasadení najprv vypni portál a odober klientské GRANT/RPC, ale nemaž tabuľky alebo bucket s údajmi bez overenej zálohy a exportu. Nové dáta by sa pri `DROP` stratili.

Použité pravidlá: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [zabezpečenie Data API](https://supabase.com/docs/guides/api/securing-your-api), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) a [súkromné buckety](https://supabase.com/docs/guides/storage/buckets/fundamentals).
