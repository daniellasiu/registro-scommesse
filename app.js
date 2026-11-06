'use strict';

/* =========================================================
   Stato
   ========================================================= */

let stato = caricaStato();
const ui = { tab: 'giocate', area: stato.impostazioni.ultimi.area === 'calcio' ? 'calcio' : 'nba', limite: 40 };
let bozza = null;          // giocata in corso di inserimento/modifica
let bozzaIniziale = '';    // per capire se ci sono modifiche non salvate

function caricaStato() {
  const s = Archivio.carica() || {};
  const imp = s.impostazioni || {};
  return {
    versione: 1,
    giocate: Array.isArray(s.giocate) ? s.giocate : [],
    impostazioni: { ...PREDEFINITE, ...imp, ultimi: { ...PREDEFINITE.ultimi, ...(imp.ultimi || {}) } },
  };
}

function salva() {
  if (!Archivio.salva(stato)) notifica('Salvataggio non riuscito', { icona: 'avviso', tono: 'testo-avviso' });
}

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const trova = id => stato.giocate.find(g => g.id === id);

/* =========================================================
   Tema chiaro / scuro
   ========================================================= */

/* iOS legge il colore della barra in alto (quella dell'ora) solo quando la pagina si apre.
   Per questo il tema scelto si applica già in index.html, in Automatico le due indicazioni
   con "media" le gestisce iOS, e nell'app della schermata Home un cambio di tema ricarica
   la pagina (tornando dov'eri). */
const appSchermataHome = navigator.standalone === true;

function applicaTema() {
  const t = stato.impostazioni.tema;
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t === 'scuro' ? 'dark' : 'light';
  $('meta[name="color-scheme"]').content = t === 'auto' ? 'light dark' : t === 'scuro' ? 'dark' : 'light';
  $$('meta[name="theme-color"]').forEach(m => m.remove());
  const colori = t === 'auto'
    ? [['#F2F2F7', '(prefers-color-scheme: light)'], ['#000000', '(prefers-color-scheme: dark)']]
    : [[t === 'scuro' ? '#000000' : '#F2F2F7']];
  colori.forEach(([colore, media]) => {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = colore;
    if (media) m.media = media;
    document.head.appendChild(m);
  });
}

/* Ricarica tornando alla stessa sezione e allo stesso punto della pagina */
function ricaricaQui() {
  try {
    sessionStorage.setItem('riapri', JSON.stringify({ tab: ui.tab, area: ui.area, scroll: $(`#tab-${ui.tab}`).scrollTop }));
  } catch { /* senza memoria di sessione si riparte da Giocate */ }
  location.reload();
}

// L'iPhone passa da chiaro a scuro (es. la sera) con il tema su Automatico
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (appSchermataHome && stato.impostazioni.tema === 'auto' && libero()) ricaricaQui();
});

/* =========================================================
   Componenti (restituiscono HTML)
   ========================================================= */

/* Selettore a segmenti. opzioni: [[valore, etichettaHTML, etichettaAccessibile?]] */
function segmentato(nome, opzioni, valore, { classe = '', sel = null } = {}) {
  const i = Math.max(0, opzioni.findIndex(o => String(o[0]) === String(valore)));
  return `<div class="seg ${classe}" data-seg="${nome}" ${sel != null ? `data-sel="${sel}"` : ''} data-i="${i}" style="--n:${opzioni.length};--i:${i}" role="radiogroup">
    <span class="seg-cursore"></span>
    ${opzioni.map(([v, etichetta, accessibile], k) => `<button type="button" role="radio" aria-checked="${k === i}" data-val="${esc(v)}" class="${k === i ? 'attivo' : ''}" ${accessibile ? `aria-label="${esc(accessibile)}"` : ''}>${etichetta}</button>`).join('')}
  </div>`;
}

function chip(nome, valore, etichetta, attivo, sel = null) {
  return `<button type="button" class="chip ${attivo ? 'attivo' : ''}" data-chip="${nome}" data-val="${esc(valore)}" ${sel != null ? `data-sel="${sel}"` : ''}>${esc(etichetta)}</button>`;
}

function interruttore(campo, acceso, etichetta) {
  return `<span class="interruttore"><input type="checkbox" role="switch" data-campo="${campo}" data-stato="${acceso ? 1 : 0}" ${acceso ? 'checked' : ''} aria-label="${esc(etichetta)}"><span class="traccia"></span></span>`;
}

function vuoto(nomeIcona, titolo, testo) {
  return `<div class="vuoto">${icona(nomeIcona)}<h3>${esc(titolo)}</h3><p>${esc(testo)}</p></div>`;
}

/* Il cursore dei segmenti scorre subito al tocco (prima che la pagina si ridisegni) */
document.addEventListener('click', e => {
  const b = e.target.closest('.seg button');
  if (!b) return;
  const seg = b.closest('.seg');
  const bottoni = $$(':scope > button', seg);
  const k = bottoni.indexOf(b);
  seg.style.setProperty('--i', k);
  bottoni.forEach((x, j) => { x.classList.toggle('attivo', j === k); x.setAttribute('aria-checked', j === k); });
}, true);

/* =========================================================
   Notifica in alto e conferme dal basso
   ========================================================= */

let timerNotifica;
function notifica(testo, { icona: nomeIcona = 'spunta', tono = '', azione = null, alAzione = null, durata = 2200 } = {}) {
  const n = $('#notifica');
  n.innerHTML = `<span class="${tono}">${icona(nomeIcona)}</span><span>${esc(testo)}</span>${azione ? `<button type="button">${esc(azione)}</button>` : ''}`;
  const nascondi = () => n.classList.remove('visibile');
  if (azione) n.querySelector('button').onclick = () => { nascondi(); alAzione(); };
  void n.offsetWidth;
  n.classList.add('visibile');
  clearTimeout(timerNotifica);
  timerNotifica = setTimeout(nascondi, azione ? 4500 : durata);
}

function chiedi({ titolo = '', messaggio = '', conferma, annulla = 'Annulla', distruttiva = true }) {
  return new Promise(risolvi => {
    const s = $('#scelte');
    s.innerHTML = `<div class="scelte-pannello">
      <div class="scelte-gruppo">
        ${titolo || messaggio ? `<div class="scelte-messaggio">${titolo ? `<b>${esc(titolo)}</b>` : ''}${esc(messaggio)}</div>` : ''}
        <button type="button" class="${distruttiva ? 'distruttiva' : ''}" data-r="1">${esc(conferma)}</button>
      </div>
      <button type="button" class="annulla" data-r="0">${esc(annulla)}</button>
    </div>`;
    s.hidden = false;
    void s.offsetWidth;
    s.classList.add('aperte');
    const chiudi = risposta => {
      s.classList.remove('aperte');
      setTimeout(() => { s.hidden = true; s.innerHTML = ''; }, 420);
      risolvi(risposta);
    };
    s.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) chiudi(b.dataset.r === '1');
      else if (e.target === s) chiudi(false);
    };
  });
}

/* =========================================================
   Navigazione: sezioni, titolo che si rimpicciolisce, pagine di dettaglio
   ========================================================= */

function collegaNav(pagina) {
  const nav = $('.nav', pagina);
  const titolo = $('.titolo-grande', pagina);
  const aggiorna = () => {
    if (!nav.offsetHeight) return;   // pagina nascosta: si ricalcola quando viene mostrata
    const soglia = titolo ? titolo.offsetTop + titolo.offsetHeight - nav.offsetHeight - 6 : 0;
    nav.classList.toggle('compatta', pagina.scrollTop > soglia);
  };
  pagina.addEventListener('scroll', aggiorna, { passive: true });
  aggiorna();
}

