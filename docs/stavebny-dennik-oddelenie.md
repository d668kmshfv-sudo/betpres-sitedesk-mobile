# Stavebný denník – možnosť samostatnej aplikácie

Stav: 4. 11. 2026. Toto je príprava návrhu. Denník zostáva súčasťou BETPRES app; žiadna nová aplikácia ani nové prístupy nie sú zapnuté.

## Cieľ

Ak bude treba, denník sa bude dať otvoriť aj ako samostatná aplikácia s vlastným prihlásením. Rovnaké denné záznamy zostanú viditeľné v BETPRES app. Oddelená aplikácia bude mať prístup iba k denníku vybranej stavby.

## Roly

- Vlastník: spravuje stavby, denník a prístupy.
- Zapisovateľ denníka: číta a zapisuje záznamy denníka vybranej stavby. Nedostane súpisy, fakturáciu, vady ani ostatné moduly.
- Prizvaný účastník (stavebný dozor, projektant, statik alebo investor): číta denník stavby, ku ktorej dostal prístup. Môže vložiť vlastný označený zápis a na výzvu adresovanú svojmu účtu pridať odpoveď alebo stanovisko; nemôže upraviť ani vymazať cudzie zápisy či výzvy.
- Zapisovateľ subdodávateľa: číta a zapisuje iba denník svojej firmy na pridelenej stavbe. Denník inej firmy, hlavný denník a ostatné moduly nevidí. Vlastník môže jeho zápisy po jednotlivých dňoch prevziať do hlavného denníka.

Prístup sa prideľuje podľa e-mailu a konkrétnej stavby; jedna osoba môže dostať prístup k viacerým stavbám samostatne. Označenie funkcie (dozor, projektant a podobne) sa použije pri výzvach. Každý používateľ má vlastný e-mail a heslo. Vlastník zadáva e-mail, používateľ si nastaví heslo sám. Existujúca rola „Čítanie“ sa pre prístup iba k denníku nepoužije.

## Skúška s druhým účtom v dnešnej aplikácii

BETPRES APP už umožňuje vytvoriť druhý účet cez **Cloud a databáza → Vytvoriť účet**. Nový používateľ si zadá vlastný e-mail a heslo, prípadne potvrdí e-mail. Vlastník ho potom v tej istej sekcii pridá do **Tímu stavby** podľa rovnakého e-mailu. Na druhom zariadení alebo v samostatnom profile prehliadača sa nastaví rovnaký Supabase Project URL, verejný publishable/anon kľúč a pracovný priestor; tieto údaje sa dajú preniesť existujúcim exportom pripojenia. Heslo si druhý používateľ zadá sám.

Súčasné roly **Editor** a **Čítanie** dávajú prístup k celému JSON pracovnému priestoru. Skúšobný účet s týmito rolami preto používaj iba pre dôveryhodného interného kolegu, ktorý môže vidieť všetky dáta stavby. Rola Čítanie nemôže uložiť zmeny do cloudu. Skúšku s externou firmou, ktorá má vidieť len svoj denník, treba odložiť do zavedenia serverových oprávnení nižšie. Na spoločnom zariadení používaj samostatný profil prehliadača: aktuálna lokálna cache aplikácie nie je oddelená podľa používateľov.

## Dáta denníka

Samostatný dátový vstup musí vracať iba názov a lokalitu stavby, dátum, počasie dňa, súhrnné počty pracovníkov, mechanizmy, vykonané práce, výzvy a prílohy denníka. Mená zo smenoviek, fakturácia a celý spoločný stav aplikácie sa neposielajú. Počty pracovníkov sa prenesú ako súhrn za deň a firmu, bez celých smenoviek.

Každý subdodávateľský denník má samostatný rozsah `(stavba, firma)`. Zápis obsahuje stabilné ID, dátum, firmu, autora, čas vytvorenia, verziu, práce, mechanizmy a prílohy. Počasie patrí dňu stavby a môže sa do obmedzeného denníka premietnuť ako údaj na čítanie. Ak sa tá istá osoba zúčastňuje viacerých firiem alebo stavieb, dostane samostatné priradenie pre každý rozsah.

Prevzatie zápisov do hlavného denníka má vytvoriť nový hlavný záznam s odkazom na zdrojové ID a verziu, nie prepísať celý deň. Pri opakovanom kliknutí sa tá istá verzia zdroja nesmie skopírovať druhýkrát. Zmenený zdroj po prevzatí sa označí ako novšia verzia; vlastník rozhodne, či ju chce znovu prevziať. Pôvodný zápis subdodávateľa ostane zachovaný. Prevzatie z jednej firmy nesmie zmeniť zápisy ostatných firiem.

