# Consulta DISC

Web estàtica per comprovar si una paraula és al *Diccionari Informatitzat de l'Scrabble en Català* (DISC).
No fa servir cap base de dades ni cap framework: només HTML, CSS, JavaScript i fitxers JSON.

## Estructura

```
diccionari/
├── DISC2-Compacte.txt     diccionari original (entrada|categoria|model_flexiu)
├── fonts/hunspell/        corrector de Softcatalà (ca.aff, ca.dic) per a les formes flexionades
├── eines/
│   └── genera_json.py     converteix el .txt en fitxers JSON
└── docs/                  la web (és el que publica GitHub Pages)
    ├── index.html         cercador (admet ?p=paraula)
    ├── api.html           resultat en JSON (?p=paraula) i documentació de l'API
    ├── css/estils.css
    ├── js/diccionari.js   llibreria de consulta, sense DOM (la fan servir les dues pàgines)
    ├── js/app.js          interfície del cercador
    ├── js/api.js          interfície d'api.html
    └── dades/
        ├── index.json     versió, nombre d'entrades i llista de fitxers
        ├── a/ba.json      paraules que comencen per «aba» (sense accents)
        └── ...            ~2.500 fitxers; la majoria fan pocs KB, el més gran (d/es.json) ~280 KB comprimit
```

Els fitxers van en una carpeta per la primera lletra perquè Windows no admet noms com `aux.json` o `con.json`.

Cada fitxer té tres parts:

- `e`: entrades del DISC (`[entrada, categoria, model_flexiu]`).
- `f`: formes flexionades que pertanyen a una entrada del DISC (`[forma, entrada]`).
- `c`: formes que accepta el corrector però que no s'han pogut lligar a cap entrada.

Cada consulta només descarrega el fitxer de les tres primeres lletres de la paraula. El navegador el guarda en
memòria, de manera que les consultes següents amb el mateix inici són instantànies.

La clau de cerca no té en compte accents, `ç`, majúscules, punt volat, guionets ni apòstrofs
(«àbac» → `abac`, «col·legi» → `collegi`). `normalitza()` de `genera_json.py` i la de `app.js` han de
fer el mateix.

## Actualitzar el diccionari

1. Substitueix `DISC2-Compacte.txt` (i `readme.txt`, d'on es llegeix la versió) o els fitxers de
   `fonts/hunspell/`.
2. Executa des de la carpeta `diccionari`:

   ```
   python eines/genera_json.py
   ```

   Esborra i torna a crear `docs/dades/`.

## Provar-ho en local

Els navegadors no permeten `fetch()` des de `file://`, cal un servidor:

```
cd docs
python -m http.server 8000
```

i obrir <http://localhost:8000>.

## Publicar a GitHub Pages

1. Puja aquesta carpeta a un repositori de GitHub (pot ser l'arrel del repositori o una subcarpeta;
   el que compta és que `docs/` quedi a l'arrel del repositori).
2. A GitHub: **Settings → Pages → Build and deployment**
   - *Source*: **Deploy from a branch**
   - *Branch*: `main` i carpeta **`/docs`**
3. Al cap d'un minut la web és a `https://<usuari>.github.io/<repositori>/`.

El fitxer `docs/.nojekyll` evita que GitHub processi la web amb Jekyll.

Es pot enllaçar una consulta directament: `https://<usuari>.github.io/<repositori>/?p=col·legi`
(els enllaços antics amb `#col·legi` continuen funcionant).

Atenció: `https://github.com/<usuari>/<repositori>` és la pàgina del codi; la web publicada és a
`https://<usuari>.github.io/<repositori>/`.

## API

GitHub Pages només serveix fitxers estàtics, per tant no pot executar codi al servidor per respondre
`?p=paraula` amb JSON. L'API se simula de tres maneres:

1. **`api.html?p=paraula`**: la pàgina construeix el JSON amb JavaScript i el mostra. Serveix per al navegador;
   un programa que no executi JavaScript (curl, un servidor) rebrà l'HTML. Admet diverses paraules:
   `api.html?p=casa,cases` o `api.html?p=casa&p=cases`.
2. **`js/diccionari.js`** des de qualsevol altra web (GitHub Pages envia `Access-Control-Allow-Origin: *`):

   ```html
   <script src="https://<usuari>.github.io/<repositori>/js/diccionari.js"></script>
   <script>
     Diccionari.consulta('cases').then((r) => console.log(r.valida, r.estat));
   </script>
   ```

   La llibreria troba sola la carpeta `dades/` a partir de la seva adreça. També funciona amb Node 18+:
   `const D = require('./docs/js/diccionari.js'); D.configura({ base: 'https://…/dades/' });`
3. **Els fitxers JSON directament**: normalitza la paraula, agafa'n les tres primeres lletres i llegeix
   `dades/<1a lletra>/<2a i 3a>.json` (vegeu el format més amunt).

Format de la resposta de `Diccionari.consulta()` i d'`api.html`:

```json
{
  "paraula": "cases",
  "estat": "forma",
  "valida": true,
  "entrades": [],
  "formes": {
    "escrites": ["cases", "casés"],
    "de": [{ "entrada": "casa", "categoria": "f.", "descripcio": "nom femení", "model": "203" }]
  },
  "corrector": [],
  "suggeriments": []
}
```

- `estat`: `entrada` (és una entrada del DISC), `forma` (forma flexionada d'una entrada),
  `no-confirmada` (només l'accepta el corrector de Softcatalà) o `no-trobada`.
- `valida`: `true` per a `entrada` i `forma`.
- `suggeriments`: entrades que comencen igual, només quan no és vàlida.

## Formes flexionades i limitacions

El fitxer compacte del DISC només conté les **entrades** (lemes). Les formes flexionades s'obtenen expandint
les regles de sufixos del corrector Hunspell de Softcatalà (`ca.aff` + `ca.dic`). Una forma es dona per
vàlida (✔) només si la seva família pertany a una entrada del DISC: «cases» → casa, «cantàvem» → cantar.
No s'inclouen els prefixos apostrofats (l', d') ni els pronoms enclítics (-ne, -me): no valen al joc.

- Les formes dels **verbs irregulars** (vaig, tinc, sóc, desfèiem…) apareixen soltes al `.dic`, sense
  lligam amb l'infinitiu. La web les mostra en groc (?) com a «no confirmades pel DISC».
- El corrector de Softcatalà inclou formes valencianes i balears i es basa en el DIEC; si el DISC usa un
  model flexiu diferent, pot haver-hi alguna diferència puntual.

Per què no es fa servir una llibreria Hunspell (nspell…) directament al navegador: carregar aquest
diccionari amb nspell triga més de 2 minuts i ocupa gairebé 1 GB de memòria. Expandir les formes abans
(amb `genera_json.py`, uns 15 segons) i servir-les com a JSON és instantani per a l'usuari.

## Llicència de les dades

DISC © 2012–2025 Joan Montané, llicència dual GPLv3 i CC BY-SA 3.0 — <http://diccionari.totescrable.cat>

Corrector ortogràfic català © Joan Moratinos, Joan Montané i altres (Softcatalà), llicència GPL v2 o posterior.