function mostraTab(tab) {
  const pagina = $(`#tab-${tab}`);
  if (ui.tab === tab && !pagina.hidden) {
    // Toccare la sezione già aperta: torna su (come su iPhone)
    if ($('#pila').children.length) svuotaPila();
    else pagina.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  svuotaPila(false);
  ui.tab = tab;
  $$('.schermo > .pagina').forEach(p => { p.hidden = p.dataset.tab !== tab; });
  $$('.capsula button').forEach(b => {
    const attivo = b.dataset.tab === tab;
    b.classList.toggle('attivo', attivo);
    b.setAttribute('aria-selected', attivo);
  });
  disegnaTab(tab);
  pagina.dispatchEvent(new Event('scroll'));
}

function disegnaTab(tab = ui.tab) {
  if (tab === 'giocate') renderGiocate();
  if (tab === 'statistiche') renderStatistiche();
  if (tab === 'impostazioni') renderImpostazioni();
}

function aggiornaTutto() {
  disegnaTab();
  aggiornaBadge();
}

/* Pagine che entrano da destra (dettagli delle statistiche) */
function apriPagina({ titolo, sottotitolo = '', indietro = 'Indietro', costruisci }) {
  const pila = $('#pila');
  const sotto = pila.lastElementChild || $(`#tab-${ui.tab}`);
  const p = document.createElement('section');
  p.className = 'pagina-spinta';
  p.innerHTML = `
    <header class="nav">
      <div class="nav-lato"><button type="button" class="indietro">${icona('indietro')}<span>${esc(indietro)}</span></button></div>
      <div class="nav-titolo">${esc(titolo)}</div><div class="nav-lato"></div>
    </header>
    <h1 class="titolo-grande">${esc(titolo)}</h1>
    ${sottotitolo ? `<p class="sottotitolo-grande">${esc(sottotitolo)}</p>` : ''}
    <div class="contenuto"></div>`;
  pila.appendChild(p);
  costruisci($('.contenuto', p));
  collegaNav(p);
  void p.offsetWidth;
  p.classList.add('dentro');
  sotto.classList.add('coperta');
  $('.indietro', p).onclick = () => chiudiPagina(p);
}

function chiudiPagina(p, animata = true) {
  const sotto = p.previousElementSibling || $(`#tab-${ui.tab}`);
  sotto.classList.remove('coperta');
  if (!animata) { p.remove(); return; }
  p.classList.remove('dentro');
  setTimeout(() => p.remove(), 460);
}

function svuotaPila(animata = true) {
  const pagine = $$('#pila > .pagina-spinta');
  pagine.slice(0, -1).forEach(p => p.remove());
  if (pagine.length) chiudiPagina(pagine[pagine.length - 1], animata);
  $$('.schermo > .pagina').forEach(p => p.classList.remove('coperta'));
}

/* =========================================================
   Sezione Giocate
   ========================================================= */

function disegnaControlliGiocate() {
  $('#controlli-giocate').innerHTML = segmentato('area', ['nba', 'calcio', 'divertimento'].map(a => [a, `${AREE[a]}<i class="punto-avviso" hidden></i>`]), ui.area);
}

/* Pallino arancione sulle sezioni che hanno giocate da completare */
function aggiornaPuntiArea(contenitore) {
  $$('.seg[data-seg="area"] button', contenitore).forEach(b => {
    const punto = $('.punto-avviso', b);
    if (punto) punto.hidden = !stato.giocate.some(g => areaDi(g) === b.dataset.val && daCompletare(g));
  });
}

function quando(g) {
  const giorno = g.data === oggiISO() ? 'Oggi' : g.data === ieriISO() ? 'Ieri' : g.data === domaniISO() ? 'Domani' : dataBreve(g.data);
  return g.orario ? `${giorno} ${g.orario}` : giorno;
}

function rigaGiocata(g) {
  const multi = g.selezioni.length > 1;
  const avatar = `<div class="avatar" style="--c: var(--${g.area})">${icona(g.area === 'nba' ? 'basket' : 'pallone')}</div>`;
  const s = g.selezioni[0];
  const cosa = multi ? g.selezioni.map(nomeSelezione).join(', ') : descrizioneSelezione(s);
  const puntata = `${euroAgile(g.importo)}${g.stake != null ? ` (${percento(g.stake)})` : ''}`;
  const parti = g.esito === 'attesa' ? [quando(g), cosa, puntata, quotaTesto(quotaEffettiva(g))] : [cosa, puntata, quotaTesto(quotaEffettiva(g))];
  let destra;
  if (g.esito === 'attesa') {
    destra = multi
      ? `<div class="riga-dx"><button type="button" class="capsula-tinta" data-az="segna">Segna</button></div>`
      : `<div class="riga-dx">
          <button type="button" class="tondo pos" data-az="vinta" aria-label="Segna come vinta">${icona('spunta')}</button>
          <button type="button" class="tondo neg" data-az="persa" aria-label="Segna come persa">${icona('croce')}</button>
        </div>`;
  } else {
    const n = netto(g);
    destra = `<div class="riga-dx colonna"><span class="importo testo-${segno(n)}">${euroSegno(n)}</span><span class="importo-nota">${ESITI[g.esito]}</span></div>`;
  }
  return `<div class="riga toccabile" data-id="${g.id}" role="button" tabindex="0">
    ${avatar}
    <div class="riga-testi">
      <div class="riga-titolo">${esc(multi ? `Multipla · ${g.selezioni.length}` : nomeSelezione(s))}</div>
      <div class="riga-sotto">${esc(parti.filter(Boolean).join(' · '))}</div>
    </div>
    ${destra}
  </div>`;
}

function gruppoGiocate(titolo, giocate, { classe = '', piede = '', destra = '' } = {}) {
  return `<section class="gruppo">
    <h2 class="intestazione ${classe}">${titolo}${destra}</h2>
    <div class="lista lista-giocate">${giocate.map(rigaGiocata).join('')}</div>
    ${piede ? `<p class="piede">${piede}</p>` : ''}
  </section>`;
}

function cartaRiepilogo(area) {
  const imp = stato.impostazioni;
  if (area === 'divertimento') {
    const m = metriche(stato.giocate.filter(g => g.divertimento));
    return `<section class="carta">
      <div class="carta-testa"><span class="eroe-etichetta">Guadagno</span><span class="carta-contesto">Fuori bilancio</span></div>
      <div class="cifra-eroe">${euroSegno(m.guadagno)}</div>
      <div class="eroe-delta">${m.chiuse.length ? `su ${euroAgile(m.puntato)} puntati · ${plurale(m.chiuse.length, 'giocata conclusa', 'giocate concluse')}` : 'Ancora nessuna giocata conclusa'}${m.aperte.length ? ` · ${euroAgile(m.inGioco)} in gioco` : ''}</div>
    </section>`;
  }
  const st = stagioneCorrente(area);
  const m = metriche(stato.giocate.filter(g => !g.divertimento && g.area === area && stagioneDi(g) === st));
  const obiettivo = area === 'nba' ? imp.obiettivoNba : imp.obiettivoCalcio;
  const barraObiettivo = `<div class="obiettivo">
    <div class="obiettivo-testa"><span>Obiettivo della stagione</span><span><b>${euroAgile(Math.max(0, arrot(m.guadagno)))}</b> di ${euroAgile(obiettivo)}</span></div>
    ${meter(m.guadagno / obiettivo, { classe: 'verde' })}
  </div>`;
  const inGioco = m.aperte.length ? ` · ${euroAgile(m.inGioco)} in gioco` : '';

  if (area === 'nba') {
    const perc = imp.base ? (m.guadagno / imp.base) * 100 : 0;
    return `<section class="carta">
      <div class="carta-testa"><span class="eroe-etichetta">Cassa</span><span class="carta-contesto">Stagione ${st}</span></div>
      <div class="cifra-eroe">${euro(imp.base + m.guadagno)}</div>
      <div class="eroe-delta">${m.chiuse.length
        ? `<b class="testo-${segno(m.guadagno)}">${euroSegno(m.guadagno)} (${percSegno(perc)})</b> sul bankroll di ${euroAgile(imp.base)}`
        : `Bankroll ${euroAgile(imp.base)} · ancora nessuna giocata conclusa`}</div>
      ${barraObiettivo}
    </section>`;
  }
  return `<section class="carta">
    <div class="carta-testa"><span class="eroe-etichetta">Guadagno</span><span class="carta-contesto">Stagione ${st}</span></div>
    <div class="cifra-eroe">${euroSegno(m.guadagno)}</div>
    <div class="eroe-delta">${m.chiuse.length ? `su ${euroAgile(m.puntato)} puntati · resa <b class="testo-${segno(m.resa || 0)}">${percSegno(m.resa)}</b>` : 'Ancora nessuna giocata conclusa'}${inGioco}</div>
    ${barraObiettivo}
  </section>`;
}

/* Quali giocate sono "da completare" in questo momento: serve per ridisegnare solo se cambia */
const firmaDaCompletare = () => stato.giocate.filter(daCompletare).map(g => g.id).join(',');
let firmaVista = '';

function renderGiocate() {
  firmaVista = firmaDaCompletare();
  // Se la sezione è stata cambiata dalle Statistiche, riallinea il selettore
  if ($('#controlli-giocate .seg button.attivo')?.dataset.val !== ui.area) disegnaControlliGiocate();
  aggiornaPuntiArea($('#controlli-giocate'));
  const area = ui.area;
  const gs = stato.giocate.filter(g => areaDi(g) === area);
  let html = cartaRiepilogo(area);

  if (!gs.length) {
    const nomeIcona = area === 'nba' ? 'basket' : area === 'calcio' ? 'pallone' : 'dado';
    html += vuoto(nomeIcona, 'Nessuna giocata', 'Tocca + per registrare la prima.');
  } else {
    const inAttesa = gs.filter(g => g.esito === 'attesa').sort(crescente);
    const daComp = inAttesa.filter(daCompletare);
    const aperte = inAttesa.filter(g => !daCompletare(g));
    const concluse = gs.filter(g => g.esito !== 'attesa').sort((a, b) => crescente(b, a));

    html += '<div style="height:12px"></div>';
    if (daComp.length) html += gruppoGiocate(`${icona('avviso')}Da completare`, daComp, { classe: 'avviso' });
    if (aperte.length) html += gruppoGiocate('In attesa', aperte);

    const perGiorno = new Map();
    concluse.slice(0, ui.limite).forEach(g => {
      if (!perGiorno.has(g.data)) perGiorno.set(g.data, []);
      perGiorno.get(g.data).push(g);
    });
    perGiorno.forEach((lista, data) => {
      const totale = somma(lista.map(netto));
      const destra = lista.length > 1 ? `<span class="a-destra testo-${segno(totale)}">${euroSegno(totale)}</span>` : '';
      html += gruppoGiocate(esc(giornoRelativo(data)), lista, { destra });
    });
    if (concluse.length > ui.limite) {
      html += `<button type="button" class="link mostra-altre" data-az="altre">Mostra altre ${concluse.length - ui.limite}</button>`;
    }
  }
  $('#corpo-giocate').innerHTML = html;
}

$('#controlli-giocate').addEventListener('click', e => {
  const b = e.target.closest('.seg[data-seg="area"] button');
  if (!b || b.dataset.val === ui.area) return;
  ui.area = b.dataset.val;
  ui.limite = 40;
  renderGiocate();
});

$('#corpo-giocate').addEventListener('click', e => {
  const az = e.target.closest('[data-az]');
  if (az?.dataset.az === 'altre') {
    ui.limite += 40;
    renderGiocate();
    return;
  }
  const riga = e.target.closest('.riga[data-id]');
  if (!riga) return;
  const g = trova(riga.dataset.id);
  if (!g) return;
  if (az && (az.dataset.az === 'vinta' || az.dataset.az === 'persa')) esitoRapido(g, az.dataset.az);
  else apriForm(g);
});

$('#corpo-giocate').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const riga = e.target.closest('.riga[data-id]');
  if (riga && e.target === riga) { e.preventDefault(); apriForm(trova(riga.dataset.id)); }
});

