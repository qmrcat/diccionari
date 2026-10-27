(() => {
  'use strict';

  const sortida = document.getElementById('json');
  const ajuda = document.getElementById('ajuda');

  /* ?p=casa&p=cases o ?p=casa,cases */
  function paraulesDeAdreca() {
    return new URLSearchParams(location.search)
      .getAll('p')
      .flatMap((p) => p.split(','))
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function escriu(dades) {
    sortida.textContent = JSON.stringify(dades, null, 2);
    sortida.hidden = false;
  }

  async function inicia() {
    const paraules = paraulesDeAdreca();

    if (!paraules.length) {
      const base = new URL('./', location.href).href;
      for (const el of document.querySelectorAll('.url-base')) el.textContent = base;
      ajuda.hidden = false;
      return;
    }

    document.title = `${paraules.join(', ')} · API Consulta DISC`;
    try {
      const resultats = await Promise.all(paraules.map((p) => Diccionari.consulta(p)));
      escriu(resultats.length === 1 ? resultats[0] : resultats);
    } catch (error) {
      escriu({ error: error.message });
    }
  }

  inicia();
})();
