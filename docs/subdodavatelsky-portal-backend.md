# Podaplikácia subdodávok – databáza a uvedenie do prevádzky

**Stav:** pripravené SQL a klientské rozhranie; migrácie ešte nie sú nasadené do produkčného Supabase. Externé účty neprizývaj do súčasného tímu BETPRES APP, pretože ten vie čítať celý spoločný JSON pracovného priestoru.

## Rozsah a prístup

- Jeden rozsah `subcontract_scopes` patrí presne jednej kombinácii pracovný priestor / stavba / firma. Používateľ subdodávky je členom len pridelených rozsahov.
- Portál číta výlučne `subcontract_*` tabuľky a súkromný bucket `subcontract-private`; nikdy nevolá `sitedesk_workspaces` ani nepoužíva lokálnu cache hlavnej BETPRES APP.
- Hlavný zhotoviteľ s existujúcou rolou `owner` alebo `editor` môže publikovať rozpočtové položky, čítať zápisy, pridať vlastný nemenný záznam a uzatvárať dni, celý denník a mesačné súpisy. Prístupové účty pridáva a odoberá iba `owner`.
- Subdodávateľ s rolou `supplier_writer` môže meniť len vlastný otvorený denný zápis, počet pracovníkov a množstvá v otvorenom mesačnom súpise. Ceny, jednotky a zmluvné množstvá určuje hlavný zhotoviteľ. Účet s `supplier_viewer` môže len čítať (momentálne bez UI na jeho pozvanie).
- Žiadny klient nemá právo zmazať záznam. Rozpracovaný súpis môže subdodávateľ odoslať na schválenie; po odoslaní už svoje množstvá nemení. Hlavný zhotoviteľ ho uzatvorí. Uzavretý deň zahŕňa aj počet pracovníkov a prílohy; uzavretý denník zahŕňa všetky dni. V prvej verzii nie je odomknutie ani opravný záznam po uzávierke. Potrebné opravy sa zatiaľ musia evidovať mimo portálu podľa interného postupu; budúci modul môže pridať výslovne označený dodatok bez prepisu uzavretého obsahu.
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
| `subcontract_statement_rows` | Množstvá po položkách | UPSERT podľa `(statement_id,work_item_id)`; `unit_price_snapshot`, `contract_qty_snapshot`, `line_total` nastavuje server |
| `subcontract_owner_notes` | Nemenný záznam hlavného zhotoviteľa | iba INSERT pred uzávierkou dňa |
| `subcontract_attachments` | Prílohy denníka | súkromné objekty a metadata len v otvorenom dni |
| `subcontract_audit` | História každej zmeny | iba čítanie v povolenom rozsahu; bez klientského INSERT/UPDATE/DELETE |

RPC funkcie: `subcontract_add_member(p_scope_id,p_email)`, `subcontract_remove_member(p_scope_id,p_user_id)`, `subcontract_close_day(p_scope_id,p_day)`, `subcontract_close_diary(p_scope_id)`, `subcontract_submit_statement(p_statement_id)` a `subcontract_close_statement(p_statement_id)`. Účet subdodávateľa si najprv sám vytvorí a potvrdí e-mail; vlastník ho potom priradí podľa e-mailu. Heslo hlavný zhotoviteľ nevytvára ani nepozná.

Prílohy: najprv musí existovať `subcontract_diary_days` v stave `draft`. Klient vytvorí UUID prílohy a nahrá súbor bez upsertu cez `/storage/v1/object/subcontract-private/<path>`, kde `path` je presne `<scope_uuid>/<diary_day_uuid>/<attachment_uuid>/<safe_filename>`. Bezpečný názov začína ASCII písmenom alebo číslicou, ďalej obsahuje len ASCII písmená, číslice, bodku, podčiarkovník alebo pomlčku a má najviac 180 znakov. Potom vloží `subcontract_attachments(id,scope_id,diary_day_id,path,name,mime_type,size_bytes)`; server prepíše veľkosť a typ hodnotami zo Storage metadát. Súbor sa číta výlučne cez `/storage/v1/object/authenticated/subcontract-private/<path>` s JWT; bucket je súkromný, limit 20 MiB, podporuje JPEG, PNG, WebP, PDF, DOCX, XLSX a TXT. Prehliadač má používať `cache: no-store`; podpísané verejné URL sa nevytvárajú. Štandardný Storage upload vyžaduje iba `INSERT` policy, takže následný zápis metadát je možný aj keď objekt ešte nemá prístup na čítanie.