/* Vinta/persa con un tocco, con la possibilità di annullare */
function esitoRapido(g, esito) {
  const prima = JSON.stringify(g);
  impostaEsitoGiocata(g, esito);
  salva();
  aggiornaTutto();
  notifica(`${ESITI[esito]} · ${euroSegno(netto(g))}`, {
    icona: esito === 'vinta' ? 'spunta' : 'croce',
    tono: esito === 'vinta' ? 'testo-pos' : 'testo-neg',
    azione: 'Annulla',
    alAzione: () => {
      const i = stato.giocate.findIndex(x => x.id === g.id);
      if (i >= 0) stato.giocate[i] = JSON.parse(prima);
      salva();
      aggiornaTutto();
    },
  });
}

/* =========================================================
   Scheda: nuova / modifica giocata
   ========================================================= */

function nuovaSelezione(sport) {
  const u = stato.impostazioni.ultimi;
  return {
    sport, giocatore: '', partita: '', tipo: sport === 'nba' ? u.tipoNba : u.tipoCalcio,
    verso: 'over', linea: '', competizione: u.competizione, dettaglio: '', quota: '', esito: 'attesa',
  };
}

const quandoDi = iso => (iso === oggiISO() ? 'oggi' : iso === domaniISO() ? 'domani' : 'altra');

function bozzaDa(g) {
  const imp = stato.impostazioni;
  return {
    id: g.id, creata: g.creata, area: g.area, divertimento: g.divertimento, fase: g.fase || faseAuto(g.data),
    data: g.data, quando: quandoDi(g.data), orario: g.orario || '', fiducia: g.fiducia ?? null, note: g.note || '',
    selezioni: g.selezioni.map(s => ({
      ...nuovaSelezione(s.sport), ...s,
      quota: decimale(s.quota), linea: s.linea != null ? decimale(s.linea) : '',
    })),
    quotaTot: g.quotaManuale ? decimale(g.quota) : '',
    stake: g.stake != null ? decimale(g.stake) : imp.ultimi.stake,
    base: g.base ?? imp.base,
    importo: decimale(g.importo),
    esito: g.esito,
    incasso: g.incasso != null ? decimale(g.incasso) : '',
  };
}

function bozzaNuova() {
  const imp = stato.impostazioni;
  const u = imp.ultimi;
  const area = ui.area === 'divertimento' ? u.area : ui.area;
  const data = oggiISO();
  return {
    id: null, creata: null, area, divertimento: ui.area === 'divertimento', fase: faseAuto(data),
    data, quando: 'oggi', orario: '', fiducia: null, note: '',
    selezioni: [nuovaSelezione(area)],
    quotaTot: '', stake: u.stake, base: imp.base, importo: u.importo, esito: 'attesa', incasso: '',
  };
}

const usaStake = b => b.area === 'nba' && !b.divertimento;

function quotaAuto(b) {
  const q = b.selezioni.map(s => numero(s.quota));
  return q.every(x => x && x > 1) ? q.reduce((a, x) => a * x, 1) : null;
}

function importoBozza(b) {
  if (usaStake(b)) {
    const st = numero(b.stake);
    return st ? arrot((b.base * st) / 100) : null;
  }
  return numero(b.importo);
}

function erroriBozza(b) {
  const multi = b.selezioni.length > 1;
  const errori = [];
  b.selezioni.forEach((s, i) => {
    const dove = multi ? ` (selezione ${i + 1})` : '';
    if (s.sport === 'nba' && !s.giocatore.trim()) errori.push(`Manca il giocatore${dove}`);
    if (s.sport === 'calcio' && !s.partita.trim()) errori.push(`Manca la partita${dove}`);
    const q = numero(s.quota);
    if (!q || q <= 1) errori.push(`Manca la quota${dove}`);
  });
  const importo = importoBozza(b);
  if (!importo || importo <= 0) errori.push(usaStake(b) ? 'Manca lo stake' : "Manca l'importo");
  if (b.esito === 'cashout' && numero(b.incasso) == null) errori.push("Manca l'importo del cashout");
  if (!b.data) errori.push('Manca la data');
  return errori;
}

