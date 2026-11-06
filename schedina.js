'use strict';

/* =========================================================
   Lettura di una schedina dal testo di uno screenshot.

   Il comando rapido "Registra giocata" dell'iPhone legge le scritte
   dell'immagine e le copia; qui si capisce cosa sono: giocatore, linea,
   quota, importo, partita, data. Due bookmaker:
   - bet365 (screenshot o immagine del pulsante Condividi)
   - Sisal (dettaglio del biglietto, o immagine "Il Mio Tip" del pulsante Condividi)

   Il riconoscimento del testo non legge sempre nell'ordine in cui guardi:
   spesso legge prima la colonna di sinistra e poi quella di destra (es. le
   quote arrivano tutte in fondo). Le regole ne tengono conto.

   Niente pagina: solo testo → dati. Gli esempi veri per le prove stanno
   in schedine-prova/ (non pubblicata).
   ========================================================= */

const RX_QUOTA = /^\d{1,3}[.,]\d{2}$/;
const RX_NUMERO = /^[\d.,]+$/;
const quotaDa = t => parseFloat(String(t).replace(',', '.'));
function euroDa(t) {
  const m = String(t || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

/* Righe pulite: spazi in ordine e via i pallini/icone letti come simboli all'inizio */
function righeDi(testo) {
  return String(testo || '').replace(/\r/g, '').split('\n')
    .map(r => r.replace(/\s+/g, ' ').trim().replace(/^[•·●○◦*®©@¤°º]+\s*/, '').trim())
    .filter(Boolean);
}

/* ---------- Basket ---------- */

function tipoNbaDa(testo) {
  const t = String(testo || '').toLowerCase();
  if (/tripla doppia/.test(t)) return 'Tripla doppia';
  if (/doppia doppia/.test(t)) return 'Doppia doppia';
  const p = /punt/.test(t);
  const r = /rimbalz/.test(t);
  const a = /assist/.test(t);
  if (p && r && a) return 'P+R+A';
  if (p && r) return 'P+R';
  if (p && a) return 'P+A';
  if (r && a) return 'R+A';
  if (/triple|tiri da 3|da tre punti/.test(t)) return 'Triple';
  if (/stoppat/.test(t)) return 'Stoppate';
  if (/recuper|palle rubate/.test(t)) return 'Recuperi';
  if (p) return 'Punti';
  if (r) return 'Rimbalzi';
  if (a) return 'Assist';
  return null;
}

const SQUADRE_NBA = ['Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
  'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
  'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
  'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
  'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'];

/* bet365 scrive "ORL Magic", Sisal "LA Lakers": meglio il nome intero.
   Davanti possono esserci simboli letti dalle magliette ("N SA Spurs") */
function squadraNba(t) {
  const m = t.match(/\b[A-Z]{2,3}\s+((?:Trail\s+)?[A-Za-z0-9]+)$/);
  return (m && SQUADRE_NBA.find(s => s.endsWith(` ${m[1]}`))) || t;
}
const partitaNba = p => p.split(' - ').map(squadraNba).join(' - ');

/* Sisal scrive "PODZIEMSKI Brandin" o "Thompson, Ausar": diventano "Brandin Podziemski", "Ausar Thompson" */
const tuttoMaiuscolo = w => /[A-ZÀ-Ý]/.test(w) && w === w.toUpperCase();
const parolaNormale = w => w.toLowerCase().replace(/(^|[-'’])([a-zà-ÿ])/g, (x, prima, lettera) => prima + lettera.toUpperCase());
const RX_INIZIALI = /^([A-Z]\.)+$/;
function nomeGiocatore(t) {
  let parole;
  if (t.includes(',')) {
    const [cognome, nome] = t.split(',').map(x => x.trim());
    parole = `${nome} ${cognome}`.split(' ');
  } else {
    parole = t.trim().split(' ');
    const n = parole.findIndex(w => !tuttoMaiuscolo(w));
    if (n > 0) parole = [...parole.slice(n), ...parole.slice(0, n)];
    // "WASHINGTON P.J.": tutto maiuscolo, il nome sono le iniziali in fondo
    else if (n < 0 && parole.length > 1 && RX_INIZIALI.test(parole[parole.length - 1])) parole = [parole.pop(), ...parole];
  }
  return parole.filter(Boolean).map(w => (tuttoMaiuscolo(w) && w.length > 1 && !RX_INIZIALI.test(w) ? parolaNormale(w) : w)).join(' ');
}

/* "Più di 2" → 2,5 · "Meno di 3" → 2,5 · "Over 2.5" → 2,5 */
function lineaDa(parola, numero) {
  const x = quotaDa(numero);
  if (!Number.isInteger(x)) return x;
  if (/più|piu/i.test(parola)) return x + 0.5;
  if (/meno/i.test(parola)) return x - 0.5;
  return x;
}

/* ---------- Calcio ---------- */

function competizioneDa(t) {
  if (/champions|europa league|conference|uefa|supercoppa europea/i.test(t)) return 'uefa';
  if (/mondial|europei|nations|qualificaz|nazional|copa am[eé]rica|coppa d.africa/i.test(t)) return 'nazionali';
  return 'campionati';
}

/* Da "cosa ho giocato" + "mercato" ai campi del registro (tipo + dettaglio) */
function mercatoCalcioDa(scelta, mercato, squadre, nelCombo) {
  const t = scelta.replace(/\s+:\s*/g, ': ').trim();
  const m = mercato.replace(/\s*-\s*S[iì]\/No$/i, '').trim();
  let x;
  if (/handicap/i.test(m) && (x = t.match(/^(.+?)\s*([+-])\s?(\d+(?:[.,]\d+)?)$/))) {
    return { tipo: 'Handicap', dettaglio: `${x[1]} ${x[2]}${decimale(quotaDa(x[3]))}` };
  }
  if ((x = t.match(/^(over|under|più di|piu di|meno di)\s+(\d+(?:[.,]\d+)?)/i))) {
    return { tipo: /over|più|piu/i.test(x[1]) ? 'Over' : 'Under', dettaglio: decimale(lineaDa(x[1], x[2])) };
  }
  if (/^(1X|X2|12)$/i.test(t)) return { tipo: t.toUpperCase(), dettaglio: '' };
  if (/risultato finale|esito finale|1x2|tempi regolamentari/i.test(m)) {
    if (/^(x|pareggio)$/i.test(t)) return { tipo: 'X', dettaglio: '' };
    if (t === squadre[0] || t === '1') return { tipo: '1', dettaglio: '' };
    if (t === squadre[1] || t === '2') return { tipo: '2', dettaglio: '' };
  }
  if (/entramb|goal\/no ?goal|gol\/no ?gol/i.test(m)) return { tipo: /^no/i.test(t) ? 'NoGoal' : 'Goal', dettaglio: '' };
  const siNo = t.match(/^(.+?)\s+-\s+(s[iì]|no)$/i);
  if (siNo) return { tipo: 'Altro', dettaglio: `${m}: ${siNo[1]}${/^no$/i.test(siNo[2]) ? ' (no)' : ''}` };
  return { tipo: 'Altro', dettaglio: nelCombo || !m ? t : `${m}: ${t}` };
}

/* =========================================================
   bet365
   ========================================================= */

const SCARTA_365 = [
  RX_NUMERO, /condividi/i, /hillside|new media malta/i, /^\(\(.*\)\)$/, /^\d{1,2}:\d{2}/,
  /^(gioco|responsabile|18\+|home|sport|live|scommesse|casino|bet365|vincente|perdente|avanti di)$/i,
  /^(lun|mar|mer|gio|ven|sab|dom)\s+\d/i, /^€/, /^[^A-Za-zÀ-ÿ0-9]+$/,
  /bonus multipla|maggiorazione|^applicato una volta|riutilizza selezioni/i, /^[+-]?\d+(?:[.,]\d+)?%$/,
];
// Data della partita nell'immagine di Condividi: "Sab 7 Nov" (l'ora sta sotto, "02:10")
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const RX_DATA_365 = /\b(?:Lun|Mar|Mer|Gio|Ven|Sab|Dom)\s+(\d{1,2})\s+(Gen|Feb|Mar|Apr|Mag|Giu|Lug|Ago|Set|Ott|Nov|Dic)\b(?:\s+(\d{1,2}):(\d{2}))?/;
const due = n => String(n).padStart(2, '0');

/* Riga che apre una selezione (o un Bet Builder) */
function titolo365(r) {
  let m;
  if ((m = r.match(/^BET BUILDER(?:\s+(\d{1,3}[.,]\d{2}))?$/i))) return { combo: true, quota: m[1] ? quotaDa(m[1]) : null };
  // "Miles Bridges: 30+ punti, assist e rimbalzi 2.75" (la quota può mancare se il titolo va a capo)
  if ((m = r.match(/^(.+?):\s*(\d+)\+\s*(.*?)(?:\s+(\d{1,3}[.,]\d{2}))?$/))) {
    return { soglia: { nome: m[1].trim(), n: Number(m[2]), stat: m[3] }, quota: m[4] ? quotaDa(m[4]) : null };
  }
  if ((m = r.match(/^(.+?)\s+(\d{1,3}[.,]\d{2})$/))) return { scelta: m[1], quota: quotaDa(m[2]) };
  // L'iPhone spesso legge la quota su un'altra riga: si riconoscono le scelte dalla forma
  // "Cam Spencer - Sì" · "Real Madrid -1.0" · "Più di 2.5"
  if (/^[A-ZÀ-Ý].+\s+-\s+(s[iì]|no)$/i.test(r) || /^[A-ZÀ-Ý].*\S\s[+-]\d+(?:[.,]\d)?$/.test(r)
    || /^(over|under|più di|piu di|meno di)\s+\d+(?:[.,]\d)?$/i.test(r)) return { scelta: r, quota: null };
  return null;
}

/* Una condizione (o una selezione semplice): "cosa ho giocato" + riga del mercato sotto */
function voce365(testa, mercato, squadre, basket, nelCombo) {
  let x;
  const soglia = typeof testa === 'object' ? testa : null;
  if (!soglia && (x = testa.match(/^(.+?):\s*(\d+)\+\s*(.+)$/))) return voce365({ nome: x[1].trim(), n: Number(x[2]), stat: x[3] }, mercato, squadre, basket, nelCombo);
  if (soglia) {
    const tipo = tipoNbaDa(`${soglia.stat} ${mercato}`);
    if (tipo) {
      const nota = /quarto|tempo|metà/i.test(mercato) ? `${soglia.nome}: ${mercato}` : '';
      return { sport: 'nba', giocatore: soglia.nome, tipo, verso: 'over', linea: soglia.n - 0.5, nota };
    }
    return { sport: 'calcio', tipo: 'Altro', dettaglio: `${soglia.nome}: ${soglia.n}+ ${soglia.stat}`.trim() };
  }
  if (basket || tipoNbaDa(mercato)) {
    if ((x = testa.match(/^(.+?)\s+-\s+(s[iì]|no)$/i))) {
      return { sport: 'nba', giocatore: x[1], tipo: tipoNbaDa(mercato) || 'Punti', verso: /^no$/i.test(x[2]) ? 'under' : 'over', linea: null };
    }
    if ((x = testa.match(/^(.+?)\s+(over|under|più di|piu di|meno di)\s+(\d+(?:[.,]\d+)?)/i))) {
      return { sport: 'nba', giocatore: x[1], tipo: tipoNbaDa(`${testa} ${mercato}`) || 'Punti', verso: /over|più|piu/i.test(x[2]) ? 'over' : 'under', linea: lineaDa(x[2], x[3]) };
    }
  }
  return { sport: 'calcio', ...mercatoCalcioDa(testa, mercato, squadre, nelCombo) };
}

function selezione365(blocco) {
  let righe = blocco.righe;
  // Squadre: nel basket "(Fuori casa)" / "(In casa)", nel calcio le ultime due righe
  const fuori = righe.find(r => /\(fuori casa\)/i.test(r));
  const casa = righe.find(r => /\(in casa\)/i.test(r));
  let squadre;
  if (fuori || casa) {
    squadre = [fuori, casa].filter(Boolean).map(r => squadraNba(r.replace(/\s*\((in|fuori) casa\).*$/i, '').trim()));
    righe = righe.filter(r => r !== fuori && r !== casa);
  } else {
    squadre = righe.slice(-2).map(r => r.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim());
    righe = righe.slice(0, -2);
  }
  const partita = squadre.join(' - ');
  const basket = !!(fuori || casa) || righe.some(r => tipoNbaDa(r));
  const t = blocco.titolo;
  let sel;

  if (t.combo) {
    // Bet Builder: coppie "condizione" + "mercato", poi le squadre
    const condizioni = [];
    for (let k = 0; k < righe.length; k += 2) condizioni.push(voce365(righe[k], righe[k + 1] || '', squadre, basket, true));
    const sport = condizioni.some(c => c.sport === 'nba') ? 'nba' : 'calcio';
    sel = { sport, partita, condizioni: condizioni.map(({ sport: _, ...c }) => c) };
  } else if (t.soglia) {
    // Se il titolo andava a capo, il pezzo mancante è prima del mercato
    const mercato = righe[righe.length - 1] || '';
    const soglia = { ...t.soglia, stat: [t.soglia.stat, ...righe.slice(0, -1)].join(' ') };
    sel = { partita, ...voce365(soglia, mercato, squadre, basket) };
  } else {
    sel = { partita, ...voce365(t.scelta, righe.join(' '), squadre, basket) };
  }
  sel.quota = t.quota;
  return sel;
}

function leggiBet365(tutte) {
  // Più schedine nello stesso screenshot: si prende la prima
  const testate = [];
  tutte.forEach((r, i) => { if (/^€\s?[\d.]+,\d{2}\s+\S/.test(r) && !/ritorno|chiusa|cash ?out|vincit|maggiorazione/i.test(r)) testate.push(i); });
  const righe = testate.length >= 2 ? tutte.slice(testate[0], testate[1]) : tutte;

  let esito = 'attesa';
  let incasso = null;
  let importo = null;
  let vincita = null;
  righe.forEach((r, i) => {
    if (/^vincita/i.test(r) && vincita == null) vincita = euroDa(r) ?? euroDa(righe[i + 1]);
    if (/^vincente$/i.test(r)) esito = 'vinta';
    else if (/^perdente$/i.test(r)) esito = 'persa';
    else if (/scommessa chiusa/i.test(r)) { esito = 'cashout'; incasso = euroDa(r); }
    else if (/^punt\b/i.test(r) && importo == null) importo = euroDa(r) ?? euroDa(righe[i + 1]);
  });

  const fine = righe.findIndex(r => /^punt\b/i.test(r));
  const blocchi = [];
  const sciolte = [];   // quote lette lontano dalla loro selezione
  const date = [];      // date e ore delle partite, nell'ordine in cui arrivano
  const ore = [];
  let cur = null;
  const prima = [];     // righe prima della prima selezione riconosciuta
  (fine >= 0 ? righe.slice(0, fine) : righe).forEach(r => {
    let x;
    // (la data in cima all'immagine è quella di quando l'hai condivisa: arriva prima della prima selezione)
    const iniziata = blocchi.length || prima.length;
    if (iniziata && (x = r.match(RX_DATA_365))) {
      date.push(`${due(x[1])}/${due(MESI_BREVI.indexOf(x[2]) + 1)}`);
      if (x[3]) ore.push(`${due(x[3])}:${x[4]}`);
    } else if (iniziata && (x = r.match(/^(\d{1,2}):(\d{2})$/))) ore.push(`${due(x[1])}:${x[2]}`);
    if (RX_QUOTA.test(r)) { sciolte.push(quotaDa(r)); return; }
    if (SCARTA_365.some(rx => rx.test(r))) return;
    const t = titolo365(r);
    // Dentro un Bet Builder le righe "Giocatore: 25+ punti" senza quota sono condizioni, non selezioni nuove
    const dentroCombo = cur && cur.titolo.combo;
    if (t && (t.combo || t.quota != null || !dentroCombo)) {
      cur = { titolo: t, righe: [] };
      blocchi.push(cur);
    } else if (cur) cur.righe.push(r);
    else prima.push(r);
  });
  // Singola con una scelta qualsiasi ("Inter") e la quota su un'altra riga: la prima riga rimasta è la scelta
  if (!blocchi.length && prima.length) blocchi.push({ titolo: { scelta: prima[0], quota: null }, righe: prima.slice(1) });
  // La colonna di destra a volte arriva in fondo, anche dopo "Punt:"
  if (fine >= 0) righe.slice(fine).forEach(r => { if (RX_QUOTA.test(r)) sciolte.push(quotaDa(r)); });
  blocchi.filter(b => b.titolo.quota == null).forEach(b => { if (sciolte.length) b.titolo.quota = sciolte.shift(); });

  const selezioni = blocchi.map((b, k) => ({ ...selezione365(b), data: date[k] ? dataDa(date[k]) : null, orario: ore[k] || '' }));
  // Quota vera = vincita ÷ puntata: comprende il bonus multipla e gli arrotondamenti (non con il cashout)
  const quota = esito !== 'cashout' && importo && vincita > importo ? Math.round((vincita / importo) * 100) / 100 : null;
  if (selezioni.length === 1 && selezioni[0].quota == null) selezioni[0].quota = quota;
  return { bookmaker: 'bet365', schedine: Math.max(1, testate.length), importo, esito, incasso, quota, selezioni };
}

/* =========================================================
   Sisal
   ========================================================= */

/* Mercato Sisal + scelta (OVER, SI, 1...) ai campi del registro */
function voceSisal(mercato, scelta, sportEvento) {
  const m = mercato.replace(/\s+/g, ' ').trim();
  const s = scelta.trim().toUpperCase();
  let x;
  // "PODZIEMSKI Brandin U/O 15.5 PUNTI INC. TS" + OVER
  if ((x = m.match(/^(.+?)\s+U\/O\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i)) && tipoNbaDa(x[3])) {
    return { sport: 'nba', giocatore: nomeGiocatore(x[1]), tipo: tipoNbaDa(x[3]), verso: /UNDER/.test(s) ? 'under' : 'over', linea: quotaDa(x[2]) };
  }
  // "EMBIID Joel REALIZZA ALMENO 20 PUNTI INCL. T.S." + SI
  if ((x = m.match(/^(.+?)\s+(?:REALIZZA|CATTURA|FORNISCE|SEGNA|OTTIENE|FA)\s+ALMENO\s+(\d+)\s+(.+)$/i)) && tipoNbaDa(x[3])) {
    return { sport: 'nba', giocatore: nomeGiocatore(x[1]), tipo: tipoNbaDa(x[3]), verso: /^NO/.test(s) ? 'under' : 'over', linea: Number(x[2]) - 0.5 };
  }
  if ((x = m.match(/^(.+?)\s+(DOPPIA DOPPIA|TRIPLA DOPPIA)/i))) {
    return { sport: 'nba', giocatore: nomeGiocatore(x[1]), tipo: tipoNbaDa(x[2]), verso: /^NO/.test(s) ? 'under' : 'over', linea: null };
  }
  // Calcio (da rifinire con schedine vere)
  if ((x = m.match(/U\/O\s+(\d+(?:[.,]\d+)?)/i)) && /^(OVER|UNDER)$/.test(s)) {
    return { sport: 'calcio', tipo: s === 'OVER' ? 'Over' : 'Under', dettaglio: decimale(quotaDa(x[1])) };
  }
  if (/^(1|X|2|1X|X2|12)$/.test(s) && /1X2|ESITO|DOPPIA CHANCE|FINALE/i.test(m)) return { sport: 'calcio', tipo: s, dettaglio: '' };
  if (/^(GOAL|GOL|NOGOAL|NOGOL|NO GOAL|NO GOL)$/.test(s)) return { sport: 'calcio', tipo: /^NO/.test(s) ? 'NoGoal' : 'Goal', dettaglio: '' };
  const leggibile = parolaNormale(m).replace(/\bU\/o\b/g, 'U/O');
  return sportEvento === 'nba'
    ? { sport: 'nba', giocatore: '', tipo: tipoNbaDa(m) || 'Punti', verso: /UNDER|^NO/.test(s) ? 'under' : 'over', linea: null }
    : { sport: 'calcio', tipo: 'Altro', dettaglio: `${leggibile}: ${parolaNormale(s)}` };
}

const RX_DATA_SISAL = /^(oggi|domani|ieri|\d{2}\/\d{2})\s*-\s*(\d{2}):(\d{2})\s*[^\d\s]?$/i;   // a volte con un segno attaccato ("01:40ł")
const RX_SCARTA_SISAL = /^(home|tipster|biglietto|mybets|promozioni|t|<|info biglietto|selfie bet)$|^\d{1,2}:\d{2}\s|risultati live|certificazione ufficiale|responsabilità circa|social del mondo|sisal\.it|^[a-z]?ipster$/i;

/* "05/11" → data vera: l'anno è quello della giocata (o il più vicino a oggi) */
function dataDa(giorno, annoRif) {
  if (/oggi/i.test(giorno)) return oggiISO();
  if (/domani/i.test(giorno)) return domaniISO();
  if (/ieri/i.test(giorno)) return ieriISO();
  const [g, m] = giorno.split('/').map(Number);
  const rif = annoRif || new Date();
  let anno = rif.getFullYear();
  // Partita di gennaio giocata a dicembre: è l'anno dopo
  if (m < rif.getMonth() + 1 - 6) anno++;
  if (m > rif.getMonth() + 1 + 6) anno--;
  return `${anno}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

function esitoSisal(t) {
  if (/non hai vinto|tip non vincente|non vincente|perdente/i.test(t)) return 'persa';
  if (/hai vinto|tip vincente/i.test(t)) return 'vinta';
  if (/rimborsat/i.test(t)) return 'rimborsata';
  return null;
}

/* Quota con accanto l'icona dell'orologio letta come lettera: "1.48 C" */
const RX_QUOTA_ICONA = /^(\d{1,3}[.,]\d{2})(?:\s+[^\d\s.,]{1,2})?$/;
/* Riga di sole parole con l'iniziale maiuscola ("Timberwolves", "Trail Blazers", "76ers"): non è un mercato */
const RX_SOLO_NOMI = /^[A-ZÀ-Ý0-9][a-zà-ÿ0-9'’.]*(?: [A-ZÀ-Ý0-9][a-zà-ÿ0-9'’.]*){0,2}$/;

/* Immagine "Il Mio Tip" (pulsante Condividi): tutte le partite, poi date e quote in fondo */
function leggiSisalTip(rr) {
  let importo = null;
  let quota = null;
  let esito = 'attesa';
  let rif = null;
  const eventi = [];
  const date = [];
  const quote = [];
  let cur = null;

  for (let i = 0; i < rr.length; i++) {
    const r = rr[i];
    let x;
    if (RX_SCARTA_SISAL.test(r) || /il mio tip/i.test(r)) continue;
    if ((x = r.match(/^quota\s+(\d{1,4}[.,]\d{2})$/i))) { quota = quotaDa(x[1]); continue; }
    if ((x = r.match(/giocato il (\d{2})\/(\d{2})\/(\d{4})/i))) { rif = new Date(Number(x[3]), Number(x[2]) - 1, Number(x[1])); continue; }
    if (/^puntata$/i.test(r)) { importo = euroDa(rr[i + 1]); i++; continue; }
    if (/^vincita/i.test(r)) { i++; continue; }
    if (esitoSisal(r) && /^tip/i.test(r)) { esito = esitoSisal(r); continue; }
    if ((x = r.match(RX_DATA_SISAL))) { date.push({ giorno: x[1], ora: `${x[2]}:${x[3]}` }); continue; }
    if ((x = r.match(RX_QUOTA_ICONA))) { quote.push(quotaDa(x[1])); continue; }
    if (/^my combo$/i.test(r)) { if (cur) cur.combo = true; continue; }
    // Partita: "Detroit Pistons - Philadelphia 76ers"
    if (/\S\s+-\s+\S/.test(r) && !/:|U\/O|ALMENO/.test(r) && !tuttoMaiuscolo(r.replace(/[^A-Za-zÀ-ÿ]/g, ''))) {
      cur = { partita: r, combo: false, quota: null, mercati: [] };
      eventi.push(cur);
      continue;
    }
    if (!cur) continue;
    // Nome della partita andato a capo: "New Orleans Pelicans - Minnesota" + "Timberwolves"
    if (!cur.mercati.length && RX_SOLO_NOMI.test(r)) { cur.partita += ` ${r}`; continue; }
    let pulita = r.replace(/^[Oo0]\s+(?=[A-ZÀ-Ý])/, '');
    // Quota sulla stessa riga della scelta ("...: SI 1.75")
    if ((x = pulita.match(/^(.*[A-Za-zÀ-ÿ])\s+(\d{1,3}[.,]\d{2})(?:\s+[^\d\s.,]{1,2})?$/)) && !/U\/O$/i.test(x[1])) {
      pulita = x[1];
      cur.quota = quotaDa(x[2]);
    }
    const ultimo = cur.mercati[cur.mercati.length - 1];
    // Il mercato va a capo finché non arriva ": SCELTA"
    if (ultimo && !/:\s*\S/.test(ultimo.testo)) ultimo.testo += ` ${pulita}`;
    else if (/:|U\/O|ALMENO|[A-Z]{3,}/.test(pulita)) cur.mercati.push({ testo: pulita });
  }

  eventi.filter(ev => ev.quota == null).forEach(ev => { if (quote.length) ev.quota = quote.shift(); });
  const selezioni = eventi.map((ev, k) => {
    const voci = ev.mercati.map(mm => {
      const i = mm.testo.lastIndexOf(':');
      return i >= 0 ? voceSisal(mm.testo.slice(0, i), mm.testo.slice(i + 1)) : voceSisal(mm.testo, '');
    });
    const sport = voci.some(v => v.sport === 'nba') ? 'nba' : 'calcio';
    const d = date[k];
    const partita = sport === 'nba' ? partitaNba(ev.partita) : ev.partita;
    const base = { sport, partita, quota: ev.quota, data: d ? dataDa(d.giorno, rif) : null, orario: d ? d.ora : '' };
    if (voci.length > 1 || ev.combo) return { ...base, condizioni: voci.map(({ sport: _, ...v }) => v) };
    return { ...base, ...(voci[0] || {}), sport };
  });
  if (selezioni.length === 1 && selezioni[0].quota == null) selezioni[0].quota = quota;
  return { bookmaker: 'sisal', schedine: 1, importo, esito, incasso: null, quota, selezioni };
}

/* Pagina "Dettaglio biglietto" dell'app Sisal */
function leggiSisalDettaglio(rr) {
  let importo = null;
  let quota = null;
  let esito = 'attesa';
  let rif = null;
  const eventi = [];
  let cur = null;
  // In fondo le etichette (Puntata totale, Quota, Vincita potenziale) arrivano prima e i valori dopo,
  // nello stesso ordine: si mettono in fila e si abbinano
  const etichette = [];

  for (let i = 0; i < rr.length; i++) {
    const r = rr[i].replace(/^[^A-Za-zÀ-ÿ0-9<]+\s*/, '');
    let x;
    if (!r || RX_SCARTA_SISAL.test(r)) continue;
    if ((x = r.match(/^gi.?cata:?\s*(\d{2})\/(\d{2})\/(\d{2,4})/i))) {
      const anno = Number(x[3]) < 100 ? 2000 + Number(x[3]) : Number(x[3]);
      rif = new Date(anno, Number(x[2]) - 1, Number(x[1]));
      continue;
    }
    if (/^gi.?cata:/i.test(r) || /dettaglio biglietto|^(singola|multipla|sistema)\b/i.test(r)) continue;
    if (esitoSisal(r)) { esito = esitoSisal(r); continue; }
    if (/^puntata totale/i.test(r)) { if (euroDa(r) != null) importo = euroDa(r); else etichette.push('puntata'); continue; }
    if (/^quota:?/i.test(r)) {
      x = r.match(/(\d{1,4}[.,]\d{2})/);
      if (x) quota = quotaDa(x[1]); else etichette.push('quota');
      continue;
    }
    if (/^vincita potenziale/i.test(r)) { if (euroDa(r) == null) etichette.push('vincita'); continue; }
    if (/€$/.test(r) && euroDa(r) != null) {
      const k = etichette.findIndex(e => e !== 'quota');
      if (k >= 0 && etichette.splice(k, 1)[0] === 'puntata') importo = euroDa(r);
      continue;
    }
    if (RX_QUOTA.test(r)) {
      const k = etichette.indexOf('quota');
      if (k >= 0) { etichette.splice(k, 1); quota = quotaDa(r); }
      continue;
    }
    if (RX_NUMERO.test(r)) continue;   // risultati e numeri della barra
    // Competizione: "USA NBA", "INT Eurolega", "ITA Serie A"
    if ((x = r.match(/^([A-Z]{3})\s+(.+)$/)) && !/\(\d/.test(r)) {
      cur = { competizione: x[2], squadre: [], data: null, orario: '', mercati: [] };
      eventi.push(cur);
      continue;
    }
    if (!cur) continue;
    if ((x = r.match(RX_DATA_SISAL))) { cur.data = dataDa(x[1], rif); cur.orario = `${x[2]}:${x[3]}`; continue; }
    if (cur.squadre.length < 2 && !cur.data) { cur.squadre.push(r); continue; }
    // "OVER (1.72)": scelta e quota del mercato appena letto
    if ((x = r.match(/^(.+?)\s*\((\d{1,3}[.,]\d{2})\)$/))) {
      const ultimo = cur.mercati[cur.mercati.length - 1];
      if (ultimo && ultimo.scelta == null) { ultimo.scelta = x[1]; ultimo.quota = quotaDa(x[2]); }
      continue;
    }
    if (/^my combo$/i.test(r)) { cur.combo = true; continue; }
    const ultimo = cur.mercati[cur.mercati.length - 1];
    if (ultimo && ultimo.scelta == null && !/U\/O|ALMENO/i.test(r)) ultimo.testo += ` ${r}`;
    else cur.mercati.push({ testo: r, scelta: null, quota: null });
  }

  const selezioni = eventi.map(ev => {
    const nba = /nba|eurolega|euroleague|eurocup|basket|lba\b/i.test(ev.competizione);
    const voci = ev.mercati.map(mm => ({ ...voceSisal(mm.testo, mm.scelta || '', nba ? 'nba' : 'calcio'), quota: mm.quota }));
    const sport = nba || voci.some(v => v.sport === 'nba') ? 'nba' : 'calcio';
    const partita = ev.squadre.join(' - ');
    const base = { sport, partita: sport === 'nba' ? partitaNba(partita) : partita, data: ev.data, orario: ev.orario };
    if (sport === 'calcio') base.competizione = competizioneDa(ev.competizione);
    if (voci.length > 1 && ev.combo) {
      return { ...base, quota: voci.find(v => v.quota)?.quota ?? null, condizioni: voci.map(({ sport: _, quota: __, ...v }) => v) };
    }
    return voci.map(v => ({ ...base, ...v, sport }));
  }).flat();
  // Singola: la quota della selezione è quella del biglietto
  if (selezioni.length === 1 && selezioni[0].quota == null) selezioni[0].quota = quota;
  return { bookmaker: 'sisal', schedine: 1, importo, esito, incasso: null, quota, selezioni };
}

/* =========================================================
   Ingresso: testo copiato → schedina (o null se non si riconosce)
   ========================================================= */

function leggiSchedina(testo) {
  const rr = righeDi(testo);
  if (!rr.length) return null;
  const tutto = rr.join('\n');
  let letta = null;
  if (/il mio tip|giocato il \d|sisal\.it\/tipster/i.test(tutto)) letta = leggiSisalTip(rr);
  else if (/dettaglio biglietto|puntata totale|^gi.?cata:/im.test(tutto)) letta = leggiSisalDettaglio(rr);
  else if (/bet365|hillside|^punt\b|vincita totale|bet builder|\((in|fuori) casa\)/im.test(tutto)) letta = leggiBet365(rr);
  if (!letta) return null;
  letta.selezioni = letta.selezioni.filter(s => s && (s.partita || s.giocatore || haCondizioni(s) || s.quota));
  if (!letta.selezioni.length) return null;

  // Data e ora della giocata: quelle dell'ultima partita (così "Da completare" arriva quando è finita l'ultima)
  const conData = letta.selezioni.filter(s => s.data).sort((a, b) => `${a.data} ${a.orario}`.localeCompare(`${b.data} ${b.orario}`));
  const ultima = conData[conData.length - 1];
  letta.data = ultima ? ultima.data : null;
  letta.orario = ultima ? ultima.orario || '' : '';
  // Note: es. "Jalen Smith: Punti nel 1° quarto" (il registro non ha un campo per i quarti)
  const note = letta.selezioni.flatMap(s => [s.nota, ...(s.condizioni || []).map(c => c.nota)]).filter(Boolean);
  letta.note = note.join(' · ');
  letta.selezioni.forEach(s => {
    delete s.data; delete s.orario; delete s.nota;
    (s.condizioni || []).forEach(c => delete c.nota);
  });
  return letta;
}
