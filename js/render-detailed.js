/*
 * render-detailed.js — Árbol de Merkle completo y legible (como `ots info`).
 *
 * Diseño: una CADENA lineal de operaciones se muestra como lista VERTICAL plana
 * (NO anida hacia la derecha). Solo un FORK agrega un nivel de sangría.
 * Las corridas largas de pasos (append/prepend/sha256) se agrupan en un
 * <details> colapsado para no abrumar — la estructura (forks, tx, attestaciones,
 * raíz OTS, bloque) queda siempre a la vista.
 */
(function (root) {
  'use strict';
  var U = root.OtsUtil;

  var OP_CLASS = { append: 'op-append', prepend: 'op-prepend', sha256: 'op-sha', sha1: 'op-sha', ripemd160: 'op-sha' };
  var GROUP_THRESHOLD = 4; // a partir de cuántos pasos seguidos se colapsan
  var MODEL = null;        // modelo en curso (para que renderChain pueda dibujar el árbol)

  // Botón desplegable con la visualización del árbol hoja → raíz OTS.
  function treeButton(otsRoot) {
    if (!MODEL || !root.OtsTree) return null;
    var model = MODEL; // capturar en el closure (multi-archivo: no depender del MODEL global al hacer click)
    var det = U.el('details', { class: 'tree-viz' });
    det.appendChild(U.el('summary', null, '¿Cómo llega tu hash a esta raíz?'));
    var lazy = false;
    det.addEventListener('toggle', function () {
      if (det.open && !lazy) { lazy = true; det.appendChild(root.OtsTree.render(model, otsRoot)); }
    });
    return det;
  }

  // ¿este op es el que reconstruye la tx y deja el OP_RETURN? (prefijo de tx que termina en …6a20)
  function isOpReturnPrepend(op) {
    return op && op.op === 'prepend' && typeof op.arg === 'string' &&
      /^0[12]000000/.test(op.arg) && /6a20$/.test(op.arg);
  }

  function opStep(op, inputResult) {
    var children = [U.el('span', { class: 'op-chip ' + (OP_CLASS[op.op] || '') }, op.op)];
    if (op.arg) {
      children.push(U.el('span', { class: 'op-arg mono', title: op.arg }, U.shortHex(op.arg, 8, 6)));
      children.push(U.copyBtn(function () { return op.arg; }, 'Copiar dato'));
    }
    children.push(U.el('span', { class: 'op-arrow' }, '→'));
    children.push(U.el('span', { class: 'op-result mono', title: op.result }, U.shortHex(op.result, 8, 6)));
    return U.el('div', { class: 'op-step' }, children);
  }

  // Caja de HITO: "estación" centrada sobre el espinazo, con nodo (puntito grande).
  function milestone(typeClass, title, valueChildren, tip) {
    var attrs = { class: 'milestone ' + typeClass };
    if (tip) attrs.title = tip;
    return U.el('div', attrs, [
      U.el('div', { class: 'milestone-title' }, title),
      valueChildren ? U.el('div', { class: 'milestone-value' }, valueChildren) : null
    ]);
  }

  // Resalta la raíz OTS (el mensaje que entra al OP_RETURN) como hito.
  function otsRootMarker(value) {
    return milestone('otsroot', '📌 Raíz OTS → grabada en el OP_RETURN', [
      U.el('span', { class: 'mono', title: value }, U.shortHex(value, 12, 10)),
      U.copyBtn(function () { return value; }, 'Copiar raíz OTS')
    ], 'La raíz del árbol de OpenTimestamps: lo único que se graba en Bitcoin (dentro del OP_RETURN de la transacción).');
  }

  function txMarker(txid) {
    return milestone('tx-marker', '⛓️ Transacción de Bitcoin', [
      U.el('a', { class: 'mono', href: U.mempoolTxUrl(txid), target: '_blank', rel: 'noopener', title: txid }, U.shortHex(txid, 10, 8)),
      U.copyBtn(function () { return txid; }, 'Copiar txid')
    ], 'La transacción que contiene la raíz OTS en su OP_RETURN. Clic para verla en mempool.space.');
  }

  function attestationBox(att, hasContinuation) {
    if (att.type === 'PendingAttestation') {
      if (hasContinuation) {
        // el camino sigue después: es solo el punto de registro del calendar, ya superado
        return milestone('checkpoint', '📅 Calendar ' + U.calendarName(att.param) + ' · registro',
          [U.el('span', { class: 'mono small' }, att.param)],
          'Punto donde el calendar recibió tu hash y se comprometió a anclarlo. El camino continúa hasta Bitcoin: ya está anclado.');
      }
      // es el final del camino: genuinamente sin anclar todavía
      return milestone('pending', '⏳ Pendiente — sin anclar todavía',
        [U.el('span', { class: 'mono small' }, att.param)],
        'Esta rama todavía no fue anclada en Bitcoin: depende de este calendar hasta que se confirme.');
    }
    if (att.type && att.type.indexOf('BlockHeaderAttestation') !== -1) {
      var chain = att.type.replace('BlockHeaderAttestation', '');
      return milestone('confirmed', '✅ ' + chain + ' · bloque ' + att.param,
        att.merkle ? [U.hexField('merkle root del bloque', att.merkle)] : null,
        'Tu prueba quedó anclada en este bloque de Bitcoin.');
    }
    return milestone('unknown', '？ ' + (att.type || 'desconocida'));
  }

  // cuántos niveles de árbol hay en un buffer (= cantidad de hermanos append/prepend)
  function levelsIn(buf) {
    var n = 0;
    buf.forEach(function (o) { if (o.op === 'append' || o.op === 'prepend') n++; });
    return n;
  }

  // Vuelca el buffer de pasos (objetos op): inline si son pocos, colapsado+etiquetado si son muchos.
  function flushSteps(buf, container, label) {
    if (!buf.length) return;
    var nodes = buf.map(opStep);
    // Sin etiqueta y pocos pasos → inline. Con etiqueta → siempre su pill (aunque sea corto).
    if (!label && buf.length <= GROUP_THRESHOLD) {
      nodes.forEach(function (s) { container.appendChild(s); });
    } else {
      var summary = label
        ? label + ' · ' + buf.length + ' pasos'
        : '⋯ ' + buf.length + ' pasos de cómputo (append · prepend · sha256)';
      var det = U.el('details', { class: 'ops-group' });
      det.appendChild(U.el('summary', null, summary));
      nodes.forEach(function (s) { det.appendChild(s); });
      container.appendChild(det);
    }
    buf.length = 0;
  }

  // Mira un subárbol y resume su destino: calendar de origen y bloque final (si ancló).
  function summarizeBranch(tsNode) {
    var cal = null, block = null;
    (function dive(n) {
      if (!n) return;
      if (Array.isArray(n.attestations)) n.attestations.forEach(function (a) {
        if (a.type === 'PendingAttestation' && !cal) cal = U.calendarName(a.param);
        if (a.type && a.type.indexOf('BlockHeaderAttestation') !== -1) block = a.param;
      });
      if (Array.isArray(n.ops)) n.ops.forEach(function (o) { dive(o.timestamp); });
    })(tsNode);
    return { cal: cal, block: block };
  }

  // Renderiza una cadena: itera plano por single-ops; solo bifurca (anida) en forks.
  function renderChain(tsNode, container, initialSteps) {
    var steps = initialSteps ? initialSteps.slice() : []; // buffer de objetos op
    while (tsNode) {
      // hito: attestación → el grupo previo se etiqueta según sea bloque (inclusión) o calendar (prep)
      if (Array.isArray(tsNode.attestations) && tsNode.attestations.length) {
        var isBitcoin = tsNode.attestations.some(function (a) {
          return a.type && a.type.indexOf('BlockHeaderAttestation') !== -1;
        });
        flushSteps(steps, container, isBitcoin
          ? '📦 prueba de inclusión en el bloque (' + levelsIn(steps) + ' niveles)'
          : '🔑 preparar tu hash y enviarlo al calendar');
        var continues = !!(tsNode.ops && tsNode.ops.length);
        tsNode.attestations.forEach(function (a) { container.appendChild(attestationBox(a, continues)); });
      }
      if (tsNode.tx) {
        flushSteps(steps, container, '🧾 envolver la raíz OTS en la transacción');
        container.appendChild(txMarker(tsNode.tx));
      }

      var ops = tsNode.ops || [];
      if (ops.length === 0) {
        flushSteps(steps, container, null);
        tsNode = null;
      } else if (ops.length === 1) {
        // si este op deja el OP_RETURN, el mensaje de ENTRADA (tsNode.result) es la raíz OTS
        if (isOpReturnPrepend(ops[0])) {
          flushSteps(steps, container, '🌳 subir el árbol del calendar (tu hash + miles más)');
          container.appendChild(otsRootMarker(tsNode.result));
          var tb = treeButton(tsNode.result);
          if (tb) container.appendChild(tb);
        }
        steps.push(ops[0]);
        tsNode = ops[0].timestamp; // seguir plano, sin anidar
      } else {
        // FORK: única situación que agrega un nivel de sangría
        flushSteps(steps, container, null);
        container.appendChild(U.el('div', { class: 'fork-label' }, '🔱 Se divide en ' + ops.length + ' caminos'));
        ops.forEach(function (op, i) {
          var info = summarizeBranch(op.timestamp);
          var label = 'Camino ' + (i + 1) + (info.cal ? ' · ' + info.cal : '') +
            (info.block != null ? '  ✅ bloque ' + info.block : '  ⏳ pendiente');
          var det = U.el('details', { class: 'fork-branch' }); // contraído por defecto
          det.appendChild(U.el('summary', null, label));
          var inner = U.el('div', { class: 'tree-node' });
          renderChain(op.timestamp, inner, [op]); // el 1er op de la rama abre su buffer
          det.appendChild(inner);
          container.appendChild(det);
        });
        tsNode = null;
      }
    }
  }

  function render(model) {
    MODEL = model;
    var root_ = U.el('div', { class: 'detailed-view' });
    root_.appendChild(U.el('div', { class: 'tree-start' }, [
      U.el('span', { class: 'op-chip op-hash' }, (model.hashAlgo || 'sha256')),
      U.el('span', { class: 'mono', title: model.fileHash }, U.shortHex(model.fileHash, 12, 10)),
      U.el('span', { class: 'muted small' }, ' (hash del documento)')
    ]));
    var body = U.el('div', { class: 'tree-body' });
    root_.appendChild(body);
    renderChain(model.rawTimestamp, body);
    return root_;
  }

  root.OtsRenderDetailed = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