/* Dalla bozza alla giocata da salvare */
function costruisciGiocata(b) {
  const multi = b.selezioni.length > 1;
  const quotaManuale = numero(b.quotaTot);
  const selezioni = b.selezioni.map(s => {
    const comune = { sport: s.sport, partita: s.partita.trim(), tipo: s.tipo, quota: numero(s.quota), esito: s.esito || 'attesa' };
    return s.sport === 'nba'
      ? { ...comune, giocatore: s.giocatore.trim(), verso: s.verso, linea: numero(s.linea) }
      : { ...comune, competizione: s.competizione, dettaglio: s.dettaglio.trim() };
  });
  const g = {
    id: b.id || nuovoId(),
    creata: b.creata || new Date().toISOString(),
    area: b.area,
    divertimento: b.divertimento,
    fase: b.area === 'nba' ? b.fase : null,
    data: b.data,
    orario: b.orario || '',
    fiducia: b.fiducia,
    note: b.note.trim(),
    selezioni,
    quota: multi && quotaManuale > 1 ? quotaManuale : quotaAuto(b),
    quotaManuale: multi && quotaManuale > 1,
    stake: usaStake(b) ? numero(b.stake) : null,
    base: usaStake(b) ? b.base : null,
    importo: importoBozza(b),
    esito: b.esito,
    incasso: b.esito === 'cashout' ? numero(b.incasso) : null,
  };
  if (multi) { if (g.esito !== 'cashout') g.esito = esitoDaSelezioni(g); }
  else impostaEsitoGiocata(g, g.esito);
  return g;
}

/* ---------- Sezioni della scheda ---------- */

function sezioneEsito() {
  const b = bozza;
  const incasso = b.esito === 'cashout'
    ? `<div class="f-riga"><span class="f-etichetta">Incassato</span><input class="campo-riga campo-dx" data-campo="incasso" inputmode="decimal" placeholder="0,00 €" value="${esc(b.incasso)}"></div>`
    : '';
  if (b.selezioni.length > 1) {
    const righe = b.selezioni.map((s, i) => `
      <div class="f-riga riga-esito-sel">
        <div class="riga-testi"><div class="riga-titolo">${esc(nomeSelezione(s) || `Selezione ${i + 1}`)}</div><div class="riga-sotto">${esc(descrizioneSelezione(s))}</div></div>
        ${segmentato('esitoSel', [['attesa', icona('trattino'), 'In attesa'], ['vinta', icona('spunta'), 'Vinta'], ['persa', icona('croce'), 'Persa'], ['annullata', icona('barrato'), 'Annullata']], s.esito, { classe: 'seg-piccolo', sel: i })}
      </div>`).join('');
    return `<section class="f-gruppo" data-sezione="esito">
      <h3 class="intestazione">Esito</h3>
      <div class="f-lista">${righe}
        <div class="f-riga"><span class="f-etichetta">Chiusa con cashout</span>${interruttore('cashout', b.esito === 'cashout', 'Chiusa con cashout')}</div>
        ${incasso}
      </div>
      <p class="piede" id="f-risultato">Segna ogni selezione: l’esito della multipla si calcola da solo.</p>
    </section>`;
  }
  return `<section class="f-gruppo" data-sezione="esito">
    <h3 class="intestazione">Esito</h3>
    <div class="f-lista">
      <div class="f-riga blocco">${segmentato('esito', [['attesa', 'Attesa'], ['vinta', 'Vinta'], ['persa', 'Persa'], ['rimborsata', 'Rimborso'], ['cashout', 'Cashout']], b.esito)}</div>
      ${incasso}
    </div>
    <p class="piede" id="f-risultato"></p>
  </section>`;
}

function sezioneTipo() {
  const b = bozza;
  return `<section class="f-gruppo" data-sezione="tipo">
    <div class="f-lista">
      <div class="f-riga blocco">${segmentato('area', [['nba', 'NBA'], ['calcio', 'Calcio']], b.area)}</div>
      <div class="f-riga"><span class="f-etichetta">Gambolata</span>${interruttore('divertimento', b.divertimento, 'Gambolata')}</div>
    </div>
    <p class="piede">Le gambolate hanno statistiche a parte e non toccano la cassa.</p>
  </section>`;
}

function sezioneSelezione(s, i) {
  const multi = bozza.selezioni.length > 1;
  const attr = `data-sel="${i}"`;
  const testa = multi
    ? `<h3 class="intestazione">Selezione ${i + 1}<button type="button" class="link link-rosso a-destra" data-az="rimuovi" ${attr}>Rimuovi</button></h3>`
    : '<h3 class="intestazione">Giocata</h3>';
  const sport = multi ? `<div class="f-riga blocco">${segmentato('sport', [['nba', 'NBA'], ['calcio', 'Calcio']], s.sport, { classe: 'seg-piccolo', sel: i })}</div>` : '';
  const campi = s.sport === 'nba'
    ? `<div class="f-riga"><input class="campo-riga" data-campo="giocatore" ${attr} list="lista-giocatori" placeholder="Giocatore" value="${esc(s.giocatore)}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></div>
       <div class="f-riga blocco"><div class="chips">${TIPI_NBA.map(t => chip('tipo', t, t, t === s.tipo, i)).join('')}</div></div>
       <div class="f-riga">${segmentato('verso', [['over', 'Over'], ['under', 'Under']], s.verso, { classe: 'seg-piccolo stretto', sel: i })}
         <input class="campo-riga campo-dx" data-campo="linea" ${attr} inputmode="decimal" placeholder="Linea, es. 25,5" value="${esc(s.linea)}"></div>
       <div class="f-riga"><input class="campo-riga" data-campo="partita" ${attr} list="lista-partite" placeholder="Partita (facoltativa)" value="${esc(s.partita)}" autocomplete="off" autocapitalize="words"></div>`
    : `<div class="f-riga"><input class="campo-riga" data-campo="partita" ${attr} list="lista-partite" placeholder="Partita, es. Inter - Milan" value="${esc(s.partita)}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></div>
       <div class="f-riga blocco">${segmentato('competizione', Object.entries(COMPETIZIONI), s.competizione, { sel: i })}</div>
       <div class="f-riga blocco"><div class="chips">${TIPI_CALCIO.map(t => chip('tipo', t, t, t === s.tipo, i)).join('')}</div></div>
       <div class="f-riga"><input class="campo-riga" data-campo="dettaglio" ${attr} placeholder="Dettaglio, es. 2,5 (facoltativo)" value="${esc(s.dettaglio)}" autocomplete="off"></div>`;
  return `<section class="f-gruppo" data-sezione="sel-${i}">
    ${testa}
    <div class="f-lista">
      ${sport}${campi}
      <div class="f-riga"><span class="f-etichetta">Quota</span><input class="campo-riga campo-dx" data-campo="quota" ${attr} inputmode="decimal" placeholder="1,85" value="${esc(s.quota)}"></div>
    </div>
  </section>`;
}

function sezioneAggiungi() {
  return `<section class="f-gruppo" data-sezione="aggiungi">
    <div class="f-lista"><button type="button" class="riga riga-azione toccabile" data-az="aggiungi">${icona('piu')}<span>Aggiungi selezione</span></button></div>
    ${bozza.selezioni.length === 1 ? '<p class="piede">Per una multipla aggiungi le altre partite.</p>' : ''}
  </section>`;
}

