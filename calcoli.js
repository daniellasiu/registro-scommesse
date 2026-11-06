'use strict';

/* =========================================================
   Dati di base, formati e calcoli.
   Qui non si tocca la pagina: solo numeri e testi.
   ========================================================= */

const PREDEFINITE = {
  base: 200,                 // cifra su cui si calcola lo stake NBA
  storicoBase: [],           // [{ data, da, a }]
  stakeRapidi: [5, 10, 15, 20],
  importiRapidi: [5, 10, 20],
  obiettivoNba: 1000,
  obiettivoCalcio: 1000,
  tema: 'auto',              // auto | chiaro | scuro
  ultimoBackup: null,
  ultimi: { area: 'nba', stake: '15', importo: '10', tipoNba: 'Punti', tipoCalcio: '1', competizione: 'campionati' },
};

const TIPI_NBA = ['Punti', 'Rimbalzi', 'Assist', 'Triple', 'P+R+A', 'P+R', 'P+A', 'R+A', 'Stoppate', 'Recuperi'];
const TIPI_CALCIO = ['1', 'X', '2', '1X', 'X2', '12', 'Over', 'Under', 'Goal', 'NoGoal', 'Handicap', 'Altro'];
const COMPETIZIONI = { campionati: 'Campionati', uefa: 'UEFA', nazionali: 'Nazionali' };
const COMPETIZIONI_LUNGHE = { campionati: 'Campionati', uefa: 'Competizioni UEFA', nazionali: 'Nazionali', misto: 'Multiple miste' };
const ESITI = { attesa: 'In attesa', vinta: 'Vinta', persa: 'Persa', rimborsata: 'Rimborsata', cashout: 'Cashout' };
const AREE = { nba: 'NBA', calcio: 'Calcio', divertimento: 'Divertimento' };
const FASI = { regular: 'Regular season', playoff: 'Playoff' };

/* ---------- Formati ---------- */

const MENO = '−';
const somma = arr => arr.reduce((a, b) => a + b, 0);
const arrot = n => Math.round(n * 100) / 100;
const limita = (n, min, max) => Math.max(min, Math.min(max, n));
const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* I formattatori si creano una volta sola e si riusano: crearli è la parte lenta */
const FORMATI_EURO = [0, 2].map(d => new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: d, maximumFractionDigits: d,
}));
const FORMATO_DATA_BREVE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const FORMATO_DATA_LUNGA = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const FORMATO_INIZIALE_GIORNO = new Intl.DateTimeFormat('it-IT', { weekday: 'narrow' });

const euro = (n, decimali = 2) => FORMATI_EURO[decimali === 0 ? 0 : 1].format(n);
/* 30 € invece di 30,00 €, ma 22,50 € resta così */
const euroAgile = n => euro(n, Number.isInteger(arrot(n)) ? 0 : 2);
const segno = n => (n > 0.004 ? 'pos' : n < -0.004 ? 'neg' : 'zero');
const euroSegno = (n, decimali = 2) => ({ pos: '+', neg: MENO, zero: '' }[segno(n)]) + euro(Math.abs(n), decimali);
const euroBreve = n => (n > 0 ? '+' : n < 0 ? MENO : '') + euro(Math.abs(n), 0);
const decimale = n => String(n).replace('.', ',');
const percento = n => `${decimale(n)}%`;
const percTesto = n => (n == null ? '–' : `${Math.round(n)}%`);
const percSegno = n => (n == null ? '–' : `${n >= 0 ? '+' : MENO}${Math.abs(n).toFixed(1).replace('.', ',')}%`);
const quotaTesto = q => q.toFixed(2).replace('.', ',');
const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/* ---------- Date ---------- */

