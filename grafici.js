'use strict';

/* =========================================================
   Grafici disegnati a mano (SVG e HTML): niente librerie,
   funzionano anche senza internet. I colori arrivano dai
   token CSS, quindi seguono da soli il tema chiaro/scuro.
   ========================================================= */

let contatoreGrafici = 0;

/* Passo "rotondo" per le linee della griglia: 1, 2, 2,5, 5 × 10^k */
function passoBello(grezzo) {
  const esp = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const f = grezzo / esp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * esp;
}

function scalaBella(min, max, intervalli = 3) {
  if (max - min < 1e-9) { max += 1; min -= 1; }
  const passo = passoBello((max - min) / intervalli);
  const da = Math.floor(min / passo + 1e-9) * passo;
  const a = Math.ceil(max / passo - 1e-9) * passo;
  const tacche = [];
  for (let t = da; t <= a + passo / 2; t += passo) tacche.push(Math.round(t * 100) / 100);
  return { min: da, max: a, tacche };
}

/* Collega tocco, trascinamento, mouse e frecce della tastiera a un indice del grafico */
function collegaCursore(svg, { indiceDa, mostra, nascondi, quanti, primo = 0 }) {
  let timer;
  let attuale = null;
  const vai = i => { clearTimeout(timer); attuale = i; mostra(i); };
  const via = ritardo => {
    clearTimeout(timer);
    timer = setTimeout(() => { attuale = null; nascondi(); }, ritardo);
  };
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture?.(e.pointerId);
    vai(indiceDa(e));
  });
  svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' || e.buttons) vai(indiceDa(e));
  });
  svg.addEventListener('pointerup', e => via(e.pointerType === 'mouse' ? 4000 : 1500));
  svg.addEventListener('pointercancel', () => via(0));
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') via(0); });
  svg.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const base = attuale ?? (e.key === 'ArrowLeft' ? quanti : primo - 1);
    vai(limita(base + (e.key === 'ArrowRight' ? 1 : -1), primo, quanti - 1));
  });
  svg.addEventListener('blur', () => via(0));
}

/* ---------- Andamento del guadagno (linea + area, verde sopra lo zero, rossa sotto) ---------- */