function sezionePuntata() {
  const b = bozza;
  const imp = stato.impostazioni;
  const multi = b.selezioni.length > 1;
  let scelta;
  if (usaStake(b)) {
    const rapido = imp.stakeRapidi.some(n => n === numero(b.stake));
    scelta = `<div class="f-riga blocco"><div class="chips">
        ${imp.stakeRapidi.map(n => chip('stake', n, percento(n), n === numero(b.stake))).join('')}
        <input class="chip-campo" data-campo="stake" inputmode="decimal" placeholder="Altro" value="${rapido ? '' : esc(b.stake)}" aria-label="Altro stake in percentuale">
      </div></div>
      <div class="f-riga"><span class="f-etichetta">Importo</span><span class="f-valore" id="f-importo">–</span></div>`;
  } else {
    const rapido = imp.importiRapidi.some(n => n === numero(b.importo));
    scelta = `<div class="f-riga blocco"><div class="chips">
        ${imp.importiRapidi.map(n => chip('importo', n, euroAgile(n), n === numero(b.importo))).join('')}
        <input class="chip-campo" data-campo="importo" inputmode="decimal" placeholder="Altro" value="${rapido ? '' : esc(b.importo)}" aria-label="Altro importo in euro">
      </div></div>`;
  }
  const note = [
    usaStake(b) ? `Lo stake si calcola sul bankroll di ${euroAgile(b.base)}.` : '',
    multi ? 'Lascia vuota la quota totale per moltiplicare le quote; scrivila se il bookmaker la arrotonda o la maggiora.' : '',
  ].filter(Boolean).join(' ');
  return `<section class="f-gruppo" data-sezione="puntata">
    <h3 class="intestazione">Puntata</h3>
    <div class="f-lista">
      ${scelta}
      ${multi ? `<div class="f-riga"><span class="f-etichetta">Quota totale</span><input class="campo-riga campo-dx" data-campo="quotaTot" inputmode="decimal" value="${esc(b.quotaTot)}"></div>` : ''}
      <div class="f-riga"><span class="f-etichetta">Vincita possibile</span><span class="f-valore" id="f-vincita">–</span></div>
    </div>
    ${note ? `<p class="piede">${note}</p>` : ''}
  </section>`;
}

function sezionePartita() {
  const b = bozza;
  return `<section class="f-gruppo" data-sezione="partita">
    <h3 class="intestazione">Partita</h3>
    <div class="f-lista">
      <div class="f-riga"><span class="f-etichetta">Data</span>${segmentato('quando', [['oggi', 'Oggi'], ['domani', 'Domani'], ['altra', 'Altra']], b.quando, { classe: 'seg-piccolo' })}</div>
      ${b.quando === 'altra' ? `<div class="f-riga"><span class="f-etichetta">Giorno</span><input type="date" class="pillola" data-campo="data" value="${esc(b.data)}" style="margin-left:auto"></div>` : ''}
      <div class="f-riga"><span class="f-etichetta">Ora</span><input type="time" class="pillola" data-campo="orario" value="${esc(b.orario)}" style="margin-left:auto" aria-label="Ora della partita (facoltativa)"></div>
      ${b.area === 'nba' ? `<div class="f-riga blocco">${segmentato('fase', [['regular', 'Regular season'], ['playoff', 'Playoff']], b.fase)}</div>` : ''}
    </div>
    <p class="piede">L’ora è facoltativa: serve a capire quando la partita è finita. Una partita alle 2 di notte di martedì va segnata martedì.</p>
  </section>`;
}