function isoData(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function spostaGiorni(iso, giorni) {
  const d = new Date(`${iso}T12:00`);
  d.setDate(d.getDate() + giorni);
  return isoData(d);
}
const oggiISO = () => isoData();
const domaniISO = () => spostaGiorni(isoData(), 1);
const ieriISO = () => spostaGiorni(isoData(), -1);
const maiuscola = s => s.charAt(0).toUpperCase() + s.slice(1);

const dataBreve = iso => FORMATO_DATA_BREVE.format(new Date(`${iso}T12:00`));
const dataLunga = iso => maiuscola(FORMATO_DATA_LUNGA.format(new Date(`${iso}T12:00`)));
function giornoRelativo(iso) {
  if (iso === oggiISO()) return 'Oggi';
  if (iso === ieriISO()) return 'Ieri';
  if (iso === domaniISO()) return 'Domani';
  return dataLunga(iso);
}
function lunediDi(iso) {
  const d = new Date(`${iso}T12:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoData(d);
}

/* Stagioni: NBA da ottobre, calcio da agosto. "2026-27" */
function stagione(iso, meseInizio) {
  const [a, m] = iso.split('-').map(Number);
  const inizio = m >= meseInizio ? a : a - 1;
  return `${inizio}-${String(inizio + 1).slice(2)}`;
}
const stagioneNba = iso => stagione(iso, 10);
const stagioneCalcio = iso => stagione(iso, 8);
const stagioneDi = g => (g.area === 'nba' ? stagioneNba(g.data) : stagioneCalcio(g.data));
const stagioneCorrente = area => (area === 'nba' ? stagioneNba(oggiISO()) : stagioneCalcio(oggiISO()));

/* Playoff NBA proposti in automatico dal 18 aprile a fine giugno (modificabile) */
function faseAuto(iso) {
  const [, m, g] = iso.split('-').map(Number);
  return (m === 4 && g >= 18) || m === 5 || m === 6 ? 'playoff' : 'regular';
}

/* ---------- Giocate ---------- */

/* Quota tenendo conto delle selezioni annullate (si tolgono dalla multipla) */
function quotaEffettiva(g) {
  const annullate = g.selezioni.filter(s => s.esito === 'annullata');
  if (annullate.length === g.selezioni.length) return 1;
  return annullate.reduce((q, s) => q / s.quota, g.quota);
}

function ritorno(g) {
  switch (g.esito) {
    case 'vinta': return g.importo * quotaEffettiva(g);
    case 'rimborsata': return g.importo;
    case 'cashout': return g.incasso || 0;
    default: return 0;
  }
}
const netto = g => (g.esito === 'attesa' ? 0 : ritorno(g) - g.importo);

function esitoDaSelezioni(g) {
  const e = g.selezioni.map(s => s.esito);
  if (e.includes('persa')) return 'persa';
  if (e.includes('attesa')) return 'attesa';
  if (e.every(x => x === 'annullata')) return 'rimborsata';
  return 'vinta';
}

const ESITO_SEL_DA_GIOCATA = { attesa: 'attesa', vinta: 'vinta', persa: 'persa', rimborsata: 'annullata', cashout: 'attesa' };

function impostaEsitoGiocata(g, esito) {
  g.esito = esito;
  if (g.selezioni.length === 1) g.selezioni[0].esito = ESITO_SEL_DA_GIOCATA[esito];
}

/* Quando la partita è sicuramente finita */
function fineStimata(g) {
  if (g.orario) {
    const d = new Date(`${g.data}T${g.orario}`);
    d.setMinutes(d.getMinutes() + (g.area === 'nba' ? 180 : 150));
    return d;
  }
  return new Date(`${spostaGiorni(g.data, 1)}T00:00`);
}
const daCompletare = g => g.esito === 'attesa' && new Date() >= fineStimata(g);

/* Area a cui appartiene una giocata: nba, calcio o divertimento */
const areaDi = g => (g.divertimento ? 'divertimento' : g.area);

/* ---------- Testi ---------- */

function prestazione(s) {
  return [s.tipo, s.verso === 'under' ? 'Under' : 'Over', s.linea != null && s.linea !== '' ? decimale(s.linea) : '']
    .filter(Boolean).join(' ');
}
const mercatoCalcio = s => [s.tipo, s.dettaglio].filter(Boolean).join(' ');
const descrizioneSelezione = s => (s.sport === 'nba' ? prestazione(s) : mercatoCalcio(s));
const nomeSelezione = s => (s.sport === 'nba' ? s.giocatore : s.partita);

function titoloGiocata(g) {
  return g.selezioni.length > 1 ? `Multipla · ${g.selezioni.length} selezioni` : nomeSelezione(g.selezioni[0]);
}

/* ---------- Statistiche ---------- */

/* Competizione di una giocata di calcio: se le partite sono di gruppi diversi è "misto" */
function gruppoCalcio(g) {
  const gruppi = new Set(g.selezioni.filter(s => s.sport === 'calcio').map(s => s.competizione));
  return gruppi.size === 1 ? [...gruppi][0] : 'misto';
}

const chiaveOrdine = g => `${g.data} ${g.orario || '99:99'} ${g.creata}`;
const crescente = (a, b) => chiaveOrdine(a).localeCompare(chiaveOrdine(b));

function metriche(gs) {
  const chiuse = gs.filter(g => g.esito !== 'attesa').sort(crescente);
  const aperte = gs.filter(g => g.esito === 'attesa');
  const vinte = chiuse.filter(g => g.esito === 'vinta').length;
  const perse = chiuse.filter(g => g.esito === 'persa').length;
  const puntato = somma(chiuse.map(g => g.importo));
  const guadagno = somma(chiuse.map(netto));
  const conQuota = chiuse.filter(g => g.esito !== 'rimborsata');

  // Percentuale di vinte che serve per andare in pari (media di 1/quota, pesata sull'importo)
  const pesi = somma(conQuota.map(g => g.importo));
  const pareggio = pesi ? (somma(conQuota.map(g => g.importo / quotaEffettiva(g))) / pesi) * 100 : null;

  let cumulato = 0;
  let massimo = 0;
  let calo = 0;
  const punti = [{ v: 0, g: null }];
  chiuse.forEach(g => {
    cumulato += netto(g);
    massimo = Math.max(massimo, cumulato);
    calo = Math.max(calo, massimo - cumulato);
    punti.push({ v: cumulato, g });
  });

  let serie = 0;           // positiva = vinte di fila, negativa = perse di fila
  let recordV = 0;
  let recordP = 0;
  chiuse.forEach(g => {
    if (g.esito === 'vinta') serie = serie > 0 ? serie + 1 : 1;
    else if (g.esito === 'persa') serie = serie < 0 ? serie - 1 : -1;
    else return;
    recordV = Math.max(recordV, serie);
    recordP = Math.max(recordP, -serie);
  });

  return {
    chiuse, aperte, vinte, perse, puntato, guadagno, calo, punti, serie, recordV, recordP, pareggio,
    resa: puntato ? (guadagno / puntato) * 100 : null,
    percVinte: vinte + perse ? (vinte / (vinte + perse)) * 100 : null,
    quotaMedia: conQuota.length ? somma(conQuota.map(quotaEffettiva)) / conQuota.length : null,
    inGioco: somma(aperte.map(g => g.importo)),
  };
}

function nuovaRiga(nome) {
  return { nome, n: 0, vinte: 0, perse: 0, netto: 0, puntato: 0 };
}
function conta(r, esito, valore, importo = 0) {
  r.n++;
  if (esito === 'vinta') r.vinte++;
  if (esito === 'persa') r.perse++;
  r.netto += valore;
  r.puntato += importo;
}

/* Raggruppa le giocate concluse per una chiave */
function perGruppo(chiuse, chiave, etichette = {}) {
  const gruppi = new Map();
  chiuse.forEach(g => {
    const k = chiave(g);
    if (k == null) return;
    if (!gruppi.has(k)) gruppi.set(k, { ...nuovaRiga(etichette[k] ?? String(k)), chiave: k });
    conta(gruppi.get(k), g.esito, netto(g), g.importo);
  });
  return [...gruppi.values()];
}

/* Quanto della vincita/perdita di una giocata va a ciascuna selezione.
   Vinta: diviso tra le selezioni valide. Persa: tutto a quelle perse. */
function nettoPerSelezione(g) {
  const n = netto(g);
  const sel = g.selezioni;
  let coinvolte = [];
  if (g.esito === 'persa') {
    coinvolte = sel.filter(s => s.esito === 'persa');
    if (!coinvolte.length) coinvolte = sel;
  } else if (g.esito === 'vinta') {
    coinvolte = sel.filter(s => s.esito !== 'annullata');
  } else if (g.esito === 'cashout') {
    coinvolte = sel;
  }
  return sel.map(s => (coinvolte.includes(s) ? n / coinvolte.length : 0));
}

function perSelezione(chiuse, chiave, filtro) {
  const gruppi = new Map();
  chiuse.forEach(g => {
    const quote = nettoPerSelezione(g);
    g.selezioni.forEach((s, i) => {
      if (!filtro(s)) return;
      const k = chiave(s);
      if (!k) return;
      if (!gruppi.has(k)) gruppi.set(k, nuovaRiga(k));
      conta(gruppi.get(k), s.esito, quote[i]);
    });
  });
  return [...gruppi.values()];
}

/* Colonne del grafico "giorno per giorno" in base al periodo scelto */
function barrePeriodo(chiuse, periodo) {
  if (periodo === 'oggi') {
    return chiuse.map(g => ({ chiave: g.id, etichetta: titoloGiocata(g), asse: '', valore: netto(g), n: 1 }));
  }
  if (periodo === '7' || periodo === '30') {
    const giorni = Number(periodo);
    const barre = [];
    for (let i = giorni - 1; i >= 0; i--) {
      const iso = spostaGiorni(oggiISO(), -i);
      const iniziale = FORMATO_INIZIALE_GIORNO.format(new Date(`${iso}T12:00`));
      barre.push({ chiave: iso, etichetta: giornoRelativo(iso), asse: giorni === 7 ? iniziale.toUpperCase() : dataBreve(iso), valore: 0, n: 0 });
    }
    const indice = new Map(barre.map(b => [b.chiave, b]));
    chiuse.forEach(g => { const b = indice.get(g.data); if (b) { b.valore += netto(g); b.n++; } });
    return barre;
  }
  // Settimane (3 mesi e stagione)
  let inizio;
  let fine = lunediDi(oggiISO());
  if (periodo === '90') inizio = lunediDi(spostaGiorni(oggiISO(), -89));
  else {
    if (!chiuse.length) return [];
    inizio = lunediDi(chiuse[0].data);
    fine = lunediDi(chiuse[chiuse.length - 1].data);
  }
  const barre = [];
  for (let iso = inizio; iso <= fine; iso = spostaGiorni(iso, 7)) {
    barre.push({ chiave: iso, etichetta: `Settimana del ${dataBreve(iso)}`, asse: dataBreve(iso), valore: 0, n: 0 });
  }
  const indice = new Map(barre.map(b => [b.chiave, b]));
  chiuse.forEach(g => { const b = indice.get(lunediDi(g.data)); if (b) { b.valore += netto(g); b.n++; } });
  return barre;
}
