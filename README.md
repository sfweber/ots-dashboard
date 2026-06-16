# OTS Dashboard — Analizador de OpenTimestamps

Herramienta web **estática** (sin servidor, sin build, sin instalar nada) para **entender** un
archivo `.ots` de [OpenTimestamps](https://opentimestamps.org). Soltás un `.ots` y muestra, en
lenguaje llano y con una visualización del árbol de Merkle, qué prueba — del hash de tu documento
hasta el bloque de Bitcoin. Nació como material para una diplomatura de blockchain.

> **Privacidad:** el hash se calcula en tu navegador. Tus archivos **no se suben** a ningún lado.
> La única salida a internet es opcional (botón "Verificar contra Bitcoin") y solo manda números
> de bloque a mempool.space — nunca tu archivo.

## Demo

https://sfweber.github.io/ots-dashboard/

## Qué agrega frente a la web oficial

La web oficial ([opentimestamps.org](https://opentimestamps.org)) y el cliente `ots` son las
herramientas reales: **crean** sellos y los **verifican**. Este dashboard **no las reemplaza** y
**no crea sellos** — es una **lente educativa**: abre un `.ots` ya hecho y muestra, de forma visual
y paso a paso, qué contiene y cómo la prueba llega a Bitcoin. Lo que con el cliente verías como
texto crudo (`ots info`), acá se ve dibujado.

## Qué hace

- **Soltás un `.ots`** (drag & drop o clic). Se analiza uno a la vez.
- **Vista Simple** — infografía del flujo: documento → hash → caminos (calendars) → raíz OTS
  (OP_RETURN) → transacción → bloque → fecha. Estados pendiente / anclado.
- **Vista Detallada** — el árbol de Merkle completo, con los pasos agrupados y etiquetados por tramo.
- **Visualización del árbol** — el camino de tu hoja a la raíz OTS, con la geometría real de Merkle.
- **Comprobar documento** — soltás el archivo original y calcula su SHA-256 para confirmar que
  coincide con el sello.
- **Verificar contra Bitcoin** — trae la fecha real del bloque desde mempool.space y confirma que la
  *merkle root* del `.ots` coincide con la del bloque real.
- **Guía de verificación manual** (`howto.html`) — cómo comprobar el sello a mano, en tres niveles
  de confianza: con un explorador, con tu propio nodo, o solo con matemática y las cabeceras de Bitcoin.
- **Copiar IDs** — bloque, txid y raíz OTS, con links directos a mempool.space.

## Cómo funciona (resumen)

OpenTimestamps prueba que un archivo existía en una fecha, anclándolo en Bitcoin de forma gratuita.
Tu hash sube por el **árbol de un calendar** (junto a miles de otros) hasta una **raíz OTS**, que se
graba en el **OP_RETURN** de una transacción; esa transacción es una hoja del **árbol del bloque**,
cuya *merkle root* queda sellada por la minería. El `.ots` es autocontenido: trae todo ese camino
adentro, y lo único que hace falta de afuera para verificar es la cabecera del bloque. El dashboard
reconstruye y dibuja ese camino directamente desde el `.ots`, en el navegador.

## Estructura

```
index.html            punto de entrada
howto.html            guía de verificación manual (3 niveles de confianza)
css/styles.css        estilos
assets/               librerías de terceros (locales) — ver THIRD-PARTY.md
js/
  util.js             helpers de DOM / copiar / links
  parser.js           .ots -> modelo normalizado (núcleo, offline)
  hash.js             SHA-256 del documento original
  mempool.js          verificación online (mempool.space / blockstream)
  render-simple.js    vista Simple
  render-detailed.js  vista Detallada
  render-tree.js      visualización del árbol de Merkle
  howto.js            rellena la guía con tus valores + solapas
  app.js              orquestador
```

## Créditos y licencias

- Código propio: **MIT** — ver [LICENSE](LICENSE).
- Librerías incluidas (OpenTimestamps, CryptoJS) — ver [THIRD-PARTY.md](THIRD-PARTY.md).
- Construido sobre [OpenTimestamps](https://opentimestamps.org) y verificación contra
  [mempool.space](https://mempool.space).

## Autor

**Federico Weber** — material educativo de blockchain.