function sezioneAltro() {
  const b = bozza;
  return `<section class="f-gruppo" data-sezione="altro">
    <h3 class="intestazione">Facoltativo</h3>
    <div class="f-lista">
      <div class="f-riga"><span class="f-etichetta">Fiducia</span>
        <div class="fiducia" role="group" aria-label="Fiducia da 1 a 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-az="fiducia" data-val="${n}" class="${b.fiducia >= n ? 'pieno' : ''}" aria-label="${n} su 5" aria-pressed="${b.fiducia === n}"><i></i></button>`).join('')}</div>
      </div>
      <div class="f-riga"><textarea class="campo-riga" data-campo="note" rows="2" placeholder="Note">${esc(b.note)}</textarea></div>
    </div>
  </section>`;
}

function valoriUsati(campo) {
  const set = new Set();
  stato.giocate.forEach(g => g.selezioni.forEach(s => s[campo] && set.add(s[campo])));
  return [...set].sort((a, c) => a.localeCompare(c, 'it'));
}

/* Ridisegna la scheda. I segmenti e gli interruttori che cambiano
   partono dalla posizione precedente, così il movimento resta fluido. */
function disegnaForm() {
  const corpo = $('#foglio .foglio-corpo');
  const chiave = el => `${el.dataset.seg || el.dataset.campo}|${el.dataset.sel ?? ''}`;
  const segPrima = new Map($$('.seg', corpo).map(s => [chiave(s), s.dataset.i]));
  const intPrima = new Map($$('input[type="checkbox"]', corpo).map(c => [chiave(c), c.dataset.stato]));
  const scroll = corpo.scrollTop;

  const b = bozza;
  corpo.innerHTML = [
    b.id ? sezioneEsito() : '',
    sezioneTipo(),
    ...b.selezioni.map((s, i) => sezioneSelezione(s, i)),
    sezioneAggiungi(),
    sezionePuntata(),
    sezionePartita(),
    sezioneAltro(),
    b.id ? `<section class="f-gruppo"><div class="f-lista"><button type="button" class="riga riga-distruttiva toccabile" data-az="elimina">Elimina giocata</button></div></section>` : '',
    `<datalist id="lista-giocatori">${valoriUsati('giocatore').map(v => `<option value="${esc(v)}">`).join('')}</datalist>`,
    `<datalist id="lista-partite">${valoriUsati('partita').map(v => `<option value="${esc(v)}">`).join('')}</datalist>`,
  ].join('');
  corpo.scrollTop = scroll;

  const daAnimare = [];
  $$('.seg', corpo).forEach(s => {
    const prima = segPrima.get(chiave(s));
    if (prima != null && prima !== s.dataset.i) { s.style.setProperty('--i', prima); daAnimare.push(() => s.style.setProperty('--i', s.dataset.i)); }
  });
  $$('input[type="checkbox"]', corpo).forEach(c => {
    const prima = intPrima.get(chiave(c));
    if (prima != null && prima !== c.dataset.stato) { c.checked = prima === '1'; daAnimare.push(() => { c.checked = c.dataset.stato === '1'; }); }
  });
  if (daAnimare.length) { void corpo.offsetWidth; daAnimare.forEach(f => f()); }
  aggiornaDerivati();
}

/* Aggiorna importi, vincita e pulsante "Aggiungi" senza ridisegnare (la tastiera resta aperta) */
function aggiornaDerivati() {
  const b = bozza;
  if (!b) return;
  const f = $('#foglio');
  const auto = quotaAuto(b);
  const qt = $('[data-campo="quotaTot"]', f);
  if (qt) qt.placeholder = auto ? `${quotaTesto(auto)} (automatica)` : 'Automatica';
  const importo = importoBozza(b);
  const quota = numero(b.quotaTot) > 1 ? numero(b.quotaTot) : auto;
  const campoImporto = $('#f-importo', f);
  if (campoImporto) campoImporto.textContent = importo ? euro(importo) : '–';
  const vincita = $('#f-vincita', f);
  if (vincita) vincita.textContent = importo && quota ? euro(importo * quota) : '–';
  $$('[data-chip="stake"]', f).forEach(c => c.classList.toggle('attivo', numero(c.dataset.val) === numero(b.stake)));
  $$('[data-chip="importo"]', f).forEach(c => c.classList.toggle('attivo', numero(c.dataset.val) === numero(b.importo)));

  const errori = erroriBozza(b);
  const risultato = $('#f-risultato', f);
  if (risultato && b.selezioni.length === 1) {
    const n = errori.length ? null : netto(costruisciGiocata(b));
    risultato.textContent = b.esito === 'attesa' || n == null ? '' : `Risultato: ${euroSegno(n)}`;
  }
  $('[data-az="salva"]', f).setAttribute('aria-disabled', errori.length ? 'true' : 'false');
}

function apriForm(g) {
  bozza = g ? bozzaDa(g) : bozzaNuova();
  bozzaIniziale = JSON.stringify(bozza);
  const f = $('#foglio');
  f.innerHTML = `
    <div class="foglio-testa">
      <div class="maniglia"></div>
      <div class="foglio-nav">
        <button type="button" class="nav-testo" data-az="annulla">Annulla</button>
        <h2 id="foglio-titolo">${g ? 'Giocata' : 'Nuova giocata'}</h2>
        <button type="button" class="nav-testo forte" data-az="salva">${g ? 'Fine' : 'Aggiungi'}</button>
      </div>
    </div>
    <div class="foglio-corpo"></div>`;
  disegnaForm();
  f.hidden = false;
  void f.offsetWidth;
  f.classList.add('aperto');
  $('#velo').classList.add('visibile');
  $('#schermo').classList.add('arretrato');
  collegaTrascinamento();
}

function chiudiForm() {
  const f = $('#foglio');
  document.activeElement?.blur();
  f.classList.remove('aperto');
  f.style.transform = '';
  $('#velo').classList.remove('visibile');
  $('#schermo').classList.remove('arretrato');
  bozza = null;
  setTimeout(() => { if (!bozza) { f.hidden = true; f.innerHTML = ''; } }, 520);
}

async function annullaForm() {
  if (bozza && JSON.stringify(bozza) !== bozzaIniziale) {
    const ok = await chiedi({ messaggio: 'Le modifiche non sono state salvate.', conferma: 'Annulla le modifiche', annulla: 'Continua a modificare' });
    if (!ok) return;
  }
  chiudiForm();
}

/* Trascinare la scheda verso il basso per chiuderla */
function collegaTrascinamento() {
  const f = $('#foglio');
  const testa = $('.foglio-testa', f);
  let inizio = null;
  let dy = 0;
  let t0 = 0;
  testa.onpointerdown = e => {
    if (e.target.closest('button')) return;
    inizio = e.clientY;
    dy = 0;
    t0 = performance.now();
    f.classList.add('trascina');
    testa.setPointerCapture(e.pointerId);
  };
  testa.onpointermove = e => {
    if (inizio == null) return;
    dy = Math.max(0, e.clientY - inizio);
    f.style.transform = `translateY(${dy}px)`;
  };
  testa.onpointerup = testa.onpointercancel = () => {
    if (inizio == null) return;
    inizio = null;
    f.classList.remove('trascina');
    f.style.transform = '';
    const veloce = dy / Math.max(1, performance.now() - t0) > 0.5;
    if (dy > 140 || (veloce && dy > 40)) annullaForm();
  };
}

$('#velo').addEventListener('click', () => { if (bozza) annullaForm(); });

function impostaSeg(campo, val, sel) {
  const b = bozza;
  const s = sel != null ? b.selezioni[Number(sel)] : null;
  switch (campo) {
    case 'area':
      if (b.area === val) return;
      b.area = val;
      if (b.selezioni.length === 1) {
        const v = b.selezioni[0];
        b.selezioni[0] = { ...nuovaSelezione(val), quota: v.quota, partita: v.partita, esito: v.esito };
      }
      if (val === 'nba') b.fase = faseAuto(b.data);
      disegnaForm();
      break;
    case 'sport':
      if (s.sport === val) return;
      b.selezioni[Number(sel)] = { ...nuovaSelezione(val), quota: s.quota, partita: s.partita, esito: s.esito };
      disegnaForm();
      break;
    case 'verso':
    case 'competizione':
      s[campo] = val;
      aggiornaDerivati();
      break;
    case 'esitoSel':
      s.esito = val;
      if (b.esito !== 'cashout') b.esito = esitoDaSelezioni(b);
      aggiornaDerivati();
      break;
    case 'esito': {
      const prima = b.esito;
      b.esito = val;
      if (val === 'cashout' || prima === 'cashout') disegnaForm();
      else aggiornaDerivati();
      break;
    }
    case 'fase':
      b.fase = val;
      break;
    case 'quando':
      b.quando = val;
      if (val === 'oggi') b.data = oggiISO();
      if (val === 'domani') b.data = domaniISO();
      if (b.area === 'nba') b.fase = faseAuto(b.data);
      disegnaForm();
      break;
  }
}

$('#foglio').addEventListener('click', async e => {
  if (!bozza) return;
  const b = bozza;
  const bSeg = e.target.closest('.seg button');
  if (bSeg) {
    const seg = bSeg.closest('.seg');
    impostaSeg(seg.dataset.seg, bSeg.dataset.val, seg.dataset.sel ?? null);
    return;
  }
  const c = e.target.closest('[data-chip]');
  if (c) {
    const nome = c.dataset.chip;
    if (nome === 'tipo') {
      b.selezioni[Number(c.dataset.sel)].tipo = c.dataset.val;
      $$(`[data-chip="tipo"][data-sel="${c.dataset.sel}"]`, c.parentElement).forEach(x => x.classList.toggle('attivo', x === c));
    } else {
      b[nome] = c.dataset.val;
      const campo = $(`[data-campo="${nome}"]`, $('#foglio'));
      if (campo) campo.value = '';
    }
    aggiornaDerivati();
    return;
  }
  const az = e.target.closest('[data-az]');
  if (!az) return;
  switch (az.dataset.az) {
    case 'annulla':
      annullaForm();
      break;
    case 'salva':
      salvaBozza();
      break;
    case 'aggiungi': {
      b.selezioni.push(nuovaSelezione(b.area));
      disegnaForm();
      const sezioni = $$('#foglio [data-sezione^="sel-"]');
      const ultima = sezioni[sezioni.length - 1];
      ultima?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
    case 'rimuovi':
      b.selezioni.splice(Number(az.dataset.sel), 1);
      if (b.selezioni.length === 1 && b.esito !== 'cashout') {
        const e1 = b.selezioni[0].esito;
        b.esito = e1 === 'annullata' ? 'rimborsata' : e1;
      }
      disegnaForm();
      break;
    case 'fiducia': {
      const n = Number(az.dataset.val);
      b.fiducia = b.fiducia === n ? null : n;
      $$('[data-az="fiducia"]', az.parentElement).forEach(x => {
        const v = Number(x.dataset.val);
        x.classList.toggle('pieno', b.fiducia != null && v <= b.fiducia);
        x.setAttribute('aria-pressed', b.fiducia === v);
      });
      break;
    }
    case 'elimina': {
      const ok = await chiedi({ messaggio: 'La giocata verrà eliminata e non sarà più nelle statistiche.', conferma: 'Elimina giocata' });
      if (!ok || !bozza) return;
      stato.giocate = stato.giocate.filter(g => g.id !== b.id);
      salva();
      chiudiForm();
      aggiornaTutto();
      notifica('Giocata eliminata', { icona: 'spunta' });
      break;
    }
  }
});

$('#foglio').addEventListener('input', e => {
  const el = e.target;
  const campo = el.dataset.campo;
  if (!bozza || !campo || el.type === 'checkbox' || el.type === 'date') return;
  if (el.dataset.sel != null) bozza.selezioni[Number(el.dataset.sel)][campo] = el.value;
  else bozza[campo] = el.value;
  aggiornaDerivati();
});

$('#foglio').addEventListener('change', e => {
  const el = e.target;
  if (!bozza) return;
  if (el.dataset.campo === 'divertimento') {
    bozza.divertimento = el.checked;
    disegnaForm();
  } else if (el.dataset.campo === 'cashout') {
    bozza.esito = el.checked ? 'cashout' : esitoDaSelezioni(bozza);
    disegnaForm();
  } else if (el.dataset.campo === 'data' && el.value) {
    bozza.data = el.value;
    if (bozza.area === 'nba') bozza.fase = faseAuto(el.value);
    disegnaForm();
  }
});

function salvaBozza() {
  const b = bozza;
  const errori = erroriBozza(b);
  if (errori.length) {
    notifica(errori[0], { icona: 'avviso', tono: 'testo-avviso' });
    return;
  }
  const g = costruisciGiocata(b);
  const i = stato.giocate.findIndex(x => x.id === g.id);
  if (i >= 0) stato.giocate[i] = g;
  else stato.giocate.push(g);

  // Ricorda le ultime scelte per velocizzare il prossimo inserimento
  const u = stato.impostazioni.ultimi;
  const ultima = g.selezioni[g.selezioni.length - 1];
  u.area = g.area;
  if (g.stake != null) u.stake = decimale(g.stake);
  else if (!g.divertimento) u.importo = decimale(g.importo);
  if (ultima.sport === 'nba') u.tipoNba = ultima.tipo;
  else { u.tipoCalcio = ultima.tipo; u.competizione = ultima.competizione; }

  const nuova = !b.id;
  salva();
  chiudiForm();
  // Mostra la sezione in cui è finita la giocata
  if (nuova) { ui.area = areaDi(g); if (ui.tab === 'giocate') disegnaControlliGiocate(); }
  aggiornaTutto();
  notifica(nuova ? 'Giocata aggiunta' : 'Modifiche salvate');
}

/* =========================================================
   Impostazioni
   ========================================================= */

function giorniDalBackup() {
  const ultimo = stato.impostazioni.ultimoBackup;
  return ultimo ? Math.floor((Date.now() - new Date(ultimo)) / 86400000) : null;
}
const backupDaFare = () => stato.giocate.length > 0 && (giorniDalBackup() == null || giorniDalBackup() > 30);

function aggiornaBadge() {
  $('.capsula [data-tab="impostazioni"] .badge').hidden = !backupDaFare();
}

function rigaCampo(chiave, etichetta, valore, unita, tastiera = 'decimal') {
  return `<label class="riga riga-campo">
    <span class="riga-testi">${etichetta}</span>
    <input class="campo-riga campo-dx" data-imp="${chiave}" inputmode="${tastiera}" enterkeyhint="done" value="${esc(valore)}" aria-label="${esc(etichetta)}">
    <span class="unita">${unita}</span>
  </label>`;
}

function renderImpostazioni() {
  const imp = stato.impostazioni;
  const giorni = giorniDalBackup();
  const quandoBackup = giorni == null ? 'mai' : giorni === 0 ? 'oggi' : giorni === 1 ? 'ieri' : `${giorni} giorni fa`;
  const storico = imp.storicoBase.slice().reverse();
  const lista = arr => arr.map(decimale).join(' ');

  $('#corpo-impostazioni').innerHTML = `
    <section class="gruppo">
      <h2 class="intestazione">Aspetto</h2>
      <div class="lista"><div class="riga">${segmentato('tema', [['auto', 'Automatico'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']], imp.tema)}</div></div>
      <p class="piede">Automatico segue l’impostazione dell’iPhone.</p>
    </section>

    <section class="gruppo">
      <h2 class="intestazione">NBA</h2>
      <div class="lista">
        ${rigaCampo('base', 'Bankroll', decimale(imp.base), '€')}
        ${rigaCampo('obiettivoNba', 'Obiettivo stagione', decimale(imp.obiettivoNba), '€')}
        ${rigaCampo('stakeRapidi', 'Stake rapidi', lista(imp.stakeRapidi), '%', 'text')}
      </div>
      <p class="piede">Lo stake si calcola sul bankroll: 15% di 200&nbsp;€ = 30&nbsp;€. Se lo cambi, vale dalle giocate successive. A ogni nuova stagione (1° ottobre) la cassa riparte da qui. Gli stake rapidi si separano con uno spazio.</p>
    </section>

    ${storico.length ? `<section class="gruppo">
      <h2 class="intestazione">Cambi del bankroll</h2>
      <div class="lista">${storico.map(s => `<div class="riga"><span class="riga-testi">${new Date(s.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span class="riga-valore">${euroAgile(s.da)} → ${euroAgile(s.a)}</span></div>`).join('')}</div>
    </section>` : ''}

    <section class="gruppo">
      <h2 class="intestazione">Calcio</h2>
      <div class="lista">
        ${rigaCampo('obiettivoCalcio', 'Obiettivo stagione', decimale(imp.obiettivoCalcio), '€')}
        ${rigaCampo('importiRapidi', 'Importi rapidi', lista(imp.importiRapidi), '€', 'text')}
      </div>
    </section>

    <section class="gruppo">
      <h2 class="intestazione">Backup</h2>
      <div class="lista" style="--rientro:57px">
        ${backupDaFare() ? `<div class="riga"><span class="icona-tessera" style="--c:var(--arancio)">${icona('avviso')}</span><span class="riga-testi">Backup da fare</span><span class="riga-valore">${quandoBackup}</span></div>` : ''}
        <button type="button" class="riga toccabile riga-azione" data-az="esporta"><span class="icona-tessera" style="--c:var(--blu)">${icona('esporta')}</span><span class="riga-testi">Esporta backup</span></button>
        <button type="button" class="riga toccabile riga-azione" data-az="importa"><span class="icona-tessera" style="--c:var(--teal)">${icona('importa')}</span><span class="riga-testi">Importa backup</span></button>
      </div>
      <p class="piede">Ultimo backup: ${quandoBackup}. Le giocate sono salvate solo su questo iPhone: esporta un backup ogni tanto, per esempio su iCloud Drive.</p>
      <input type="file" id="file-backup" accept="application/json,.json" hidden>
    </section>

    <p class="piede" style="margin-top:26px">Sull’iPhone apri sempre l’app dall’icona nella schermata Home: le giocate salvate lì sono separate da quelle di Safari.</p>
    <p class="piede" style="text-align:center;margin-top:20px">Registro scommesse · versione <span id="versione-app">…</span></p>`;
  mostraVersione();
}

const listaNumeri = testo => testo.split(/[\s;]+/).map(numero).filter(n => n && n > 0).sort((a, b) => a - b);

$('#corpo-impostazioni').addEventListener('click', e => {
  const bTema = e.target.closest('.seg[data-seg="tema"] button');
  if (bTema) {
    if (stato.impostazioni.tema === bTema.dataset.val) return;
    stato.impostazioni.tema = bTema.dataset.val;
    salva();
    applicaTema();
    // Sull'iPhone la barra in alto si ricolora solo ricaricando: dopo il movimento del selettore
    if (appSchermataHome) setTimeout(ricaricaQui, 380);
    return;
  }
  const az = e.target.closest('[data-az]');
  if (az?.dataset.az === 'esporta') esportaBackup();
  if (az?.dataset.az === 'importa') $('#file-backup').click();
});

$('#corpo-impostazioni').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset.imp) e.target.blur();
});

$('#corpo-impostazioni').addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'file-backup') { leggiBackup(el); return; }
  const k = el.dataset.imp;
  if (!k) return;
  const imp = stato.impostazioni;
  if (k === 'stakeRapidi' || k === 'importiRapidi') {
    const valori = listaNumeri(el.value);
    if (!valori.length) { notifica('Valori non validi', { icona: 'avviso', tono: 'testo-avviso' }); renderImpostazioni(); return; }
    imp[k] = valori;
  } else {
    const n = numero(el.value);
    if (!(n > 0)) { notifica('Cifra non valida', { icona: 'avviso', tono: 'testo-avviso' }); renderImpostazioni(); return; }
    if (k === 'base' && n !== imp.base) {
      imp.storicoBase.push({ data: new Date().toISOString(), da: imp.base, a: n });
      notifica(`Bankroll: ${euroAgile(n)}`);
    }
    imp[k] = n;
  }
  salva();
  renderImpostazioni();
});

/* Una giocata importata è valida solo se ha tutto quello che serve per disegnarla e contarla */
const numeroPositivo = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
function giocataValida(g) {
  return !!g && typeof g === 'object' && typeof g.id === 'string'
    && (g.area === 'nba' || g.area === 'calcio')
    && typeof g.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.data)
    && numeroPositivo(g.importo) && numeroPositivo(g.quota) && g.esito in ESITI
    && Array.isArray(g.selezioni) && g.selezioni.length > 0
    && g.selezioni.every(x => x && (x.sport === 'nba' || x.sport === 'calcio') && numeroPositivo(x.quota));
}

async function leggiBackup(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  let dati;
  try {
    dati = JSON.parse(await file.text());
    if (!Array.isArray(dati.giocate)) throw new Error('formato');
  } catch {
    notifica('Il file non è un backup valido', { icona: 'avviso', tono: 'testo-avviso' });
    return;
  }
  const valide = dati.giocate.filter(giocataValida);
  const scartate = dati.giocate.length - valide.length;
  if (!valide.length && dati.giocate.length) {
    notifica('Nel file non ci sono giocate leggibili', { icona: 'avviso', tono: 'testo-avviso' });
    return;
  }
  const ok = await chiedi({
    titolo: `Il backup contiene ${plurale(valide.length, 'giocata', 'giocate')}`,
    messaggio: `${scartate ? `${plurale(scartate, 'giocata incompleta verrà scartata', 'giocate incomplete verranno scartate')}. ` : ''}Sostituisce tutte quelle attuali (${stato.giocate.length}).`,
    conferma: 'Sostituisci tutto',
  });
  if (!ok) return;
  const imp = dati.impostazioni && typeof dati.impostazioni === 'object' ? dati.impostazioni : {};
  stato = {
    versione: 1,
    giocate: valide,
    impostazioni: { ...PREDEFINITE, ...imp, ultimi: { ...PREDEFINITE.ultimi, ...(imp.ultimi || {}) } },
  };
  salva();
  applicaTema();
  aggiornaTutto();
  notifica('Backup importato');
}

/* iPhone, iPad (che si presenta come Mac ma ha il touch) o Android */
const suTelefono = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function scaricaFile(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Sul telefono si usa "Condividi" (→ Salva su File / iCloud Drive).
   Sul computer, o se "Condividi" non va, il file si scarica e basta. */
async function esportaBackup() {
  const testo = JSON.stringify({ ...stato, esportato: new Date().toISOString() }, null, 2);
  const file = new File([testo], `registro-scommesse-${oggiISO()}.json`, { type: 'application/json' });
  let condiviso = false;
  if (suTelefono() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup registro scommesse' });
      condiviso = true;
    } catch (err) {
      if (err.name === 'AbortError') return;   // hai chiuso tu la finestra: nessun errore
    }
  }
  if (!condiviso) {
    try {
      scaricaFile(file);
    } catch {
      notifica('Esportazione non riuscita', { icona: 'avviso', tono: 'testo-avviso' });
      return;
    }
  }
  stato.impostazioni.ultimoBackup = new Date().toISOString();
  salva();
  aggiornaTutto();
  notifica(condiviso ? 'Backup esportato' : 'Backup salvato in Download');
}

/* =========================================================
   Avvio
   ========================================================= */

/* Versione nuova arrivata mentre la scheda o una domanda erano aperte: si ricarica dopo */
let ricaricaInAttesa = false;
const libero = () => !bozza && $('#scelte').hidden;

function avvio() {
  // Dopo un ricaricamento per il tema: si torna dov'eri
  let riapri = null;
  try {
    riapri = JSON.parse(sessionStorage.getItem('riapri'));
    sessionStorage.removeItem('riapri');
  } catch { /* niente da riaprire */ }
  if (riapri?.area && AREE[riapri.area]) ui.area = riapri.area;

  $$('[data-icona]').forEach(el => { el.innerHTML = icona(el.dataset.icona); });
  applicaTema();
  disegnaControlliGiocate();
  $$('.schermo > .pagina').forEach(collegaNav);
  $$('.capsula button').forEach(b => b.addEventListener('click', () => mostraTab(b.dataset.tab)));
  $('#nuova').addEventListener('click', () => apriForm(null));
  renderGiocate();
  aggiornaBadge();
  if (riapri?.tab && riapri.tab !== 'giocate' && $(`#tab-${riapri.tab}`)) mostraTab(riapri.tab);
  if (riapri) {
    const pagina = $(`#tab-${ui.tab}`);
    pagina.scrollTop = riapri.scroll || 0;
    pagina.dispatchEvent(new Event('scroll'));
  }

  // Quando riapri l'app: controlla se c'è una versione nuova e aggiorna "da completare"
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    controllaAggiornamenti();
    if (bozza) return;
    if (ricaricaInAttesa && libero()) location.reload();
    else aggiornaTutto();
  });
  setInterval(() => {
    if (!bozza && ui.tab === 'giocate' && firmaDaCompletare() !== firmaVista) renderGiocate();
  }, 60000);

  collegaAggiornamenti();
}

/* Copia dei file sul telefono (sw.js): l'app si apre subito e anche senza internet.
   Solo sul sito pubblicato (https). Sul Mac (localhost) niente copia, così le modifiche
   si vedono subito ricaricando; si toglie anche quella lasciata da prove precedenti. */
function collegaAggiornamenti() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:') {
    navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())).catch(() => {});
    return;
  }
  const avevaVersione = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // Versione nuova pronta: ricarica, ma mai mentre stai scrivendo una giocata o rispondendo
  // a una domanda; in quel caso si ricarica quando torni all'app.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avevaVersione || ricaricaInAttesa) return;
    ricaricaInAttesa = true;
    if (libero()) location.reload();
  });
}

