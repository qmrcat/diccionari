/*
 * Diccionari: consulta el DISC a partir dels fitxers JSON de docs/dades/.
 * No depèn del DOM: el fa servir la web (app.js), la pàgina api.html i qualsevol
 * altra web que el carregui:
 *
 *   <script src="https://USUARI.github.io/REPOSITORI/js/diccionari.js"></script>
 *   const r = await Diccionari.consulta('cases');
 *   r.valida  // true
 */
(function (global) {
  'use strict';

  const MAX_SUGGERIMENTS = 40;

  const ETIQUETES = {
    'm.': 'nom masculí',
    'f.': 'nom femení',
    'mif.': 'nom masculí i femení',
    'mof.': 'nom masculí o femení',
    'mpl.': 'nom masculí plural',
    'fpl.': 'nom femení plural',
    'mplofpl.': 'nom masculí o femení plural',
    'adj.': 'adjectiu',
    'v.': 'verb',
    'adv.': 'adverbi',
    'pron.': 'pronom',
    'prep.': 'preposició',
    'conj.': 'conjunció',
    'interj.': 'interjecció',
    'art.': 'article',
    'pl.': 'plural',
    'loc. adv.': 'locució adverbial',
    'loc. adj.': 'locució adjectiva',
    'loc. prep.': 'locució prepositiva'
  };

  // Les dades són a ../dades/ respecte d'aquest fitxer, tant si es carrega des de la
  // mateixa web com des d'una altra.
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  let base = script && script.src ? new URL('../dades/', script.src).href : 'dades/';

  const memoria = new Map();
  let promesaIndex = null;

  /* Ha de fer exactament el mateix que normalitza() de eines/genera_json.py */
  function normalitza(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z]/g, '');
  }

  function descriuCategoria(categoria) {
    if (categoria === 'CAT~DESC.') return 'categoria no especificada';
    return categoria
      .split('~')
      .map((part) => {
        const trossos = part.match(/loc\. [a-z]+\.?|[a-z]+\.?/gi) || [part];
        return trossos
          .map((t) => {
            const net = t.replace(/,$/, '');
            return ETIQUETES[net] || ETIQUETES[net + '.'] || net;
          })
          .join(' i ');
      })
      .join(' · ');
  }

  async function llegeixJSON(ruta) {
    const r = await fetch(base + ruta);
    if (!r.ok) throw new Error(`HTTP ${r.status} en carregar ${ruta}`);
    return r.json();
  }

  function info() {
    if (!promesaIndex) {
      promesaIndex = llegeixJSON('index.json').catch((error) => {
        promesaIndex = null;
        throw error;
      });
    }
    return promesaIndex;
  }

  async function carregaFragment(clau) {
    const nom = (clau + '__').slice(0, 3);
    const index = await info();
    if (!index.fragments.includes(nom)) return { e: {}, f: {}, c: {} };
    if (!memoria.has(nom)) {
      const promesa = llegeixJSON(`${nom[0]}/${nom.slice(1)}.json`).catch((error) => {
        memoria.delete(nom);
        throw error;
      });
      memoria.set(nom, promesa);
    }
    return memoria.get(nom);
  }

  async function busca(clau) {
    const dades = await carregaFragment(clau);
    return {
      entrades: dades.e[clau] || [],
      formes: dades.f[clau] || [],
      corrector: dades.c[clau] || []
    };
  }

  function descriuEntrada([entrada, categoria, model]) {
    return { entrada, categoria, descripcio: descriuCategoria(categoria), model };
  }

  /* Entrades del DISC de les quals la paraula és una forma flexionada */
  async function entradesDeFormes(formes) {
    const lemes = [...new Set(formes.map(([, lema]) => lema))];
    const resultats = await Promise.all(lemes.map((lema) => busca(normalitza(lema))));
    const vistes = new Set();
    const entrades = [];
    resultats.forEach(({ entrades: llista }, i) => {
      for (const e of llista) {
        const id = e.join('|');
        if (e[0] === lemes[i] && !vistes.has(id)) {
          vistes.add(id);
          entrades.push(e);
        }
      }
    });
    return entrades;
  }

  async function comencenPer(clau) {
    if (clau.length < 3) return [];
    const dades = await carregaFragment(clau);
    const mots = [];
    for (const [k, entrades] of Object.entries(dades.e)) {
      if (k !== clau && k.startsWith(clau)) {
        for (const [mot] of entrades) mots.push(mot);
        if (mots.length >= MAX_SUGGERIMENTS) break;
      }
    }
    return mots.slice(0, MAX_SUGGERIMENTS);
  }

  /*
   * Retorna:
   *   paraula       el text consultat
   *   estat         "entrada" | "forma" | "no-confirmada" | "no-trobada"
   *   valida        true si és una entrada o una forma d'una entrada del DISC
   *   entrades      entrades del DISC que coincideixen amb la paraula
   *   formes        com s'escriu la forma flexionada (amb accents) i de quines entrades és
   *   corrector     formes que accepta el corrector de Softcatalà sense lligam amb el DISC
   *   suggeriments  entrades que comencen igual (només si no és vàlida)
   */
  async function consulta(paraula) {
    const text = String(paraula || '').trim();
    const clau = normalitza(text);
    const resultat = {
      paraula: text,
      estat: 'no-trobada',
      valida: false,
      entrades: [],
      formes: null,
      corrector: [],
      suggeriments: []
    };
    if (!clau) return resultat;

    const { entrades, formes, corrector } = await busca(clau);
    const lemes = await entradesDeFormes(formes);

    resultat.entrades = entrades.map(descriuEntrada);
    if (lemes.length) {
      resultat.formes = {
        escrites: [...new Set(formes.map(([forma]) => forma))],
        de: lemes.map(descriuEntrada)
      };
    }

    if (entrades.length) resultat.estat = 'entrada';
    else if (lemes.length) resultat.estat = 'forma';
    else if (corrector.length) resultat.estat = 'no-confirmada';
    resultat.valida = resultat.estat === 'entrada' || resultat.estat === 'forma';

    if (resultat.estat === 'no-confirmada') resultat.corrector = corrector;
    if (!resultat.valida) resultat.suggeriments = await comencenPer(clau);
    return resultat;
  }

  const Diccionari = {
    consulta,
    info,
    normalitza,
    descriuCategoria,
    /* Per canviar d'on es llegeixen les dades: Diccionari.configura({ base: 'https://.../dades/' }) */
    configura(opcions) {
      if (opcions && opcions.base) {
        base = opcions.base.endsWith('/') ? opcions.base : opcions.base + '/';
        memoria.clear();
        promesaIndex = null;
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Diccionari;
  else global.Diccionari = Diccionari;
})(typeof globalThis !== 'undefined' ? globalThis : this);
