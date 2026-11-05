// Unico punto dell'app che legge e scrive i dati.
// Fase 1: i dati stanno nel telefono (localStorage del browser).
// Fase 2 (accesso anche dal PC): si cambia solo questo file, il resto dell'app resta uguale.

const Archivio = (() => {
  const CHIAVE = 'registro-scommesse';

  function carica() {
    try {
      const testo = localStorage.getItem(CHIAVE);
      return testo ? JSON.parse(testo) : null;
    } catch {
      return null;
    }
  }

  function salva(stato) {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(stato));
      return true;
    } catch {
      return false;
    }
  }

  return { carica, salva };
})();
