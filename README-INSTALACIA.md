# BETPRES SiteDesk Mobile 1.0.8 – iPhone a iPad

Mobilná aplikácia je PWA určená pre iPhone. Po zverejnení na HTTPS adrese sa správa ako bežná aplikácia, má vlastnú ikonu a základné údaje fungujú aj bez signálu.

## Inštalácia na iPhone

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

- Pasport materiálu s automatickou AI analýzou celého dodacieho listu
- Doplnenie dodávateľa, dátumu, čísla dokladu, materiálu a ceny; ak cena chýba, viditeľne označený orientačný AI odhad
- Vady a nedorobky s fotografiami
- Denný denník zo stavby
- Stav pracovníkov po firmách
- Kalendár termínov a úloh
- Offline fronta a bezpečná synchronizácia s aktuálnou cloudovou verziou
- Samostatné fotografovanie a výber viacerých záberov z galérie pri vadách a denných zápisoch
- Úprava existujúcich vád vrátane doplnenia ďalších fotografií
- Viditeľné náhľady fotografií v mobile, odstránenie fotografie a prenos obrázka do desktopu aj PDF
- Rýchle otvorenie modulov a činností cez vyhľadávanie (na iPade aj skratkou Ctrl/Cmd + K)
- Režim sústredenia pre stav pracovníkov a koordinačné porady
- Prehľadné bočné menu a plnohodnotné široké zobrazenie na iPade

Lokálne OCR ostáva ako záložný režim bez cloudu. Pri AI analýze sa vybraná fotografia odošle cez chránenú Supabase Edge Function do OpenAI API. OpenAI API kľúč sa ukladá iba ako Supabase secret a nikdy sa nevkladá do mobilnej aplikácie ani do verejného repozitára.

