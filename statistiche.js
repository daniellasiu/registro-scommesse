'use strict';

/* =========================================================
   Sezione Statistiche
   Panoramica (guadagno, andamento, sintesi, giocatori) e
   un elenco di analisi che si aprono in pagine di dettaglio.
   ========================================================= */

const PERIODI = [['oggi', 'Oggi'], ['7', 'Sett.'], ['30', 'Mese'], ['90', '3 mesi'], ['stagione', 'Stagione']];
const NOMI_PERIODO = { oggi: 'Oggi', 7: 'Ultimi 7 giorni', 30: 'Ultimi 30 giorni', 90: 'Ultimi 3 mesi' };
const SOTTO = {
  nba: [['tutte', 'Tutte le fasi'], ['regular', 'Regular season'], ['playoff', 'Playoff']],
  calcio: [['tutte', 'Tutte le competizioni'], ['campionati', 'Campionati'], ['uefa', 'Competizioni UEFA'], ['nazionali', 'Nazionali']],
  divertimento: [['tutte', 'Tutti gli sport'], ['nba', 'NBA'], ['calcio', 'Calcio']],
};
const NOTA_MULTIPLE = 'Nelle multiple la vincita si divide tra le selezioni, mentre la perdita va solo a quelle sbagliate: se salta solo LeBron, la sconfitta è sua.';

const vistaStat = { periodo: 'stagione', sotto: 'tutte', stagione: null };
let areaControlliStat = null;

/* ---------- Quali giocate guardare ---------- */

function giocateArea() {
  const v = vistaStat;
  return stato.giocate.filter(g => {
    if (ui.area === 'divertimento') return g.divertimento && (v.sotto === 'tutte' || g.area === v.sotto);
    if (g.divertimento || g.area !== ui.area) return false;
    if (v.sotto === 'tutte') return true;
    return ui.area === 'nba' ? g.fase === v.sotto : gruppoCalcio(g) === v.sotto;
  });
}

function stagioniDisponibili() {
  const riferimento = ui.area === 'nba' ? 'nba' : 'calcio';
  const presenti = stato.giocate.filter(g => areaDi(g) === ui.area).map(stagioneDi);
  return [...new Set([stagioneCorrente(riferimento), ...presenti])].sort().reverse();
}

function stagioneScelta() {
  const elenco = stagioniDisponibili();
  return vistaStat.stagione && elenco.includes(vistaStat.stagione) ? vistaStat.stagione : elenco[0];
}

function nelPeriodo(g) {
  const p = vistaStat.periodo;
  if (p === 'oggi') return g.data === oggiISO();
  if (p === 'stagione') return stagioneDi(g) === stagioneScelta();
  return g.data >= spostaGiorni(oggiISO(), -(Number(p) - 1));
}

function contesto() {
  const parti = [AREE[ui.area]];
  if (vistaStat.sotto !== 'tutte') parti.push(SOTTO[ui.area].find(o => o[0] === vistaStat.sotto)[1]);
  parti.push(vistaStat.periodo === 'stagione' ? `Stagione ${stagioneScelta()}` : NOMI_PERIODO[vistaStat.periodo]);
  return parti.join(' · ');
}

/* ---------- Controlli in alto ---------- */

function menu(nome, opzioni, valore) {
  const scelta = opzioni.find(o => String(o[0]) === String(valore)) || opzioni[0];
  return `<label class="menu"><span>${esc(scelta[1])}</span>${icona('giu')}
    <select data-menu="${nome}" aria-label="${esc(scelta[1])}">${opzioni.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(scelta[0]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
  </label>`;
}

function disegnaControlliStat() {
  areaControlliStat = ui.area;
  $('#controlli-statistiche').innerHTML = `
    ${segmentato('area', Object.entries(AREE), ui.area)}
    ${segmentato('periodo', PERIODI, vistaStat.periodo)}
    <div class="riga-filtri" id="filtri-stat"></div>`;
  disegnaFiltriStat();
}

function disegnaFiltriStat() {
  let html = menu('sotto', SOTTO[ui.area], vistaStat.sotto);
  if (vistaStat.periodo === 'stagione') {
    const elenco = stagioniDisponibili();
    if (elenco.length > 1) html += menu('stagione', elenco.map(s => [s, `Stagione ${s}`]), stagioneScelta());
  }
  $('#filtri-stat').innerHTML = html;
}

function renderStatistiche() {
  if (areaControlliStat !== ui.area) disegnaControlliStat();
  disegnaCorpoStat();
}