function controllaAggiornamenti() {
  if (location.protocol !== 'https:' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
}

/* La versione la decide sw.js (è nel nome della copia salvata): una sola fonte, mai disallineata */
async function mostraVersione() {
  const el = $('#versione-app');
  if (!el) return;
  let testo = 'di prova (sul Mac)';
  try {
    if (location.protocol === 'https:') {
      const nome = (await caches.keys()).find(n => n.startsWith('registro-') && n !== 'registro-v1' && n !== 'registro-v2');
      testo = nome ? nome.slice('registro-'.length) : 'in installazione';
    }
  } catch { /* senza copia salvata resta il testo di prova */ }
  el.textContent = testo;
}

/* iOS: due tocchi ravvicinati fanno partire lo zoom. Al secondo tocco blocchiamo lo zoom
   e passiamo noi il tocco all'elemento, così il pulsante funziona come sempre.
   Nei campi di testo non si interviene: lì il doppio tocco serve a selezionare. */
/* Conta solo i tocchi veri: un dito, fermo, breve. Uno scorrimento, un trascinamento o il
   pizzico con due dita non sono tocchi e non devono mai diventare un clic. */
let toccoInizio = null;     // { x, y, t } del dito appena appoggiato, null se non è un tocco semplice
let ultimoTocco = null;     // { x, y, t } dell'ultimo tocco vero
document.addEventListener('touchstart', e => {
  const p = e.touches[0];
  toccoInizio = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: e.timeStamp } : null;
  if (e.touches.length > 1) ultimoTocco = null;
}, { passive: true });
document.addEventListener('touchend', e => {
  const inizio = toccoInizio;
  toccoInizio = null;
  const p = e.changedTouches[0];
  const tocco = inizio && !e.touches.length && e.changedTouches.length === 1
    && Math.hypot(p.clientX - inizio.x, p.clientY - inizio.y) < 10
    && e.timeStamp - inizio.t < 300;
  if (!tocco) { ultimoTocco = null; return; }
  const prima = ultimoTocco;
  ultimoTocco = { x: p.clientX, y: p.clientY, t: e.timeStamp };
  if (!prima || e.timeStamp - prima.t >= 350 || Math.hypot(p.clientX - prima.x, p.clientY - prima.y) > 40) return;
  // Le icone sono disegni SVG, che non hanno .click(): si risale all'elemento HTML che le contiene
  let el = e.target instanceof Element ? e.target : e.target.parentElement;
  while (el && !(el instanceof HTMLElement)) el = el.parentElement;
  if (!el || el.closest('textarea, select, input:not([type="checkbox"])')) return;
  e.preventDefault();
  el.click();
}, { passive: false });
document.addEventListener('touchcancel', () => { toccoInizio = null; ultimoTocco = null; }, { passive: true });

document.addEventListener('DOMContentLoaded', avvio);
