/*
 * render-simple.js — Infografía pedagógica (lenguaje llano) de un OtsModel.
 * Flujo vertical: 📄 documento → 🔑 hash → 🔱 caminos → 📅 calendars/bloques → 📅 resultado.
 * Devuelve un nodo DOM. No toca la red (los datos online ya vienen en el modelo si se enriqueció).
 */
(function (root) {
  'use strict';
  var U = root.OtsUtil;

  function stage(icon, title, bodyChildren, tip) {
    var head = root.OtsUtil.el('div', { class: 'stage-head' }, [
      U.el('span', { class: 'stage-icon' }, icon),
      U.el('span', { class: 'stage-title' }, title),
      tip ? U.el('span', { class: 'tip', title: tip }, 'ⓘ') : null
    ]);
    return U.el('div', { class: 'stage' }, [head, U.el('div', { class: 'stage-body' }, bodyChildren)]);
  }

  function docStage(model, matchedDoc) {
    var children = [
      U.el('div', { class: 'doc-line' }, [
        U.el('span', { class: 'doc-name' }, model.fileName ? model.fileName.replace(/\.ots$/, '') : 'documento sellado'),
        model.fileSizeBytes != null ? U.el('span', { class: 'muted' }, '') : null
      ])
    ];
    if (matchedDoc) {
      if (matchedDoc.matches) {
        children.push(U.el('div', { class: 'match ok' }, [
          U.el('span', null, '✅ El documento que soltaste coincide con el sello'),
          U.el('div', { class: 'muted small' }, matchedDoc.name)
        ]));
      } else {
        children.push(U.el('div', { class: 'match bad' }, [
          U.el('span', null, '❌ El documento NO coincide con este sello'),
          U.el('div', { class: 'muted small' }, matchedDoc.name + ' — su hash es distinto')
        ]));
      }
    } else {
      children.push(U.el('div', { class: 'hint-inline' },
        'Soltá también el documento original (el archivo, no el .ots) para comprobar que su hash coincide.'));
    }
    return stage('📄', 'El documento', children,
      'OpenTimestamps no prueba el contenido ni el autor: prueba que ESTE archivo exacto existía en una fecha.');
  }

  function hashStage(model) {
    return stage('🔑', 'Su hash (' + (model.hashAlgo || 'sha256').toUpperCase() + ')', [
      U.hexField('Hash', model.fileHash, { head: 16, tail: 12 }),
      U.el('div', { class: 'muted small' }, 'Un hash único del archivo. Si cambiás una sola coma, cambia por completo.')
    ], 'El navegador calcula este hash localmente: tu archivo nunca se sube a ningún lado.');
  }

  function forkStage(model) {
    var n = model.branches.length;
    return stage('🔱', 'Se registró en ' + n + (n === 1 ? ' camino' : ' caminos'), [
      U.el('div', { class: 'muted small' },
        'Tu hash se mandó a ' + n + ' servidor(es) "calendar" independientes. Con que UNO llegue a Bitcoin, ya está probado; tener varios es redundancia.')
    ], 'Cada calendar junta miles de hashes de mucha gente en un árbol y publica una sola transacción en Bitcoin.');
  }

  function statusPill(branch) {
    if (branch.kind === 'pending') return U.el('span', { class: 'pill pending' }, '⏳ Pendiente');
    if (branch.kind === 'unknown') return U.el('span', { class: 'pill unknown' }, '？ Desconocido');
    return U.el('span', { class: 'pill confirmed' }, '✅ Anclado · bloque ' + branch.blockHeight);
  }

  function onlineArea(branch) {
    if (branch.kind === 'pending') {
      return U.el('div', { class: 'muted small' }, 'Esperando que el calendar lo ancle en Bitcoin.');
    }
    if (branch.online === 'loading') {
      return U.el('div', { class: 'online loading' }, [U.el('span', { class: 'spinner' }), 'Consultando mempool.space…']);
    }
    if (branch.online === 'ok') {
      var date = root.OtsMempool ? root.OtsMempool.formatDate(branch.blockTime) : null;
      var match = branch.merkleMatches
        ? U.el('div', { class: 'verdict ok', title: 'La merkle root del bloque que afirma el .ots coincide con la del bloque real en la cadena.' }, '✅ Confirmado contra el bloque real de Bitcoin')
        : U.el('div', { class: 'verdict bad' }, '⚠️ No coincide con el bloque real de Bitcoin');
      return U.el('div', { class: 'online ok' }, [
        date ? U.el('div', { class: 'date' }, '📅 ' + date) : null,
        match
      ]);
    }
    if (branch.online === 'error') {
      return U.el('div', { class: 'online error' },
        'No se pudo verificar online (sin conexión o bloqueo del navegador). El sello sigue siendo válido offline.');
    }
    return null; // idle: aún no se pidió verificación
  }

  function treeButton(model, otsRoot) {
    if (!otsRoot || !root.OtsTree) return null;
    var det = U.el('details', { class: 'tree-viz' });
    det.appendChild(U.el('summary', null, '¿Cómo llega tu hash a esta raíz?'));
    var lazy = false;
    det.addEventListener('toggle', function () {
      if (det.open && !lazy) { lazy = true; det.appendChild(root.OtsTree.render(model, otsRoot)); }
    });
    return det;
  }

  function branchCard(branch, model) {
    var rows = [
      U.el('div', { class: 'branch-top' }, [
        U.el('span', { class: 'cal-name' }, '📅 ' + U.calendarName(branch.calendarUri)),
        statusPill(branch)
      ])
    ];
    if (branch.kind !== 'pending' && branch.blockHeight != null) {
      // ⭐ Lo más importante: la raíz del árbol de OTS, que es lo ÚNICO que se graba en Bitcoin.
      if (branch.otsRoot) {
        rows.push(U.el('div', {
          class: 'ots-root',
          title: 'Es lo único que OpenTimestamps graba en Bitcoin: la raíz de su árbol, dentro del OP_RETURN de la transacción. Tu hash sube por el árbol hasta acá.'
        }, [
          U.el('div', { class: 'ots-root-label' }, '📌 Raíz OTS — grabada en Bitcoin (OP_RETURN)'),
          U.el('div', { class: 'field' }, [
            U.el('a', {
              class: 'mono', href: U.mempoolTxUrl(branch.txid), target: '_blank', rel: 'noopener',
              title: branch.otsRoot + '  (ver OP_RETURN en la transacción)'
            }, U.shortHex(branch.otsRoot, 14, 10)),
            U.copyBtn(function () { return branch.otsRoot; }, 'Copiar raíz OTS')
          ])
        ]));
        var tb = treeButton(model, branch.otsRoot);
        if (tb) rows.push(tb);
      }
      rows.push(U.hexField('Bloque', String(branch.blockHeight), { href: U.mempoolBlockUrl(branch.blockHeight), head: 12, tail: 12 }));
      if (branch.txid) rows.push(U.hexField('Transacción', branch.txid, { href: U.mempoolTxUrl(branch.txid) }));
    }
    rows.push(onlineArea(branch));
    return U.el('div', { class: 'branch ' + branch.kind }, rows);
  }

  function calendarsStage(model) {
    var cards = model.branches.map(function (b) { return branchCard(b, model); });
    return stage('⛓️', 'Los caminos hacia Bitcoin', [
      U.el('div', { class: 'branches' }, cards)
    ], 'Cada camino termina en una transacción de Bitcoin (✅) o sigue esperando en el calendar (⏳).');
  }

  function resultStage(model) {
    var children = [];
    var blk = model.earliestBlock;
    if (model.status === 'pending') {
      children.push(U.el('div', { class: 'result pending' },
        '⏳ Todavía sin anclar en Bitcoin. La prueba existe pero depende de los calendars hasta que se confirme (suele tardar unas horas).'));
    } else {
      var earliest = model.branches.filter(function (b) { return b.blockHeight === blk; })[0];
      var online = earliest && earliest.online;
      var date = (online === 'ok' && root.OtsMempool) ? root.OtsMempool.formatDate(earliest.blockTime) : null;
      var msg = date
        ? 'Queda probado que el documento ya existía el ' + date + ', en el bloque ' + blk + '.'
        : 'Queda probado que el documento ya existía al minarse el bloque ' + blk + '.';

      if (online === 'ok' && earliest.merkleMatches) {
        // verificado contra la cadena
        children.push(U.el('div', { class: 'result confirmed' }, [
          U.el('div', { class: 'big' }, '✅ Verificado en Bitcoin'),
          U.el('div', null, msg),
          model.status === 'partial' ? U.el('div', { class: 'muted small' }, 'Alcanza con una rama anclada; las demás siguen pendientes.') : null
        ]));
      } else if (online === 'ok' && !earliest.merkleMatches) {
        // se verificó pero NO coincide
        children.push(U.el('div', { class: 'result bad' }, [
          U.el('div', { class: 'big' }, '⚠️ No coincide con Bitcoin'),
          U.el('div', null, 'La merkle root del .ots no coincide con la del bloque ' + blk + ' real: el sello no se pudo confirmar.')
        ]));
      } else {
        // aún NO verificado contra la cadena → es una afirmación del archivo, sin tilde verde
        children.push(U.el('div', { class: 'result claim' }, [
          U.el('div', { class: 'big' }, 'Anclado en el bloque ' + blk + ' — según el .ots'),
          U.el('div', null, 'El archivo afirma que el documento ya existía cuando se minó el bloque ' + blk + '.'),
          U.el('div', { class: 'muted small' }, 'Todavía sin comprobar contra la cadena. Pulsá "Verificar contra Bitcoin" para confirmarlo y traer la fecha real.')
        ]));
      }
    }
    return stage('🏁', 'Qué prueba', children,
      'La fecha probada es la del bloque MÁS ANTIGUO anclado: es la fecha más temprana que se puede demostrar. Los bloques posteriores son redundancia, no una fecha "mejor".');
  }

  // model -> nodo DOM de la vista Simple.
  function render(model, opts) {
    opts = opts || {};
    return U.el('div', { class: 'simple-view' }, [
      docStage(model, opts.matchedDoc),
      hashStage(model),
      forkStage(model),
      calendarsStage(model),
      resultStage(model)
    ]);
  }

  root.OtsRenderSimple = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
