(() => {
  'use strict';

  const ESPERA_ESCRIPTURA = 300;

  const formulari = document.getElementById('formulari');
  const camp = document.getElementById('paraula');
  const resultat = document.getElementById('resultat');
  const infoDades = document.getElementById('info-dades');

  let consultaActual = 0;
  let temporitzador = null;

  function element(etiqueta, classe, text) {
    const el = document.createElement(etiqueta);
    if (classe) el.className = classe;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function llistaEntrades(entrades) {
    const ul = element('ul', 'entrades');
    for (const { entrada, descripcio, model } of entrades) {
      const li = element('li');
      li.append(
        element('span', 'mot', entrada),
        element('span', 'categoria', descripcio),
        element('span', 'model', `model flexiu ${model || '—'}`)
      );
      ul.append(li);
    }
    return ul;
  }

  function llistaSuggeriments(mots) {
    const ul = element('ul', 'suggeriments');
    for (const mot of mots) {
      const li = element('li');
      const boto = element('button', null, mot);
      boto.type = 'button';
      boto.addEventListener('click', () => {
        camp.value = mot;
        consulta(mot);
        camp.focus();
      });
      li.append(boto);
      ul.append(li);
    }
    return ul;
  }

  const SIMBOLS = { si: '✔ ', potser: '? ', no: '✘ ' };

  function veredicte(tipus, text, detall) {
    const div = element('div', `veredicte ${tipus}`);
    div.append(SIMBOLS[tipus], element('strong', null, text), ` ${detall}`);
    return div;
  }

  function mostra(r) {
    const nodes = [];

    if (r.estat === 'entrada') {
      nodes.push(veredicte('si', r.paraula, 'és una entrada del diccionari'), llistaEntrades(r.entrades));
    } else if (r.estat === 'forma') {
      nodes.push(veredicte('si', r.paraula, 'és vàlida com a forma flexionada'));
    } else if (r.estat === 'no-confirmada') {
      nodes.push(veredicte('potser', r.paraula, 'no està confirmada pel DISC'));
      const bloc = element('div', 'bloc avis');
      bloc.append(
        element('h2', null, 'Acceptada pel corrector de Softcatalà'),
        element('p', null,
          `«${r.corrector.join(', ')}» existeix al corrector ortogràfic, però no s'ha pogut lligar ` +
          "a cap entrada del DISC. Sol passar amb formes de verbs irregulars (vaig, tinc, sóc…): " +
          "comprova que l'infinitiu sigui al diccionari.")
      );
      nodes.push(bloc);
    } else {
      nodes.push(veredicte('no', r.paraula, 'no és al diccionari'));
    }

    if (r.formes) {
      const bloc = element('div', 'bloc');
      bloc.append(
        element('h2', null, r.estat === 'entrada' ? 'També és una forma flexionada' : 'Forma flexionada'),
        element('p', null, `«${r.formes.escrites.join(', ')}» és una forma de:`),
        llistaEntrades(r.formes.de)
      );
      nodes.push(bloc);
    }

    if (r.suggeriments.length) {
      const bloc = element('div', 'bloc');
      bloc.append(
        element('h2', null, `Entrades que comencen per «${r.paraula}»`),
        llistaSuggeriments(r.suggeriments)
      );
      nodes.push(bloc);
    }

    resultat.replaceChildren(...nodes);
  }

  function actualitzaAdreca(text) {
    const params = new URLSearchParams(location.search);
    if (text) params.set('p', text);
    else params.delete('p');
    const cerca = params.toString();
    history.replaceState(null, '', location.pathname + (cerca ? '?' + cerca : ''));
  }

  async function consulta(text) {
    const numero = ++consultaActual;
    const original = text.trim();
    actualitzaAdreca(original);

    if (!Diccionari.normalitza(original)) {
      resultat.replaceChildren();
      return;
    }

    try {
      const r = await Diccionari.consulta(original);
      if (numero === consultaActual) mostra(r);
    } catch (error) {
      if (numero !== consultaActual) return;
      resultat.replaceChildren(
        veredicte('no', "No s'han pogut carregar les dades", `(${error.message}).`)
      );
    }
  }

  /* ?p=paraula, o #paraula com a les primeres versions */
  function textDesDeAdreca() {
    const p = new URLSearchParams(location.search).get('p');
    if (p) return p;
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return '';
    }
  }

  async function inicia() {
    try {
      const index = await Diccionari.info();
      infoDades.textContent =
        `DISC versió ${index.versio} · ${index.entrades.toLocaleString('ca')} entrades · ` +
        `${index.formes.toLocaleString('ca')} formes flexionades`;
    } catch (error) {
      infoDades.textContent = "No s'han pogut carregar les dades.";
      resultat.replaceChildren(element('div', 'veredicte no',
        location.protocol === 'file:'
          ? 'Cal obrir la pàgina des d’un servidor web (per exemple GitHub Pages o «python -m http.server»), no directament com a fitxer.'
          : `No s'ha pogut carregar l'índex del diccionari (${error.message}).`));
      return;
    }

    const inicial = textDesDeAdreca();
    if (inicial) {
      camp.value = inicial;
      consulta(inicial);
    }
  }

  formulari.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(temporitzador);
    consulta(camp.value);
  });

  camp.addEventListener('input', () => {
    clearTimeout(temporitzador);
    temporitzador = setTimeout(() => consulta(camp.value), ESPERA_ESCRIPTURA);
  });

  window.addEventListener('popstate', () => {
    const text = textDesDeAdreca();
    if (text !== camp.value.trim()) {
      camp.value = text;
      consulta(text);
    }
  });

  inicia();
})();
