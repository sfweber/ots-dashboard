/*
 * render-tree.js — Visualización ARTÍSTICA y CONCEPTUAL del camino de Merkle
 * desde tu hash (hoja) hasta la raíz OTS (lo que va al OP_RETURN).
 *
 * Importante: el .ots NO trae el árbol completo (miles de hojas), sino el
 * "authentication path": tu hoja + UN hermano por nivel + la raíz. Eso es lo
 * que se dibuja (técnica estándar de pruebas de Merkle / SPV). Cada hermano es
 * un subárbol colapsado = "otros hashes que no necesitás conocer".
 *
 * Datos: se reconstruyen del recorrido model.rawTimestamp → nodo cuyo result == otsRoot.
 * Cada `sha256` cierra un nivel; los `append`/`prepend` previos son el/los hermano(s)
 * (append = hermano a la derecha, prepend = hermano a la izquierda).
 */
(function (root) {
  'use strict';
  var U = root.OtsUtil;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, children) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (children != null) {
      if (Array.isArray(children)) children.forEach(function (c) { if (c) n.appendChild(c); });
      else if (typeof children === 'string' || typeof children === 'number') n.appendChild(document.createTextNode(String(children)));
      else n.appendChild(children);
    }
    return n;
  }

  // Reconstruye el camino hoja→raíz OTS como lista de niveles.
  // Devuelve [{ siblings:[{side,value}], result }] o null si no se encontró.
  function buildPath(rawTimestamp, otsRoot) {
    var found = null;
    (function walk(node, acc) {
      if (!node || found) return;
      if (node.result === otsRoot) { found = acc.slice(); return; }
      if (Array.isArray(node.ops)) node.ops.forEach(function (op) {
        if (found) return;
        walk(op.timestamp, acc.concat([{ op: op.op, arg: op.arg, result: op.result }]));
      });
    })(rawTimestamp, []);
    if (!found) return null;

    var levels = [], cur = { siblings: [], result: null };
    found.forEach(function (step) {
      if (step.op === 'sha256') { cur.result = step.result; levels.push(cur); cur = { siblings: [], result: null }; }
      else if (step.op === 'append' || step.op === 'prepend') cur.siblings.push({ side: step.op, value: step.arg });
    });
    return levels;
  }

  // model + valor de la raíz OTS → nodo DOM con el SVG del árbol.
  function render(model, otsRoot) {
    var levels = buildPath(model.rawTimestamp, otsRoot);
    if (!levels || !levels.length) {
      return U.el('div', { class: 'tree-viz-note' }, 'No se pudo reconstruir el camino del árbol para esta rama.');
    }

    var N = levels.length;
    var rowH = 40, padTop = 54, padBot = 64;
    var H = padTop + padBot + N * rowH;
    var yTop = padTop, yBottom = padTop + N * rowH;

    function y(k) { return padTop + (N - k) * rowH; }                 // k=0 hoja (abajo), k=N raíz (arriba)
    function nodeResult(k) { return k === 0 ? model.fileHash : levels[k - 1].result; }
    function grow(i) { return N > 1 ? i / (N - 1) : 0; }              // 0 abajo .. 1 arriba
    function dir(i) { return (levels[i].siblings.length && levels[i].siblings[0].side === 'prepend') ? -1 : 1; }
    function dist(i) { return 40 + grow(i) * 120; }                   // separación hijo↔hermano: crece hacia arriba

    // Geometría real de Merkle: el PADRE va al PUNTO MEDIO entre vos y tu hermano.
    // Construyo de la raíz (x=0) hacia abajo: rx[i] = rx[i+1] - dir*step, step = dist/2.
    var rx = new Array(N + 1);
    rx[N] = 0;
    for (var d = N - 1; d >= 0; d--) {
      var hasSib = levels[d].siblings.length > 0;
      rx[d] = rx[d + 1] - (hasSib ? dir(d) * dist(d) / 2 : 0);
    }
    // posiciones de hermanos y extremos (para calcular el viewBox)
    var sx = new Array(N), minX = 0, maxX = 0;
    for (var s = 0; s < N; s++) {
      if (levels[s].siblings.length) {
        sx[s] = rx[s] + dir(s) * dist(s);
        var half = 9 + grow(s) * 40;
        minX = Math.min(minX, sx[s] - half); maxX = Math.max(maxX, sx[s] + half);
      }
      minX = Math.min(minX, rx[s]); maxX = Math.max(maxX, rx[s]);
    }
    var pad = 36, x0 = minX - pad, W = (maxX - minX) + 2 * pad;

    var svg = svgEl('svg', { viewBox: x0 + ' 0 ' + W + ' ' + H, width: W, height: H, class: 'tree-svg' });

    // 0) silueta del árbol (pirámide que converge a la raíz) + base de muchas hojas
    svg.appendChild(svgEl('polygon', {
      points: '0,' + (yTop - 10) + ' ' + (x0 + 6) + ',' + (yBottom + 14) + ' ' + (x0 + W - 6) + ',' + (yBottom + 14),
      class: 'tree-bg'
    }));
    var baseG = svgEl('g', { class: 'leaf-row' });
    for (var bx = x0 + 14; bx <= x0 + W - 14; bx += 13) {
      baseG.appendChild(svgEl('line', { x1: bx, y1: yBottom + 8, x2: bx, y2: yBottom + 16, class: 'leaf-tick' }));
    }
    svg.appendChild(baseG);

    // 1) hermanos (subárboles que CRECEN hacia arriba) + aristas
    for (var i = 0; i < N; i++) {
      var lvl = levels[i];
      var delay = (i * 0.09).toFixed(2) + 's';
      var childY = y(i), parentY = y(i + 1);

      // arista del espinazo (tu nodo → tu siguiente nodo) — se inclina hacia el hermano
      svg.appendChild(svgEl('line', { x1: rx[i], y1: childY, x2: rx[i + 1], y2: parentY, class: 'edge spine', style: 'animation-delay:' + delay }));

      if (lvl.siblings.length) {
        var gg = grow(i), hw = 9 + gg * 40, hgt = 12 + gg * 34;
        var apexY = childY - hgt * 0.5, baseY = childY + hgt * 0.5;
        // arista del hermano (su raíz) → tu siguiente nodo (el padre, en el medio)
        svg.appendChild(svgEl('line', { x1: sx[i], y1: apexY, x2: rx[i + 1], y2: parentY, class: 'edge sib', style: 'animation-delay:' + delay }));
        // subárbol como triángulo (apex arriba = su raíz, base abajo = sus hojas)
        var sg = svgEl('g', { class: 'sib-node', style: 'animation-delay:' + ((i * 0.09 + 0.04).toFixed(2)) + 's' });
        sg.appendChild(svgEl('polygon', {
          points: sx[i] + ',' + apexY + ' ' + (sx[i] - hw) + ',' + baseY + ' ' + (sx[i] + hw) + ',' + baseY,
          class: 'sib-tri'
        }, svgEl('title', null, 'Subárbol vecino (otros hashes): ' + (lvl.siblings[0].value || ''))));
        if (gg > 0.62) {
          sg.appendChild(svgEl('text', { x: sx[i], y: baseY + 12, class: 'sib-label', 'text-anchor': 'middle' }, (i === N - 1) ? 'gran subárbol' : 'subárbol'));
        }
        svg.appendChild(sg);
      }
    }

    // 2) nodos del camino (tu espinazo), encima
    for (var k = 0; k <= N; k++) {
      var ny = y(k), isLeaf = k === 0, isRoot = k === N;
      var ng = svgEl('g', { class: 'path-node' + (isLeaf ? ' leaf' : '') + (isRoot ? ' root' : ''), style: 'animation-delay:' + ((k * 0.09).toFixed(2)) + 's' });
      ng.appendChild(svgEl('circle', { cx: rx[k], cy: ny, r: (isLeaf || isRoot) ? 9 : 4.5, class: 'node-dot' },
        svgEl('title', null, (isLeaf ? 'Tu hash: ' : isRoot ? 'Raíz OTS: ' : 'Nodo intermedio: ') + nodeResult(k))));
      if (isLeaf) ng.appendChild(svgEl('text', { x: rx[k], y: ny + 30, class: 'node-label leaf-label', 'text-anchor': 'middle' }, '📄 vos · ' + U.shortHex(model.fileHash, 6, 4)));
      if (isRoot) ng.appendChild(svgEl('text', { x: rx[k], y: ny - 16, class: 'node-label root-label', 'text-anchor': 'middle' }, '📌 raíz OTS · ' + U.shortHex(otsRoot, 6, 4)));
      svg.appendChild(ng);
    }

    return U.el('div', { class: 'tree-viz-wrap' }, [
      svg,
      U.el('div', { class: 'tree-viz-note' },
        'El árbol converge hacia la raíz: cada ▽ es un subárbol (otros hashes) que se fusiona con tu camino. Cuanto más arriba, más grande el subárbol — el de más arriba abarca buena parte del árbol. Abajo hay miles de hojas; la línea naranja sos vos, de tu hoja a la raíz.')
    ]);
  }

  root.OtsTree = { render: render, buildPath: buildPath };
})(typeof window !== 'undefined' ? window : globalThis);