/* ---------- Carte ---------- */

function testaCarta(nomeIcona, colore, titolo, destra = '') {
  return `<div class="carta-testa"><span class="icona-tessera piccola" style="--c:var(--${colore})">${icona(nomeIcona)}</span><span class="carta-titolo">${titolo}</span>${destra ? `<span class="carta-contesto">${destra}</span>` : ''}</div>`;
}

function letturaGuadagno(m) {
  return `<div class="cifra-eroe">${euroSegno(m.guadagno)}</div>
    <div class="eroe-delta">Resa <b class="testo-${segno(m.resa || 0)}">${percSegno(m.resa)}</b> su ${euroAgile(m.puntato)} puntati</div>`;
}

function cartaGuadagno(m) {
  return `<section class="carta">
    ${testaCarta('andamento', 'verde', 'Guadagno', esc(vistaStat.periodo === 'stagione' ? `Stagione ${stagioneScelta()}` : NOMI_PERIODO[vistaStat.periodo]))}
    <div class="lettura" id="l-andamento">${letturaGuadagno(m)}</div>
    ${m.chiuse.length >= 2 ? '<div class="grafico" id="g-andamento"></div>' : ''}
    <div class="carta-piede"><button type="button" class="link" data-az="dati-andamento">Mostra i dati</button></div>
  </section>`;
}

const TITOLI_BARRE = { oggi: 'Giocata per giocata', 7: 'Giorno per giorno', 30: 'Giorno per giorno', 90: 'Settimana per settimana', stagione: 'Settimana per settimana' };
const UNITA_BARRE = { oggi: ['giocata', 'giocate'], 7: ['giorno', 'giorni'], 30: ['giorno', 'giorni'], 90: ['settimana', 'settimane'], stagione: ['settimana', 'settimane'] };

function letturaBarre(barre) {
  const molti = UNITA_BARRE[vistaStat.periodo][1];
  const conGiocate = barre.filter(b => b.n);
  const attivo = conGiocate.filter(b => b.valore > 0.004).length;
  return `<div class="lettura-didascalia">${molti} in attivo</div>
    <div class="lettura-valore">${attivo} <span class="lettura-unita">su ${conGiocate.length}</span></div>`;
}

function cartaBarre(barre) {
  if (barre.length < 2) return '';
  return `<section class="carta">
    ${testaCarta('calendario', 'teal', TITOLI_BARRE[vistaStat.periodo])}
    <div class="lettura" id="l-barre">${letturaBarre(barre)}</div>
    <div class="grafico" id="g-barre"></div>
    <div class="carta-piede"><button type="button" class="link" data-az="dati-barre">Mostra i dati</button></div>
  </section>`;
}

function tessera(nomeIcona, colore, titolo, cifra, nota, extra = '', classeCifra = '') {
  return `<div class="tessera">
    ${testaCarta(nomeIcona, colore, titolo)}
    <div class="cifra ${classeCifra}">${cifra}</div>
    ${extra}
    <div class="tessera-nota">${nota}</div>
  </div>`;
}

function tessereSintesi(m) {
  const serie = m.serie > 0 ? plurale(m.serie, 'vinta', 'vinte') : m.serie < 0 ? plurale(-m.serie, 'persa', 'perse') : '–';
  return `<div class="tessere">
    ${tessera('bersaglio', 'blu', 'Vinte', percTesto(m.percVinte),
      m.pareggio != null ? `Ti serve il ${Math.round(m.pareggio)}% per andare in pari` : `${m.vinte} vinte · ${m.perse} perse`,
      m.percVinte != null ? meter(m.percVinte / 100, { tacca: m.pareggio != null ? m.pareggio / 100 : null }) : '')}
    ${tessera('quota', 'indaco', 'Quota media', m.quotaMedia ? quotaTesto(m.quotaMedia) : '–', `${m.vinte} vinte · ${m.perse} perse`)}
    ${tessera('calo', 'rosso', 'Peggior calo', m.calo > 0.004 ? `${MENO}${euroAgile(m.calo)}` : 'Nessuno', 'La discesa più grande da un massimo')}
    ${tessera('fiamma', 'arancio', 'Serie attuale', serie, `Record: ${plurale(m.recordV, 'vinta', 'vinte')} e ${plurale(m.recordP, 'persa', 'perse')} di fila`)}
  </div>`;
}

function righeGiocatori(chiuse) {
  return perSelezione(chiuse, s => s.giocatore, s => s.sport === 'nba').sort((a, b) => b.netto - a.netto);
}