function graficoAndamento(el, punti, { alTocco, descrizione = '' } = {}) {
  const id = ++contatoreGrafici;
  const W = Math.max(240, Math.round(el.clientWidth));
  const H = 172;          // area del grafico
  const ASSE = 22;        // fascia delle date sotto
  const DESTRA = 54;      // spazio per le cifre a destra
  const SU = 10;
  const GIU = 6;
  const valori = punti.map(p => p.v);
  const { min, max, tacche } = scalaBella(Math.min(0, ...valori), Math.max(0, ...valori));
  const larg = W - DESTRA;
  const x = i => (punti.length > 1 ? (i * larg) / (punti.length - 1) : larg / 2);
  const y = v => SU + ((max - v) / (max - min)) * (H - SU - GIU);
  const y0 = y(0);
  const tratto = punti.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${tratto}L${x(punti.length - 1).toFixed(1)} ${y0.toFixed(1)}L0 ${y0.toFixed(1)}Z`;
  const ultimo = punti[punti.length - 1];
  const primaData = punti[1]?.g?.data;
  const ultimaData = ultimo.g?.data;

  el.innerHTML = `
    <svg class="grafico-svg" viewBox="0 0 ${W} ${H + ASSE}" height="${H + ASSE}" tabindex="0" role="img" aria-label="${esc(descrizione)}">
      <defs>
        <clipPath id="g${id}su"><rect x="-10" y="-10" width="${W + 20}" height="${y0 + 10}"/></clipPath>
        <clipPath id="g${id}giu"><rect x="-10" y="${y0}" width="${W + 20}" height="${H + ASSE}"/></clipPath>
      </defs>
      ${tacche.filter(t => t !== 0).map(t => `<line class="griglia" x1="0" x2="${larg}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}
      <line class="base" x1="0" x2="${larg}" y1="${y0}" y2="${y0}"/>
      ${tacche.map(t => `<text class="asse" x="${W}" y="${y(t) + 4}" text-anchor="end">${t === 0 ? '0 €' : euroBreve(t)}</text>`).join('')}
      <path class="area pos" d="${area}" clip-path="url(#g${id}su)"/>
      <path class="area neg" d="${area}" clip-path="url(#g${id}giu)"/>
      <path class="tratto pos" d="${tratto}" clip-path="url(#g${id}su)"/>
      <path class="tratto neg" d="${tratto}" clip-path="url(#g${id}giu)"/>
      <circle class="punto ${ultimo.v < 0 ? 'neg' : 'pos'}" cx="${x(punti.length - 1)}" cy="${y(ultimo.v)}" r="4"/>
      <g class="cursore" visibility="hidden">
        <line class="mirino" y1="${SU - 6}" y2="${H}"/>
        <circle class="punto pos" r="5"/>
      </g>
      ${primaData ? `<text class="asse" x="0" y="${H + ASSE - 4}">${dataBreve(primaData)}</text>` : ''}
      ${ultimaData && punti.length > 2 ? `<text class="asse" x="${larg}" y="${H + ASSE - 4}" text-anchor="end">${dataBreve(ultimaData)}</text>` : ''}
    </svg>`;

  const svg = el.querySelector('svg');
  const cursore = svg.querySelector('.cursore');
  const mirino = cursore.querySelector('.mirino');
  const pallino = cursore.querySelector('.punto');
  collegaCursore(svg, {
    quanti: punti.length,
    primo: 1,
    indiceDa: e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      return limita(Math.round((px / larg) * (punti.length - 1)), 1, punti.length - 1);
    },
    mostra: i => {
      const p = punti[i];
      mirino.setAttribute('x1', x(i));
      mirino.setAttribute('x2', x(i));
      pallino.setAttribute('cx', x(i));
      pallino.setAttribute('cy', y(p.v));
      pallino.setAttribute('class', `punto ${p.v < 0 ? 'neg' : 'pos'}`);
      cursore.setAttribute('visibility', 'visible');
      alTocco?.(p);
    },
    nascondi: () => {
      cursore.setAttribute('visibility', 'hidden');
      alTocco?.(null);
    },
  });
}

/* ---------- Barre sopra/sotto lo zero (giorno per giorno) ---------- */

function graficoBarre(el, barre, { alTocco, descrizione = '' } = {}) {
  const W = Math.max(240, Math.round(el.clientWidth));
  const H = 150;
  const ASSE = 22;
  const DESTRA = 54;
  const SU = 10;
  const GIU = 6;
  const valori = barre.map(b => b.valore);
  const { min, max, tacche } = scalaBella(Math.min(0, ...valori), Math.max(0, ...valori), 2);
  const larg = W - DESTRA - 6;
  const slot = larg / barre.length;
  const lb = Math.max(2, Math.min(24, slot >= 8 ? slot * 0.62 : slot - 2));
  const y = v => SU + ((max - v) / (max - min)) * (H - SU - GIU);
  const y0 = y(0);

  // Angoli arrotondati solo in punta, squadrati sulla linea dello zero
  const forma = (i, v) => {
    if (Math.abs(v) < 0.005) return '';
    const cx = slot * (i + 0.5);
    const x0 = (cx - lb / 2).toFixed(1);
    const x1 = (cx + lb / 2).toFixed(1);
    const yv = y(v);
    const r = Math.min(4, Math.abs(yv - y0), lb / 2);
    const d = v > 0 ? r : -r;
    return `<path class="barra ${v > 0 ? 'pos' : 'neg'}" data-i="${i}" d="M${x0} ${y0}V${yv + d}Q${x0} ${yv} ${(+x0 + r).toFixed(1)} ${yv}H${(+x1 - r).toFixed(1)}Q${x1} ${yv} ${x1} ${yv + d}V${y0}Z"/>`;
  };

  // Etichette sotto: tutte se sono poche, altrimenti prima, centrale e ultima
  const conAsse = barre.map((b, i) => ({ ...b, i })).filter(b => b.asse);
  const daMostrare = conAsse.length <= 7 ? conAsse
    : [conAsse[0], conAsse[Math.floor((conAsse.length - 1) / 2)], conAsse[conAsse.length - 1]];

  el.innerHTML = `
    <svg class="grafico-svg" viewBox="0 0 ${W} ${H + ASSE}" height="${H + ASSE}" tabindex="0" role="img" aria-label="${esc(descrizione)}">
      ${tacche.filter(t => t !== 0).map(t => `<line class="griglia" x1="0" x2="${larg}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}
      ${tacche.map(t => `<text class="asse" x="${W}" y="${y(t) + 4}" text-anchor="end">${t === 0 ? '0 €' : euroBreve(t)}</text>`).join('')}
      <g class="barre">${barre.map((b, i) => forma(i, b.valore)).join('')}</g>
      <line class="base" x1="0" x2="${larg}" y1="${y0}" y2="${y0}"/>
      ${daMostrare.map((b, k) => {
        const cx = slot * (b.i + 0.5);
        const ancora = conAsse.length > 7 ? (k === 0 ? 'start' : k === daMostrare.length - 1 ? 'end' : 'middle') : 'middle';
        const xx = ancora === 'start' ? Math.max(0, cx - lb / 2) : ancora === 'end' ? Math.min(larg, cx + lb / 2) : cx;
        return `<text class="asse" x="${xx}" y="${H + ASSE - 4}" text-anchor="${ancora}">${esc(b.asse)}</text>`;
      }).join('')}
    </svg>`;

  const svg = el.querySelector('svg');
  collegaCursore(svg, {
    quanti: barre.length,
    indiceDa: e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      return limita(Math.floor(px / slot), 0, barre.length - 1);
    },
    mostra: i => {
      svg.classList.add('evidenzia');
      svg.querySelectorAll('.barra').forEach(b => b.classList.toggle('attiva', Number(b.dataset.i) === i));
      alTocco?.(barre[i]);
    },
    nascondi: () => {
      svg.classList.remove('evidenzia');
      alTocco?.(null);
    },
  });
}

/* ---------- Colonne (es. percentuale di vinte per voto di fiducia) ---------- */

function graficoColonne(el, colonne, { descrizione = '' } = {}) {
  const W = Math.max(240, Math.round(el.clientWidth));
  const H = 140;
  const ASSE = 24;
  const SU = 22;
  const slot = W / colonne.length;
  const lb = Math.min(24, slot * 0.5);
  const y = v => SU + ((100 - v) / 100) * (H - SU);
  el.innerHTML = `
    <svg class="grafico-svg" viewBox="0 0 ${W} ${H + ASSE}" height="${H + ASSE}" role="img" aria-label="${esc(descrizione)}">
      <line class="griglia" x1="0" x2="${W}" y1="${y(50)}" y2="${y(50)}"/>
      ${colonne.map((c, i) => {
        const cx = slot * (i + 0.5);
        const x0 = cx - lb / 2;
        const x1 = cx + lb / 2;
        if (c.valore == null) return `<text class="cima" x="${cx}" y="${H - 6}" text-anchor="middle">–</text>`;
        const yv = y(c.valore);
        const r = Math.min(4, H - yv);
        return `<path class="colonna" d="M${x0} ${H}V${yv + r}Q${x0} ${yv} ${x0 + r} ${yv}H${x1 - r}Q${x1} ${yv} ${x1} ${yv + r}V${H}Z"/>
          <text class="cima" x="${cx}" y="${yv - 7}" text-anchor="middle">${Math.round(c.valore)}%</text>`;
      }).join('')}
      <line class="base" x1="0" x2="${W}" y1="${H}" y2="${H}"/>
      ${colonne.map((c, i) => `<text class="asse" x="${slot * (i + 0.5)}" y="${H + ASSE - 6}" text-anchor="middle">${esc(c.asse)}</text>`).join('')}
    </svg>`;
}

/* ---------- Barre orizzontali (classifiche) in HTML ---------- */

function barreOrizzontali(righe, { dettagli = false } = {}) {
  if (!righe.length) return '';
  const massimo = Math.max(...righe.map(r => Math.abs(r.netto)), 0.01);
  const divergenti = righe.some(r => r.netto < -0.004) && righe.some(r => r.netto > 0.004);
  return `<div class="barre-o ${divergenti ? 'divergenti' : ''}">${righe.map(r => {
    const s = segno(r.netto);
    const ampiezza = (Math.abs(r.netto) / massimo) * (divergenti ? 50 : 100);
    const statistica = r.vinte + r.perse ? ` · ${percTesto((r.vinte / (r.vinte + r.perse)) * 100)} vinte` : '';
    return `<div class="bo-riga">
      <div class="bo-testa"><span class="bo-nome">${esc(r.nome)}</span><span class="bo-valore testo-${s}">${euroSegno(r.netto)}</span></div>
      <div class="bo-traccia"><div class="bo-barra ${s}" style="width:${ampiezza.toFixed(1)}%"></div></div>
      ${dettagli ? `<div class="bo-nota">${plurale(r.n, 'giocata', 'giocate')}${statistica}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/* ---------- Barra di avanzamento (meter) ---------- */

function meter(frazione, { tacca = null, classe = '' } = {}) {
  const p = limita(frazione, 0, 1) * 100;
  return `<div class="meter ${classe}" role="presentation">
    <div class="meter-pieno" style="width:${p.toFixed(1)}%"></div>
    ${tacca != null ? `<div class="meter-tacca" style="left:${(limita(tacca, 0, 1) * 100).toFixed(1)}%"></div>` : ''}
  </div>`;
}
