# BETPRES SiteDesk Mobile 1.0.14

PWA aplikácia je určená pre iPhone a iPad a používa rovnaký cloudový pracovný priestor ako SiteDesk 5.0.85 na notebookoch. Po zverejnení na HTTPS adrese sa správa ako bežná aplikácia, má vlastnú ikonu a základné údaje fungujú aj bez signálu.

## Inštalácia na iPhone alebo iPad

1. Otvorte HTTPS adresu mobilnej aplikácie v Safari.
2. V spodnej lište stlačte **Zdieľať** (štvorec so šípkou nahor).
3. Vyberte **Pridať na plochu**.
4. Potvrďte názov **SiteDesk** a stlačte **Pridať**.

## Prepojenie s počítačom

1. V počítačovej aplikácii otvorte **Cloud a databáza**.
2. Stlačte **Exportovať pripojenie pre kolegu**.
3. Súbor `BETPRES_SiteDesk_pripojenie_*.json` pošlite do iPhonu cez AirDrop, e-mail alebo Súbory.
4. V mobile otvorte **Nastavenia → SiteDesk Cloud → načítať súbor pripojenia**.
5. Prihláste sa vlastným e-mailom a heslom SiteDesk.

## Moduly

- Pasport materiálu s lokálnym OCR dodacích listov
- Vady, nedorobky a porušenia BOZP s fotografiami
- Denný denník zo stavby
- Stav pracovníkov po firmách
- Kalendár termínov a úloh
- Offline fronta, zachované prihlásenie a automatická synchronizácia každých 30 sekúnd aj po návrate do aplikácie

OCR a fotografie sa spracujú lokálne. Verejný Supabase anon/publishable kľúč nie je heslo databázy; service-role kľúč sa do aplikácie nikdy nevkladá.

Pri prvom použití OCR musí byť iPhone online, aby sa načítal slovenský OCR modul. Ostatné základné záznamy aplikácia ukladá aj bez signálu.