function cartaGiocatori(m) {
  const giocatori = righeGiocatori(m.chiuse);
  if (!giocatori.length) return '';
  const migliori = giocatori.filter(r => r.netto > 0.004).slice(0, 3);
  const peggiori = giocatori.filter(r => r.netto < -0.004).reverse().slice(0, 3);
  return `<h2 class="titolo-sezione">Giocatori</h2>
    <section class="carta">
      ${testaCarta('persona', 'arancio', 'Chi ti fa vincere e chi ti fa perdere')}
      <div class="due-colonne">
        <div><div class="sottotitolo-carta">I migliori</div>${migliori.length ? barreOrizzontali(migliori) : '<p class="secondario" style="font-size:15px">Ancora nessuno in attivo.</p>'}</div>
        <div><div class="sottotitolo-carta">I peggiori</div>${peggiori.length ? barreOrizzontali(peggiori) : '<p class="secondario" style="font-size:15px">Nessuno in passivo.</p>'}</div>
      </div>
    </section>
    <div class="lista" style="margin-top:12px">
      <button type="button" class="riga toccabile" data-az="analisi" data-voce="giocatori"><span class="riga-testi">Tutti i giocatori</span><span class="riga-valore">${giocatori.length}</span>${icona('avanti', 'chevron')}</button>
    </div>`;
}

/* ---------- Analisi (elenco + pagine di dettaglio) ---------- */

const FASCE = ['Sotto 1,50', 'Da 1,50 a 2,00', 'Sopra 2,00'];
const ordinaCome = (righe, ordine) => righe.sort((a, b) => ordine.indexOf(a.nome) - ordine.indexOf(b.nome));
const perNetto = righe => righe.sort((a, b) => b.netto - a.netto);

const ANALISI = {
  fasi: {
    titolo: 'Regular season e playoff', icona: 'trofeo', colore: 'arancio',
    disponibile: () => ui.area === 'nba' && vistaStat.sotto === 'tutte',
    righe: c => ordinaCome(perGruppo(c, g => g.fase, FASI), Object.values(FASI)),
  },
  competizioni: {
    titolo: 'Competizioni', icona: 'trofeo', colore: 'indaco',
    disponibile: () => ui.area === 'calcio' && vistaStat.sotto === 'tutte',
    righe: c => ordinaCome(perGruppo(c, gruppoCalcio, COMPETIZIONI_LUNGHE), Object.values(COMPETIZIONI_LUNGHE)),
  },
  sport: {
    titolo: 'Sport', icona: 'dado', colore: 'rosa',
    disponibile: () => ui.area === 'divertimento' && vistaStat.sotto === 'tutte',
    righe: c => ordinaCome(perGruppo(c, g => g.area, AREE), ['NBA', 'Calcio']),
  },
  prestazioni: {
    titolo: 'Tipo di prestazione', icona: 'elenco', colore: 'teal', nota: NOTA_MULTIPLE,
    disponibile: c => c.some(g => g.selezioni.some(s => s.sport === 'nba')),
    righe: c => perNetto(perSelezione(c, s => `${s.tipo} ${s.verso === 'under' ? 'Under' : 'Over'}`, s => s.sport === 'nba')),
  },
  mercati: {
    titolo: 'Mercati', icona: 'elenco', colore: 'teal', nota: NOTA_MULTIPLE,
    disponibile: c => c.some(g => g.selezioni.some(s => s.sport === 'calcio')),
    righe: c => perNetto(perSelezione(c, s => s.tipo, s => s.sport === 'calcio')),
  },
  fiducia: {
    titolo: 'Fiducia', icona: 'stella', colore: 'viola',
    disponibile: c => c.some(g => g.fiducia),
    righe: c => perGruppo(c.filter(g => g.fiducia), g => g.fiducia).sort((a, b) => a.chiave - b.chiave)
      .map(r => ({ ...r, nome: `Voto ${r.chiave}` })),
  },
  singole: {
    titolo: 'Singole e multiple', icona: 'strati', colore: 'blu',
    disponibile: () => true,
    righe: c => ordinaCome(perGruppo(c, g => (g.selezioni.length > 1 ? 'Multiple' : 'Singole')), ['Singole', 'Multiple']),
  },
  quote: {
    titolo: 'Fasce di quota', icona: 'etichetta', colore: 'rosa',
    disponibile: () => true,
    righe: c => ordinaCome(perGruppo(c, g => {
      const q = quotaEffettiva(g);
      return q < 1.5 ? FASCE[0] : q <= 2 ? FASCE[1] : FASCE[2];
    }), FASCE),
  },
  giocatori: {
    titolo: 'Giocatori', nota: NOTA_MULTIPLE, nascosta: true,
    disponibile: c => c.some(g => g.selezioni.some(s => s.sport === 'nba')),
    righe: c => righeGiocatori(c),
  },
};