Výzva musí mať konkrétneho adresáta podľa používateľského účtu, nie iba textové označenie funkcie. Odpoveď aj vlastný zápis sa ukladajú osobitne s autorom, časom a textom. Vlastník ich vidí v denníku a v dennom PDF. Odpoveď nie je automaticky formálny elektronický podpis.

## Technická hranica

Dnes BETPRES app načíta celý pracovný priestor v jednom JSON zázname a uloží ho lokálne. Samotné skrytie menu preto nestačí na obmedzenie prístupu. Budúca oddelená aplikácia nesmie volať existujúce načítanie celého pracovného priestoru ani používať jeho lokálnu cache.

Pred spustením treba v Supabase vytvoriť samostatné oprávnenia pre denník, serverové načítanie výlučne povolených polí, kontrolované uloženie vlastných zápisov a odpovedí a pravidlá pre fotografie a PDF. Prístup sa musí overiť na serveri pre každú stavbu, používateľa a súbor. Na zdieľanom zariadení treba oddeliť cache účtov. Samostatný pôvod webu poskytne najsilnejšie oddelenie lokálneho úložiska.

Odporúčaná schéma: tabuľka priradení používateľ–stavba–firma–rola; samostatné tabuľky denníkových záznamov a ich revízií; samostatné väzby na prílohy; tabuľka prevzatí do hlavného denníka. Pravidlá RLS musia kontrolovať prihlaseného používateľa pri `SELECT`, `INSERT` aj `UPDATE`; úprava cudzieho zápisu alebo zmena `project_id`/`company_id` nesmie prejsť ani priamym HTTP volaním. Úložisko príloh musí používať rovnaký rozsah. Existujúci endpoint `sitedesk_workspaces` nesmie byť dostupný denníkovým rolám.

## Postup pri prípadnom oddelení

1. Získať a overiť aktuálnu schému, funkcie a bezpečnostné pravidlá produkčného Supabase. SQL migrácie teraz nie sú v repozitári.
2. Zaviesť serverové oprávnenia a oddelené odpovede na výzvy. Otestovať ich dvoma rôznymi účtami.
3. Presmerovať modul denníka v BETPRES app na obmedzené rozhranie bez zmeny existujúcich záznamov.
4. Až potom pridať samostatný vstup do denníka a vlastnú inštalovateľnú aplikáciu.
5. Skontrolovať zachovanie starých záznamov, príloh, počtov pracovníkov a PDF exportu.

## Akceptačné skúšky

- Prizvaný účastník vidí iba pridelenú stavbu a denník; priamy pokus načítať celý pracovný priestor, fakturáciu či iné prílohy zlyhá.
- Zapisovateľ firmy A nevidí denník firmy B ani hlavný denník, nevie vložiť záznam pod firmou B a nevie otvoriť jej prílohy.
- Prevzatie záznamov firmy A za deň do hlavného denníka zachová ostatné firmy; opakované prevzatie tej istej verzie nevytvorí duplicitu.
- Prizvaný účastník môže vytvoriť vlastný zápis a odpovedať iba na výzvu adresovanú jeho účtu; nemôže zmeniť cudzí pôvodný text.
- Odpoveď zostane po synchronizácii, po aktualizácii aplikácie a zobrazí sa vlastníkovi aj v dennom PDF.
- Odhlásenie a prihlásenie iného používateľa na rovnakom zariadení neukáže dáta predchádzajúceho účtu.



## Obsah a preukázateľnosť denníka

Podľa zákona č. 25/2025 Z. z. (§ 10 a § 39) sa denník vedie spravidla elektronicky a stavbyvedúci musí umožniť zápisy aj oprávneným osobám vrátane projektanta a stavebného dozoru. Preto budúce roly pre projektanta a dozor musia umožniť vlastný označený zápis, nie iba čítanie a odpoveď na výzvu.

Príloha č. 20 vyhlášky č. 60/2025 Z. z. uvádza identifikačné údaje stavby a účastníkov, pravidelné záznamy o pracovnej dobe, počasí, počte a profesiách pracovníkov, vykonaných prácach a prerušeniach, ďalšie technické záznamy a prílohy podľa stavby. Pri budúcom návrhu treba doplniť chýbajúce polia a preukázateľnú históriu opráv.

Odkazy na oficiálne predpisy:
- https://static.slov-lex.sk/static/SK/ZZ/2025/25/20251101.print.html
- https://static.slov-lex.sk/pdf/prilohy/SK/ZZ/2025/60/vyhlasene_znenie_5721395-2.pdf

Pri stavbách povoľovaných podľa staršej úpravy treba posúdiť prechodné ustanovenia § 84 zákona č. 25/2025 Z. z. Bežný denný zápis nemá v uvedených ustanoveniach výslovnú všeobecnú požiadavku na kvalifikovaný elektronický podpis; podpisy úradnej kontrolnej prehliadky sa posudzujú osobitne podľa § 43.
