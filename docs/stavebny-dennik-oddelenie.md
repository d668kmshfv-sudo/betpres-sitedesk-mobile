# Stavebný denník – možnosť samostatnej aplikácie

Stav: 4. 11. 2026. Toto je príprava návrhu. Denník zostáva súčasťou BETPRES app; žiadna nová aplikácia ani nové prístupy nie sú zapnuté.

## Cieľ

Ak bude treba, denník sa bude dať otvoriť aj ako samostatná aplikácia s vlastným prihlásením. Rovnaké denné záznamy zostanú viditeľné v BETPRES app. Oddelená aplikácia bude mať prístup iba k denníku vybranej stavby.

## Roly

- Vlastník: spravuje stavby, denník a prístupy.
- Zapisovateľ denníka: číta a zapisuje záznamy denníka vybranej stavby. Nedostane súpisy, fakturáciu, vady ani ostatné moduly.
- Prizvaný účastník (stavebný dozor, projektant, statik alebo investor): číta denník stavby, ku ktorej dostal prístup. Môže vložiť vlastný označený zápis a na výzvu adresovanú svojmu účtu pridať odpoveď alebo stanovisko; nemôže upraviť ani vymazať cudzie zápisy či výzvy.

Prístup sa prideľuje podľa e-mailu a konkrétnej stavby; jedna osoba môže dostať prístup k viacerým stavbám samostatne. Označenie funkcie (dozor, projektant a podobne) sa použije pri výzvach. Každý používateľ má vlastný e-mail a heslo. Vlastník zadáva e-mail, používateľ si nastaví heslo sám. Existujúca rola „Čítanie“ sa pre prístup iba k denníku nepoužije.

## Dáta denníka

Samostatný dátový vstup musí vracať iba názov a lokalitu stavby, dátum, počasie dňa, súhrnné počty pracovníkov, mechanizmy, vykonané práce, výzvy a prílohy denníka. Mená zo smenoviek, fakturácia a celý spoločný stav aplikácie sa neposielajú. Počty pracovníkov sa prenesú ako súhrn za deň a firmu, bez celých smenoviek.

Výzva musí mať konkrétneho adresáta podľa používateľského účtu, nie iba textové označenie funkcie. Odpoveď aj vlastný zápis sa ukladajú osobitne s autorom, časom a textom. Vlastník ich vidí v denníku a v dennom PDF. Odpoveď nie je automaticky formálny elektronický podpis.

## Technická hranica

Dnes BETPRES app načíta celý pracovný priestor v jednom JSON zázname a uloží ho lokálne. Samotné skrytie menu preto nestačí na obmedzenie prístupu. Budúca oddelená aplikácia nesmie volať existujúce načítanie celého pracovného priestoru ani používať jeho lokálnu cache.

Pred spustením treba v Supabase vytvoriť samostatné oprávnenia pre denník, serverové načítanie výlučne povolených polí, kontrolované uloženie vlastných zápisov a odpovedí a pravidlá pre fotografie a PDF. Prístup sa musí overiť na serveri pre každú stavbu, používateľa a súbor. Na zdieľanom zariadení treba oddeliť cache účtov. Samostatný pôvod webu poskytne najsilnejšie oddelenie lokálneho úložiska.

## Postup pri prípadnom oddelení

1. Získať a overiť aktuálnu schému, funkcie a bezpečnostné pravidlá produkčného Supabase. SQL migrácie teraz nie sú v repozitári.
2. Zaviesť serverové oprávnenia a oddelené odpovede na výzvy. Otestovať ich dvoma rôznymi účtami.
3. Presmerovať modul denníka v BETPRES app na obmedzené rozhranie bez zmeny existujúcich záznamov.
4. Až potom pridať samostatný vstup do denníka a vlastnú inštalovateľnú aplikáciu.
5. Skontrolovať zachovanie starých záznamov, príloh, počtov pracovníkov a PDF exportu.

## Akceptačné skúšky

- Prizvaný účastník vidí iba pridelenú stavbu a denník; priamy pokus načítať celý pracovný priestor, fakturáciu či iné prílohy zlyhá.
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