function listaAnalisi(m) {
  const voci = Object.entries(ANALISI).filter(([, a]) => !a.nascosta && a.disponibile(m.chiuse));
  return `<h2 class="titolo-sezione">Analisi</h2>
    <div class="lista" style="--rientro:57px">${voci.map(([chiave, a]) => `
      <button type="button" class="riga toccabile" data-az="analisi" data-voce="${chiave}">
        <span class="icona-tessera" style="--c:var(--${a.colore})">${icona(a.icona)}</span>
        <span class="riga-testi">${a.titolo}</span>${icona('avanti', 'chevron')}
      </button>`).join('')}
    </div>
    <p class="piede">Le giocate in attesa non sono conteggiate.</p>`;
}

function apriAnalisi(chiave) {
  const a = ANALISI[chiave];
  const chiuse = metriche(giocateArea().filter(nelPeriodo)).chiuse;
  const righe = a.righe(chiuse);
  apriPagina({
    titolo: a.titolo,
    sottotitolo: contesto(),
    indietro: 'Statistiche',
    costruisci: el => {
      if (chiave === 'fiducia') {
        el.innerHTML = `
          <section class="carta">
            ${testaCarta('stella', 'viola', 'Percentuale di vinte per voto')}
            <div class="grafico" id="g-fiducia"></div>
          </section>
          <p class="piede" style="margin-bottom:24px">Le giocate di cui eri più sicuro vanno davvero meglio? Contano solo le giocate a cui hai dato un voto.</p>
          <section class="carta">${testaCarta('andamento', 'verde', 'Guadagno per voto')}${barreOrizzontali(righe, { dettagli: true })}</section>`;
        const colonne = [1, 2, 3, 4, 5].map(v => {
          const r = righe.find(x => x.chiave === v);
          return { asse: `Voto ${v}`, valore: r && r.vinte + r.perse ? (r.vinte / (r.vinte + r.perse)) * 100 : null };
        });
        graficoColonne($('#g-fiducia', el), colonne, { descrizione: 'Percentuale di giocate vinte per ogni voto di fiducia' });
        return;
      }
      el.innerHTML = righe.length
        ? `<section class="carta">${barreOrizzontali(righe, { dettagli: true })}</section>${a.nota ? `<p class="piede">${a.nota}</p>` : ''}`
        : vuoto('grafico', 'Nessun dato', 'Nessuna giocata conclusa in questo periodo.');
    },
  });
}

/* Le tabelle dietro i grafici: ogni valore leggibile anche senza toccare il grafico */
function apriDatiAndamento(m) {
  apriPagina({
    titolo: 'Tutte le giocate',
    sottotitolo: contesto(),
    indietro: 'Statistiche',
    costruisci: el => {
      const righe = m.punti.slice(1).reverse().map(p => {
        const n = netto(p.g);
        return `<div class="riga">
          <div class="riga-testi"><div class="riga-titolo">${esc(titoloGiocata(p.g))}</div><div class="riga-sotto">${esc(dataLunga(p.g.data))} · ${ESITI[p.g.esito]}</div></div>
          <div class="riga-dx colonna"><span class="importo testo-${segno(n)}">${euroSegno(n)}</span><span class="importo-nota">totale ${euroSegno(p.v)}</span></div>
        </div>`;
      }).join('');
      el.innerHTML = `<div class="lista">${righe}</div>`;
    },
  });
}

function apriDatiBarre(barre) {
  apriPagina({
    titolo: TITOLI_BARRE[vistaStat.periodo],
    sottotitolo: contesto(),
    indietro: 'Statistiche',
    costruisci: el => {
      const righe = barre.filter(b => b.n).reverse().map(b => `<div class="riga">
        <div class="riga-testi"><div class="riga-titolo">${esc(b.etichetta)}</div><div class="riga-sotto">${plurale(b.n, 'giocata', 'giocate')}</div></div>
        <span class="importo testo-${segno(b.valore)}">${euroSegno(b.valore)}</span>
      </div>`).join('');
      el.innerHTML = `<div class="lista">${righe}</div>`;
    },
  });
}

