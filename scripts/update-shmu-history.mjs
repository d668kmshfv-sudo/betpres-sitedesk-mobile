#!/usr/bin/env node
/**
 * Build a small, same-origin history file for GitHub Pages from SHMÚ's public
 * minute observations. SHMÚ timestamps are UTC; diary days are Bratislava days.
 * Source metadata: https://opendata.shmu.sk/meteorology/climate/now/metadata/aws1min_metadata.json
 * Station positions: https://www.shmu.sk/File/Klima/zoznam_klimatologickych_stanic_SK.pdf
 * Licence: CC BY 4.0 (https://opendata.shmu.sk/README.txt)
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'ipad/assets/data/shmu-history.json');
const SOURCE = 'https://opendata.shmu.sk/meteorology/climate/now/data/';
const TIME_ZONE = 'Europe/Bratislava';
const KEEP_DAYS = 14;
const CONCURRENCY = 6;
const STATION_ROWS = [
  [6664,"Málinec",48.42222,19.66278],
  [6665,"Ďubákovo",48.55667,19.7375],
  [11800,"Holíč",48.81222,17.16361],
  [11801,"Kuchyňa, Nový Dvor",48.40139,17.14778],
  [11802,"Trenčín, Biskupice",48.89694,18.02917],
  [11805,"Senica",48.68056,17.34361],
  [11806,"Myjava",48.75389,17.56167],
  [11810,"Bratislava, Mlynská dolina",48.15222,17.07028],
  [11812,"Malý Javorník",48.25583,17.15389],
  [11813,"Bratislava, Koliba",48.16861,17.11056],
  [11815,"Slovenský Grob",48.26056,17.27972],
  [11816,"Bratislava, letisko",48.17167,17.2],
  [11817,"Kráľová pri Senci",48.2,17.27472],
  [11818,"Gabčíkovo",47.89583,17.56556],
  [11819,"Jaslovské Bohunice",48.48667,17.67083],
  [11820,"Žihárec",48.07028,17.88194],
  [11826,"Piešťany",48.61306,17.83278],
  [11833,"Modra, Piesok",48.37417,17.27583],
  [11835,"Moravský Svätý Ján",48.58167,16.99417],
  [11841,"Dolný Hričov",49.23222,18.61417],
  [11846,"Veľké Ripňany",48.51056,17.99056],
  [11847,"Topoľčany",48.56389,18.15611],
  [11850,"Podhájska",48.1075,18.33917],
  [11855,"Nitra, Veľké Janíkovce",48.27889,18.13833],
  [11856,"Mochovce",48.28944,18.45611],
  [11858,"Hurbanovo",47.87306,18.19417],
  [11862,"Beluša",49.06611,18.31806],
  [11865,"Žilina",49.20528,18.74667],
  [11866,"Čadca",49.42694,18.80639],
  [11867,"Prievidza",48.76972,18.59389],
  [11868,"Oravská Lesná",49.36833,19.18306],
  [11869,"Rabča",49.47917,19.485],
  [11872,"Ružomberok",49.0725,19.34111],
  [11874,"Liptovský Hrádok",49.03917,19.72528],
  [11876,"Podbanské",49.14,19.91056],
  [11878,"Liptovský Mikuláš, Ondrášová",49.09778,19.59222],
  [11879,"Kremnické Bane",48.73583,18.91],
  [11880,"Dudince",48.16917,18.87611],
  [11881,"Želiezovce",48.04583,18.64111],
  [11890,"Oravské Veselé",49.47139,19.385],
  [11892,"Oravský Podzámok",49.2625,19.37111],
  [11893,"Martin",49.02667,18.92278],
  [11897,"Turčianske Teplice",48.86,18.86028],
  [11898,"Banská Bystrica, Zelená",48.73361,19.11694],
  [11900,"Žiar nad Hronom",48.58611,18.85222],
  [11901,"Banská Štiavnica",48.44944,18.92167],
  [11902,"Bzovík",48.31917,19.09389],
  [11903,"Sliač",48.6425,19.14194],
  [11904,"Vígľaš ‐ Pstruša",48.54417,19.32194],
  [11905,"Dolné Plachtince",48.20667,19.32],
  [11908,"Liptovská Osada",48.95083,19.27389],
  [11910,"Lom nad Rimavicou",48.66056,19.66583],
  [11916,"Chopok",48.94389,19.59222],
  [11917,"Brezno",48.80167,19.63722],
  [11918,"Liesek",49.36944,19.67944],
  [11927,"Boľkovce",48.33889,19.73639],
  [11930,"Lomnický štít",49.19528,20.215],
  [11931,"Skalnaté Pleso",49.18944,20.23583],
  [11933,"Štrbské Pleso",49.11944,20.06333],
  [11934,"Poprad",49.06889,20.24556],
  [11935,"Tatranská Lomnica",49.16444,20.28806],
  [11936,"Tatranská Javorina",49.26306,20.14361],
  [11938,"Telgárt",48.84861,20.18917],
  [11941,"Ratková",48.59278,20.09361],
  [11942,"Rimavská Sobota",48.37389,20.01056],
  [11944,"Rožňava",48.65306,20.5375],
  [11945,"Švedlár",48.81056,20.70889],
  [11946,"Štós, kúpele",48.71806,20.7975],
  [11947,"Moldava nad Bodvou",48.60278,20.99889],
  [11949,"Spišské Vlachy",48.94306,20.80222],
  [11950,"Podolínec",49.25556,20.53278],
  [11951,"Červený Kláštor",49.38722,20.42417],
  [11952,"Gánovce",49.035,20.32417],
  [11953,"Revúca",48.69306,20.11444],
  [11955,"Prešov, vojsko",49.03194,21.30861],
  [11957,"Stará Lesná",49.15278,20.29111],
  [11959,"Tatranská Polianka",49.12194,20.1875],
  [11960,"Košice, mesto",48.72528,21.265],
  [11961,"Plaveč nad Popradom",49.25972,20.84583],
  [11962,"Bardejov",49.28944,21.27389],
  [11963,"Jakubovany",49.10889,21.14083],
  [11966,"Čaklov",48.9025,21.63111],
  [11968,"Košice, letisko",48.67222,21.2225],
  [11970,"Silica",48.55472,20.52083],
  [11976,"Tisinec",49.21556,21.65],
  [11977,"Medzilaborce",49.25333,21.91389],
  [11978,"Milhostov",48.66306,21.72389],
  [11979,"Somotor",48.42139,21.81833],
  [11982,"Michalovce",48.74,21.94528],
  [11984,"Orechová",48.70528,22.22528],
  [11992,"Osadné",49.14,22.15083],
  [11993,"Kamenica nad Cirochou",48.93889,22.00611]
];
const STATIONS = new Map(STATION_ROWS.map(([id, name, lat, lon]) => [id, { name, lat, lon }]));
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
}

function datePlus(date, amount) {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}

function localDate(utcTime) {
  return dayFormatter.format(utcTime);
}

function parseArgs() {
  const endDate = argValue('--date') || localDate(new Date(Date.now() - 86_400_000));
  const days = Number(argValue('--days') || 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || Number.isNaN(Date.parse(`${endDate}T12:00:00Z`))) {
    throw new Error('Use --date YYYY-MM-DD.');
  }
  if (!Number.isInteger(days) || days < 1 || days > KEEP_DAYS) {
    throw new Error(`Use --days between 1 and ${KEEP_DAYS}.`);
  }
  return { endDate, days };
}

async function request(url, asJson = false) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': 'BETPRES-SiteDesk/1.0 (daily SHMU open-data aggregation)' },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return asJson ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw new Error(`${url}: ${lastError?.message || lastError}`);
}

async function listMinuteFiles(date) {
  const directory = `${SOURCE}${date.replaceAll('-', '')}/`;
  const html = await request(directory);
  const entries = [...html.matchAll(/<a href="([^"]+\.json)">(aws1min - [^<]+\.json)<\/a>/g)]
    .map(([, href, filename]) => ({ url: new URL(href, directory).href, filename }))
    .filter(item => item.filename.includes(date));
  if (!entries.length) throw new Error(`No SHMÚ minute files found for ${date}.`);
  return entries;
}

async function forEachConcurrent(items, limit, fn) {
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (error) {
        failures.push(error.message);
      }
    }
  }));
  return failures;
}

function observe(aggregates, seen, row, targetDate) {
  const id = Number(row.ind_kli);
  const minute = typeof row.minuta === 'string' ? row.minuta : '';
  if (!Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(minute)) return;
  // SHMÚ records UTC minutes without a zone suffix. The directory/file names
  // are publication times, so a few files from the next directory are needed.
  const instant = new Date(`${minute}Z`);
  if (!Number.isFinite(instant.getTime()) || localDate(instant) !== targetDate) return;
  const key = `${id}/${minute}`;
  if (seen.has(key)) return;
  seen.add(key);

  let station = aggregates.get(id);
  if (!station) {
    station = { min: Infinity, max: -Infinity, samples: 0, rainMm: 0, rainSamples: 0, sunshineSeconds: 0 };
    aggregates.set(id, station);
  }
  const temperature = Number(row.t);
  if (row.t !== null && Number.isFinite(temperature) && temperature >= -70 && temperature <= 60) {
    station.min = Math.min(station.min, temperature);
    station.max = Math.max(station.max, temperature);
    station.samples += 1;
  }
  const rain = Number(row.zra_uhrn);
  if (row.zra_uhrn !== null && Number.isFinite(rain) && rain >= 0 && rain <= 100) {
    station.rainMm += rain;
    station.rainSamples += 1;
  }
  const sunshine = Number(row.sln_trv);
  if (row.sln_trv !== null && Number.isFinite(sunshine) && sunshine >= 0 && sunshine <= 60) {
    station.sunshineSeconds += sunshine;
  }
}

function conditionFor(station) {
  if (!station.rainSamples) return 'Zrážky nie sú dostupné';
  if (station.rainMm >= 0.05) return 'Zaznamenané zrážky';
  if (station.sunshineSeconds >= 3600) return 'Bez zrážok, slnečné intervaly';
  return 'Bez zaznamenaných zrážok';
}

async function buildDay(date) {
  const nextDate = datePlus(date, 1);
  const main = await listMinuteFiles(date);
  const following = await listMinuteFiles(nextDate);
  // The next day's early publication files complete the last local minutes.
  const spillover = following.filter(item => /\s0[01]-[0-5]\d-\d\d\.json$/.test(item.filename));
  if (main.length < 260 || spillover.length < 12) {
    throw new Error(`Incomplete SHMÚ archive for ${date}: ${main.length} main, ${spillover.length} spillover files.`);
  }
  const aggregates = new Map();
  const seen = new Set();
  const files = [...main, ...spillover];
  const failures = await forEachConcurrent(files, CONCURRENCY, async item => {
    const payload = await request(item.url, true);
    if (!Array.isArray(payload.data)) throw new Error(`Invalid SHMÚ payload: ${item.url}`);
    for (const row of payload.data) observe(aggregates, seen, row, date);
  });
  if (failures.length > 5) {
    throw new Error(`${failures.length} of ${files.length} SHMÚ files failed for ${date}: ${failures.slice(0, 3).join('; ')}`);
  }
  const stations = [...aggregates].filter(([, data]) => data.samples > 0).map(([id, data]) => {
    const position = STATIONS.get(id);
    return {
      id,
      name: position?.name || `Stanica ${id}`,
      lat: position?.lat ?? null,
      lon: position?.lon ?? null,
      minC: Math.round(data.min),
      maxC: Math.round(data.max),
      precipitationMm: Math.round(data.rainMm * 10) / 10,
      condition: conditionFor(data),
      sampleCount: data.samples,
    };
  }).sort((a, b) => a.id - b.id);
  if (stations.length < 60) throw new Error(`Only ${stations.length} SHMÚ stations have temperatures for ${date}.`);
  console.log(`${date}: ${stations.length} stations, ${files.length - failures.length}/${files.length} files, ${seen.size} unique minutes.`);
  return { stations };
}

async function main() {
  const { endDate, days } = parseArgs();
  let prior = {};
  try { prior = JSON.parse(await readFile(OUTPUT, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const dates = { ...(prior.dates || {}) };
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = datePlus(endDate, -offset);
    dates[date] = await buildDay(date);
  }
  const retained = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)).slice(-KEEP_DAYS));
  if (JSON.stringify(retained) === JSON.stringify(prior.dates || {})) {
    console.log('SHMÚ history is unchanged.');
    return;
  }
  const output = {
    schemaVersion: 1,
    source: 'Slovenský hydrometeorologický ústav (SHMÚ), minútové merania automatických staníc',
    sourceUrl: SOURCE,
    stationListUrl: 'https://www.shmu.sk/File/Klima/zoznam_klimatologickych_stanic_SK.pdf',
    license: 'CC BY 4.0',
    timeZone: TIME_ZONE,
    generatedAt: new Date().toISOString(),
    dates: retained,
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
