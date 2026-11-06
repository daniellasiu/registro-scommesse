#!/bin/zsh
# Pubblica l'app su GitHub Pages.
# 1. aumenta VERSIONE in sw.js (così i telefoni sanno che c'è una versione nuova)
# 2. controlla che ogni file dell'app sia nell'elenco FILE di sw.js (serve per l'uso offline)
# 3. salva (commit) e carica (push)
#
# Uso:  ./pubblica.sh "Titolo della modifica" ["altri paragrafi del messaggio" ...]

set -e
cd "$(dirname "$0")"
if [ -z "$1" ]; then
  echo 'Scrivi cosa è cambiato, per esempio:  ./pubblica.sh "Corregge il backup"'
  exit 1
fi

python3 - <<'EOF'
import re, datetime, pathlib, sys
sw = pathlib.Path('sw.js').read_text()

# Ogni file dell'app deve essere nella copia per l'uso senza internet
elenco = set(re.findall(r"'([^']+)'", sw[sw.index('const FILE'):sw.index('];')]))
app = {p.as_posix() for p in pathlib.Path('.').glob('*') if p.suffix in ('.js', '.css', '.html', '.webmanifest') and p.name != 'sw.js'}
app |= {p.as_posix() for p in pathlib.Path('icone').glob('*.png')}
mancano = sorted(app - elenco)
if mancano:
    sys.exit(f"Fermo: questi file non sono nell'elenco FILE di sw.js: {', '.join(mancano)}")

mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
m = re.search(r"const VERSIONE = '[^']*· (\d+)';", sw)
numero = int(m.group(1)) + 1 if m else 1
oggi = datetime.date.today()
nuova = f"{oggi.day} {mesi[oggi.month - 1]} {oggi.year} · {numero}"
sw = re.sub(r"const VERSIONE = '[^']*';", f"const VERSIONE = '{nuova}';", sw, count=1)
pathlib.Path('sw.js').write_text(sw)
print(f"Versione {nuova}")
EOF

git add -A
printf '%s\n\n' "$@" | git commit -q -F -
git push -q
echo "Pubblicato: online tra circa un minuto."
