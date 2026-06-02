# 🕒 OTS Dashboard — Analizador de OpenTimestamps

Herramienta web **estática** (un solo HTML, sin servidor, sin build, sin instalar nada) para
**entender y verificar** archivos `.ots` ([OpenTimestamps](https://opentimestamps.org)). Tirás un
`.ots` y muestra, en lenguaje llano, qué prueba — de la huella de tu documento hasta el bloque de
Bitcoin, con una visualización del árbol de Merkle.

Pensada como material educativo (Diplomatura/Microcredencial en Blockchain), apta para proyectar.

> 🔒 **Privacidad:** la huella se calcula en tu navegador. Tus archivos **no se suben** a ningún
> lado. La única salida a internet es opcional (botón "Verificar contra Bitcoin") y solo manda
> números de bloque a mempool.space — nunca tu archivo.

## 🌐 Demo

Si está publicado con GitHub Pages: **https://sfweber.github.io/ots-dashboard/**
*(ajustá la URL a tu usuario/repo de GitHub).*

## ✨ Qué hace

- **Soltás uno o varios `.ots`** (drag & drop o clic). Cada uno se analiza por separado.
- **Vista Simple** — infografía: 📄 documento → 🔑 huella → 🔱 caminos (calendars) → 📌 raíz OTS
  (OP_RETURN) → ⛓️ transacción → ✅ bloque → fecha. Estados ⏳ pendiente / ✅ anclado.
- **Vista Detallada** — el árbol de Merkle completo: espinazo vertical, pasos agrupados y
  etiquetados por tramo, hitos como "estaciones", caminos colapsables.
- **🌳 Visualización del árbol** — gráfico del camino de tu hoja a la raíz OTS, con la geometría
  real de Merkle (los hermanos crecen hacia arriba; el árbol converge a una raíz).
- **Comprobar documento** — soltás el archivo original y calcula su SHA-256 para confirmar que
  coincide con el sello (✅/❌).
- **Verificar contra Bitcoin** — trae la fecha real del bloque desde mempool.space y confirma que
  la *merkle root* del `.ots` coincide con la del bloque real (el paso *trustless*).
- **Copiar IDs** — bloque, txid y raíz OTS, con links directos a mempool.space.

## ▶️ Cómo correrlo

**Local (offline):** abrí `index.html` con doble clic. Todo el análisis funciona sin internet.

**Local con verificación online:** algunos navegadores bloquean peticiones de red desde `file://`.
Si te pasa, serví la carpeta:
```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

**GitHub Pages (recomendado para compartir):** Settings → Pages → Branch `main` / root.
Sobre `https://`, la verificación online anda sin el problema de CORS de `file://`.

## 🧠 Cómo funciona (resumen)

OpenTimestamps prueba que un archivo existía en una fecha, anclándolo en Bitcoin de forma gratuita.
Tu huella sube por el **árbol de un calendar** (junto a miles de otras) hasta una **raíz OTS**, que
se graba en el **OP_RETURN** de una transacción; esa transacción es una hoja del **árbol del
bloque**, cuya *merkle root* queda sellada por la minería. El dashboard reconstruye y dibuja ese
camino directamente desde el `.ots`, en el navegador.

## 📁 Estructura

```
index.html            punto de entrada
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
  app.js              orquestador
```

## 🙏 Créditos y licencias

- Código propio: **MIT** — ver [LICENSE](LICENSE).
- Librerías incluidas (OpenTimestamps, CryptoJS, Moment) — ver [THIRD-PARTY.md](THIRD-PARTY.md).
- Construido sobre [OpenTimestamps](https://opentimestamps.org) y verificación contra
  [mempool.space](https://mempool.space).

## 👤 Autor

**Federico Weber** — material educativo de blockchain.
