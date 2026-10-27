"""
Converteix DISC2-Compacte.txt en fitxers JSON petits per a la web estàtica.

Cada línia del diccionari té el format  entrada|categoria|model_flexiu.
Les entrades s'agrupen per les tres primeres lletres de la clau normalitzada
(sense accents, sense ·, guionets ni apòstrofs), de manera que el navegador
només descarrega el fitxer que necessita: docs/dades/a/ba.json, docs/dades/c/as.json...
(carpeta per la primera lletra perquè Windows no admet fitxers com aux.json o con.json).

Les formes flexionades (plurals, femenins, temps verbals) s'obtenen del diccionari
Hunspell de Softcatalà (fonts/hunspell/ca.aff i ca.dic): s'expandeixen totes les
formes de cada arrel i només es conserven les famílies que corresponen a una
entrada del DISC.

Les formes del corrector que no es poden lligar a cap entrada (sobretot formes de
verbs irregulars com «vaig» o «tinc», que el .dic llista soltes) es guarden a part
perquè la web les mostri com a «acceptades pel corrector, no confirmades pel DISC».

Format de cada fitxer:
    {"e": {clau: [[entrada, categoria, model], ...]},
     "f": {clau: [[forma, entrada], ...]},
     "c": {clau: [forma, ...]}}

Ús (des de la carpeta diccionari):
    python eines/genera_json.py
"""

import json
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
ORIGEN = ARREL / "DISC2-Compacte.txt"
LLEGEIX_ME = ARREL / "readme.txt"
HUNSPELL = ARREL / "fonts" / "hunspell"
DESTI = ARREL / "docs" / "dades"


