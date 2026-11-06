'use strict';

/* Icone a tratto (24×24), disegnate per questa app. Colore = currentColor. */
const ICONE = {
  // Schedina come ricevuta con il bordo seghettato (barra in basso, sezione Giocate)
  schedina: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  grafico: '<path d="M5 20v-7M12 20V5M19 20v-10"/>',
  ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  // Appunti (pulsante "Incolla schedina")
  appunti: '<path d="M9 4.5H7.5A2.5 2.5 0 0 0 5 7v11.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5H15"/><rect x="9" y="3" width="6" height="3.5" rx="1.2"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>',
  spunta: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  croce: '<path d="M7 7l10 10M17 7L7 17"/>',
  trattino: '<path d="M7 12h10"/>',
  barrato: '<circle cx="12" cy="12" r="7.5"/><path d="M6.8 17.2L17.2 6.8"/>',
  avanti: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  indietro: '<path d="M15 5l-7 7 7 7"/>',
  giu: '<path d="M7 10l5 5 5-5"/>',
  basket: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c2.6 3.4 2.6 8.6 0 12M18 6c-2.6 3.4-2.6 8.6 0 12"/>',
  pallone: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z"/><path d="M12 8.2V3.6M15.6 10.8l4.3-1.4M14.2 15l2.7 3.6M9.8 15l-2.7 3.6M8.4 10.8L4.1 9.4"/>',
  andamento: '<path d="M3.5 16.5l5.5-5.5 4 4 7.5-7.5"/><path d="M15 7.5h5.5V13"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  bersaglio: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  quota: '<path d="M7 17L17 7"/><circle cx="7.8" cy="7.8" r="2.3"/><circle cx="16.2" cy="16.2" r="2.3"/>',
  calo: '<path d="M3.5 7.5l5.5 5.5 4-4 7.5 7.5"/><path d="M15 16.5h5.5V11"/>',
  fiamma: '<path d="M12 3.5c.8 3 4.5 4.7 4.5 9.2a4.5 4.5 0 0 1-9 0c0-2.1 1.1-3.5 2.1-4.3.2 1.6 1 2.7 2.2 3-.9-2.6-.8-5.4.2-7.9z"/>',
  persona: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.4-3.9 3.6-6.5 7.5-6.5s7.1 2.6 7.5 6.5"/>',
  stella: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6L12 16.6l-5.1 2.6 1-5.6-4-3.9 5.6-.8z"/>',
  strati: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/>',
  etichetta: '<path d="M4 12.2V5a1 1 0 0 1 1-1h7.2a1 1 0 0 1 .7.3l7 7a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0l-7-7a1 1 0 0 1-.3-.7z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  trofeo: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4M16 6h2.5a2.5 2.5 0 0 1-2.6 4M12 13.5V17M8.5 20h7M10 17h4"/>',
  elenco: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
  avviso: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r="1" fill="currentColor" stroke="none"/>',
  esporta: '<path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>',
  importa: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 12.5v5.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>',
  tabella: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  cassa: '<rect x="3.5" y="6.5" width="17" height="12" rx="2.5"/><path d="M3.5 10.5h17"/><path d="M15.5 14.5h2"/>',
};

function icona(nome, classe = '') {
  return `<svg class="ic ${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONE[nome] || ''}</svg>`;
}