/* ---------- Pagina ---------- */

let datiCorrenti = null;

function disegnaCorpoStat() {
  const gs = giocateArea().filter(nelPeriodo);
  const m = metriche(gs);
  const corpo = $('#corpo-statistiche');
  if (!m.chiuse.length) {
    datiCorrenti = null;
    const attesa = m.aperte.length ? ` ${plurale(m.aperte.length, 'giocata è', 'giocate sono')} ancora in attesa.` : '';
    corpo.innerHTML = vuoto('grafico', 'Nessun dato', `Nessuna giocata conclusa in questo periodo.${attesa}`);
    return;
  }
  const barre = barrePeriodo(m.chiuse, vistaStat.periodo);
  datiCorrenti = { m, barre };

  corpo.innerHTML = `
    ${cartaGuadagno(m)}
    ${cartaBarre(barre)}
    <h2 class="titolo-sezione">In sintesi</h2>
    ${tessereSintesi(m)}
    ${cartaGiocatori(m)}
    ${listaAnalisi(m)}`;
  disegnaGraficiStat();
}

function disegnaGraficiStat() {
  if (!datiCorrenti) return;
  const { m, barre } = datiCorrenti;
  const gAndamento = $('#g-andamento');
  if (gAndamento) {
    graficoAndamento(gAndamento, m.punti, {
      descrizione: `Andamento del guadagno: da 0 a ${euroSegno(m.guadagno)} in ${plurale(m.chiuse.length, 'giocata', 'giocate')}`,
      alTocco: p => {
        $('#l-andamento').innerHTML = p
          ? `<div class="cifra-eroe">${euroSegno(p.v)}</div><div class="eroe-delta">${esc(dataLunga(p.g.data))} · ${esc(titoloGiocata(p.g))} <b class="testo-${segno(netto(p.g))}">${euroSegno(netto(p.g))}</b></div>`
          : letturaGuadagno(m);
      },
    });
  }
  const gBarre = $('#g-barre');
  if (gBarre) {
    graficoBarre(gBarre, barre, {
      descrizione: `${TITOLI_BARRE[vistaStat.periodo]}: guadagno o perdita di ogni periodo`,
      alTocco: b => {
        $('#l-barre').innerHTML = b
          ? `<div class="lettura-didascalia">${esc(b.etichetta)}${b.n ? ` · ${plurale(b.n, 'giocata', 'giocate')}` : ''}</div>
             <div class="lettura-valore ${b.n ? `testo-${segno(b.valore)}` : 'secondario'}">${b.n ? euroSegno(b.valore) : 'Nessuna giocata'}</div>`
          : letturaBarre(barre);
      },
    });
  }
}

/* ---------- Eventi ---------- */

$('#controlli-statistiche').addEventListener('click', e => {
  const b = e.target.closest('.seg button');
  if (!b) return;
  const quale = b.closest('.seg').dataset.seg;
  if (quale === 'area') {
    if (ui.area === b.dataset.val) return;
    ui.area = b.dataset.val;
    areaControlliStat = ui.area;
    vistaStat.sotto = 'tutte';
    vistaStat.stagione = null;
  } else if (quale === 'periodo') {
    if (vistaStat.periodo === b.dataset.val) return;
    vistaStat.periodo = b.dataset.val;
  }
  disegnaFiltriStat();
  disegnaCorpoStat();
});

$('#controlli-statistiche').addEventListener('change', e => {
  const s = e.target.closest('select[data-menu]');
  if (!s) return;
  if (s.dataset.menu === 'sotto') vistaStat.sotto = s.value;
  else vistaStat.stagione = s.value;
  disegnaFiltriStat();
  disegnaCorpoStat();
});

$('#corpo-statistiche').addEventListener('click', e => {
  const az = e.target.closest('[data-az]');
  if (!az || !datiCorrenti) return;
  if (az.dataset.az === 'analisi') apriAnalisi(az.dataset.voce);
  if (az.dataset.az === 'dati-andamento') apriDatiAndamento(datiCorrenti.m);
  if (az.dataset.az === 'dati-barre') apriDatiBarre(datiCorrenti.barre);
});

// Ridisegna i grafici se cambia la larghezza (es. telefono ruotato)
let timerRidimensiona;
window.addEventListener('resize', () => {
  clearTimeout(timerRidimensiona);
  timerRidimensiona = setTimeout(() => { if (ui.tab === 'statistiche') disegnaGraficiStat(); }, 150);
});