def normalitza(paraula: str) -> str:
    """Ha de fer exactament el mateix que normalitza() de docs/js/app.js."""
    p = unicodedata.normalize("NFD", paraula.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", p)


def fragment(clau: str) -> str:
    return (clau + "__")[:3]


def sense_pronom(entrada: str) -> str:
    """abacallanar-se -> abacallanar, desviure's -> desviure (el .dic no porta el pronom)."""
    return re.sub(r"(-se|'s)$", "", entrada)


def llegeix_disc():
    entrades = defaultdict(list)
    with ORIGEN.open(encoding="utf-8") as f:
        for num, linia in enumerate(f, 1):
            linia = linia.strip()
            if not linia:
                continue
            parts = linia.split("|")
            if len(parts) != 3:
                print(f"Línia {num} ignorada: {linia!r}")
                continue
            entrada, categoria, model = parts
            entrada = entrada.replace("’", "'")
            clau = normalitza(entrada)
            if not clau:
                print(f"Línia {num} sense lletres: {linia!r}")
                continue
            entrades[clau].append([entrada, categoria, model])
    return entrades


def llegeix_sufixos(fitxer: Path):
    """Regles SFX del .aff. Els prefixos (l', d', s'...) i els pronoms enclítics
    (-ne, -me...) no es fan servir: no són paraules vàlides al joc."""
    sufixos = defaultdict(list)
    for linia in fitxer.open(encoding="utf-8"):
        parts = linia.split()
        if len(parts) < 5 or parts[0] != "SFX":
            continue
        senyal, treu, afegeix, condicio = parts[1], parts[2], parts[3], parts[4]
        afegeix, _, continuacio = afegeix.partition("/")
        treu = "" if treu == "0" else treu
        afegeix = "" if afegeix == "0" else afegeix
        if "-" in afegeix or "'" in afegeix:
            continue
        patro = None if condicio == "." else re.compile(f"(?:{condicio})$")
        sufixos[senyal].append((treu, afegeix, continuacio, patro))
    return sufixos


def expandeix(mot, senyals, sufixos, nivell=0):
    yield mot
    if nivell > 2:
        return
    for senyal in senyals:
        for treu, afegeix, continuacio, patro in sufixos.get(senyal, ()):
            if patro and not patro.search(mot):
                continue
            if treu and not mot.endswith(treu):
                continue
            nou = mot[: len(mot) - len(treu)] + afegeix
            yield from expandeix(nou, continuacio, sufixos, nivell + 1)


def llegeix_formes(entrades):
    """Retorna ({clau: {(forma, entrada), ...}}, {clau: {forma, ...}}): les formes
    de famílies del .dic que corresponen a una entrada del DISC i la resta."""
    formes = defaultdict(set)
    altres = defaultdict(set)
    aff, dic = HUNSPELL / "ca.aff", HUNSPELL / "ca.dic"
    if not (aff.exists() and dic.exists()):
        print(f"No s'ha trobat {aff} o {dic}: només s'inclouran les entrades.")
        return formes, altres

    per_base = defaultdict(list)    # clau sense pronom -> entrades del DISC
    verbs = defaultdict(list)       # el mateix, només verbs
    for llista in entrades.values():
        for entrada, categoria, _ in llista:
            base = normalitza(sense_pronom(entrada))
            per_base[base].append(entrada)
            if "v." in categoria:
                verbs[base].append(entrada)

    sufixos = llegeix_sufixos(aff)
    with dic.open(encoding="utf-8") as f:
        next(f)  # nombre d'arrels
        for linia in f:
            arrel, _, senyals = linia.strip().partition("/")
            if not re.fullmatch(r"[a-zàèéíïòóúüç·'-]+", arrel):
                continue  # noms propis, abreviatures, números
            familia = set(expandeix(arrel, senyals, sufixos))
            # La família és d'una entrada del DISC si l'arrel ho és (noms, adjectius)
            # o si alguna forma és l'infinitiu d'un verb del DISC.
            lemes = set(per_base.get(normalitza(arrel), ()))
            for forma in familia:
                lemes.update(verbs.get(normalitza(forma), ()))
            for forma in familia:
                clau = normalitza(forma)
                if not lemes:
                    altres[clau].add(forma)
                for lema in lemes:
                    if clau != normalitza(lema):
                        formes[clau].add((forma, lema))

    for clau in [c for c in altres if c in entrades or c in formes]:
        del altres[clau]
    return formes, altres


def main() -> None:
    entrades = llegeix_disc()
    formes, altres = llegeix_formes(entrades)

    grups = defaultdict(lambda: {"e": {}, "f": {}, "c": {}})
    for clau, llista in entrades.items():
        grups[fragment(clau)]["e"][clau] = llista
    for clau, parelles in formes.items():
        grups[fragment(clau)]["f"][clau] = [list(p) for p in sorted(parelles)]
    for clau, mots in altres.items():
        grups[fragment(clau)]["c"][clau] = sorted(mots)

    if DESTI.exists():
        shutil.rmtree(DESTI)
    DESTI.mkdir(parents=True)

    for nom, dades in grups.items():
        dades = {k: dict(sorted(v.items())) for k, v in dades.items()}
        fitxer = DESTI / nom[0] / f"{nom[1:]}.json"
        fitxer.parent.mkdir(exist_ok=True)
        with fitxer.open("w", encoding="utf-8") as f:
            json.dump(dades, f, ensure_ascii=False, separators=(",", ":"))

    versio = ""
    if LLEGEIX_ME.exists():
        m = re.search(r"versió\s+([\d.]+\s*-\s*[\d/]+)", LLEGEIX_ME.read_text(encoding="utf-8"))
        versio = m.group(1) if m else ""

    total = sum(len(llista) for llista in entrades.values())
    index = {
        "versio": versio,
        "generat": date.today().isoformat(),
        "entrades": total,
        "formes": len(formes),
        "corrector": len(altres),
        "fragments": sorted(grups),
    }
    with (DESTI / "index.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    mides = sorted(((p.stat().st_size, p.relative_to(DESTI).as_posix()) for p in DESTI.rglob("*.json")), reverse=True)
    print(f"{total} entrades, {len(formes)} formes flexionades i {len(altres)} formes només del corrector")
    print(f"{len(grups)} fitxers a {DESTI}")
    print("Fitxers més grans:", ", ".join(f"{n} ({m // 1024} KB)" for m, n in mides[:5]))


if __name__ == "__main__":
    main()