## Pred produkčným nasadením

1. Zálohuj produkčný Supabase a na testovacej databáze over existujúce `public.sitedesk_workspaces`, `public.sitedesk_current_role(uuid)` a `public.sitedesk_list_members(uuid)`. Posledná funkcia musí vracať riadky s `user_id` a `email` vrátane volajúceho vlastníka. Invite RPC pri neznámom tvare bezpečne zlyhá.
2. Spusti v poradí `supabase/migrations/202611090001_subcontract_portal.sql` a `202611090003_subcontract_attachments.sql`. Obe sú zabalené do transakcie. Nenasadzuj iba druhý súbor.
3. Over existujúce RLS na `sitedesk_workspaces` a funkciu `sitedesk_save_workspace`. Externý účet **nesmie** byť členom pôvodného tímu. Invite RPC odmieta účet, ktorý už je v zozname plných členov; treba tiež zabrániť neskoršiemu pridaniu toho istého účtu do plného tímu. Bez overenia a úpravy existujúceho `sitedesk_add_member` to nemožno garantovať iba novými tabuľkami.
4. Testuj reálnymi Auth účtami: vlastník, subdodávka A, subdodávka B a neprihlásený návštevník. Skontroluj, že A nevidí B ani `sitedesk_workspaces`, neprejde priame REST PATCH `scope_id`, `day`, `status`, `unit_price`, `contract_qty`, `closed_at`, cudzí `work_item_id`, ani zápis po každej uzávierke. Otestuj aj Storage GET/POST/PATCH/DELETE pre cudziu cestu, uzavretý deň a neexistujúce metadata.
5. Otestuj súbeh: súčasné uloženie a uzávierka dňa/súpisu. Jeden zápis môže dostať konflikt a vyžadovať zopakovanie; po uzávierke nesmie vzniknúť zmena. Over audit pre INSERT, UPDATE aj odobranie člena.
6. Až po testoch zapni externé prihlasovanie a zverejni portál. Pri odobratí účtu zruš session podľa politiky organizácie a rieš cache Storage; aj súkromný bucket môže mať krátkodobú cache odpovede. Používaj krátky cache čas a po závažnom odobratí prístupu vyčisti CDN cache.

Ak Storage upload prejde, ale vloženie `subcontract_attachments` zlyhá, vznikne súkromný objekt bez metadát. RLS ho nedovolí stiahnuť. Klient môže zopakovať **iba metadata POST** s rovnakým UUID/cestou, pokiaľ je deň otvorený. Po uzávierke musí správca vyhľadať orphan objekt a odstrániť ho cez Storage API so serverovým service-role účtom; nemaž priamo riadok v `storage.objects`, lebo fyzický súbor by mohol zostať v úložisku. Takúto kontrolu je vhodné vykonávať pravidelne.

## Zámerné hranice

- Hlavný pracovný priestor stále obsahuje údaje v jednom JSON. Nový portál ho nečíta; rozpočet a názvy stavby sa do nových tabuliek publikujú osobitne. Automatický prenos do hlavného súpisu alebo hlavného denníka nie je súčasťou tejto migrácie.
- Po uzávierke SQL blokuje aj nové záznamy hlavného zhotoviteľa. Na dodatky k uzavretému denníku treba samostatný append-only postup a UI; aktuálny portál ich nevytvára.
- Tri migrácie prešli lokálnym spustením v izolovanom PostgreSQL WASM s náhradnou schémou Auth, Storage a pôvodného BETPRES pracovného priestoru. Skúška overila RLS na účtoch vlastníka a dvoch firiem, uzávierky, ceny v súpise, súkromné prílohy a odobratie člena. Toto nie je test skutočného Supabase Storage API ani produkčnej schémy. V repozitári nie je produkčné pripojenie; migrácie neboli nasadené ani overené na cieľovej databáze. Zobrazenie portálu preto nesmie byť zamieňané za hotovú serverovú izoláciu.
- Pri rollbacku po nasadení najprv vypni portál a odober klientské GRANT/RPC, ale nemaž tabuľky alebo bucket s údajmi bez overenej zálohy a exportu. Nové dáta by sa pri `DROP` stratili.

Použité pravidlá: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [zabezpečenie Data API](https://supabase.com/docs/guides/api/securing-your-api), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) a [súkromné buckety](https://supabase.com/docs/guides/storage/buckets/fundamentals).
