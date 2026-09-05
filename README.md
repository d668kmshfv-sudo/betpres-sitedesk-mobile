# BETPRES SiteDesk Online 5.1.21

Jedna online PWA aplikácia pre notebook, iPad a iPhone. Všetky zariadenia používajú rovnaké rozhranie a po pripojení k rovnakému pracovnému priestoru Supabase zdieľajú údaje.

## Inštalácia na iPhone alebo iPad

1. Otvorte HTTPS adresu mobilnej aplikácie v Safari.
2. V spodnej lište stlačte **Zdieľať** (štvorec so šípkou nahor).
3. Vyberte **Pridať na plochu**.
4. Potvrďte názov **SiteDesk** a stlačte **Pridať**.

## Prepojenie zariadení

1. V online aplikácii otvorte **Cloud a databáza**.
2. Stlačte **Exportovať pripojenie pre kolegu**.
3. Súbor `BETPRES_SiteDesk_pripojenie_*.json` pošlite do iPhonu cez AirDrop, e-mail alebo Súbory.
4. Na druhom zariadení v časti **Cloud a databáza** importujte súbor pripojenia.
5. Prihláste sa vlastným e-mailom a heslom SiteDesk.

## Moduly

- Vady, nedorobky a porušenia BOZP s fotografiami
- Denný denník zo stavby
- Stav pracovníkov po firmách
- Kalendár termínov a úloh
- Offline fronta, zachované prihlásenie a automatická synchronizácia každých 30 sekúnd aj po návrate do aplikácie
- Firemné smenovky s vlastným počtom čistých strán PDF pre každú firmu

Fotografie sa spracujú lokálne. Verejný Supabase anon/publishable kľúč nie je heslo databázy; secret ani service-role kľúč sa do aplikácie nikdy nevkladá.
