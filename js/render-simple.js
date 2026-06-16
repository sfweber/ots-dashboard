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
      tip ? U.tip(tip) : null
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
    var pill, tipText;
    if (branch.kind === 'pending') {
      pill = U.el('span', { class: 'pill pending' }, '⏳ Pendiente');
      tipText = 'El calendar todavía no publicó esta rama en Bitcoin. Suele resolverse en unas horas; después podés actualizar el .ots con "ots upgrade".';
    } else if (branch.kind === 'unknown') {
      pill = U.el('span', { class: 'pill unknown' }, '？ Desconocido');
      tipText = 'El .ots declara un anclaje en una cadena que esta herramienta no reconoce.';
    } else {
      pill = U.el('span', { class: 'pill confirmed' }, '✅ Anclado · bloque ' + branch.blockHeight);
      tipText = 'Este camino ya llegó a Bitcoin: hay una transacción en ese bloque que contiene la raíz del árbol de OpenTimestamps.';
    }
    return U.el('span', { class: 'pill-wrap' }, [pill, U.tip(tipText, { align: 'left' })]);
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
        ? U.el('div', { class: 'verdict ok' }, ['✅ Confirmado contra el bloque real de Bitcoin ',
            U.tip('La merkle root que afirma el .ots coincide con la del bloque real en la cadena: nadie pudo falsificar esa fecha.', { align: 'left' })])
        : U.el('div', { class: 'verdict bad' }, ['⚠️ No coincide con el bloque real de Bitcoin ',
            U.tip('El bloque real tiene otra merkle root: el .ots afirma algo que la cadena no respalda. Puede ser un archivo corrupto o adulterado.', { align: 'left' })]);
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

  // Link a la guía de verificación manual, con los valores de ESTA rama
  // por query params para que el paso a paso muestre "tus números".
  function howtoLink(branch) {
    var qs = 'block=' + encodeURIComponent(branch.blockHeight);
    if (branch.merkleRoot) qs += '&merkle=' + encodeURIComponent(branch.merkleRoot);
    if (branch.txid) qs += '&txid=' + encodeURIComponent(branch.txid);
    if (branch.otsRoot) qs += '&otsroot=' + encodeURIComponent(branch.otsRoot);
    return U.el('a', {
      class: 'howto-link', href: 'howto.html?' + qs, target: '_blank', rel: 'noopener'
    }, '📖 ¿Cómo verificarlo vos mismo?');
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
        rows.push(U.el('div', { class: 'ots-root' }, [
          U.el('div', { class: 'ots-root-label' }, ['📌 Raíz OTS — grabada en Bitcoin (OP_RETURN) ',
            U.tip('Es lo único que OpenTimestamps graba en Bitcoin: la raíz de su árbol, dentro del OP_RETURN de la transacción. Tu hash sube por el árbol hasta acá.', { align: 'left' })]),
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
      rows.push(U.hexField('Bloque', String(branch.blockHeight), {
        href: U.mempoolBlockUrl(branch.blockHeight), head: 12, tail: 12,
        tip: 'El número del bloque de Bitcoin donde quedó grabada la prueba. Cada bloque tiene fecha y hora: de ahí sale el sello de tiempo. Tocá el número para verlo en mempool.space.'
      }));
      if (branch.txid) rows.push(U.hexField('Transacción', branch.txid, {
        href: U.mempoolTxUrl(branch.txid),
        tip: 'La transacción de Bitcoin que transporta la prueba: en su OP_RETURN viaja la raíz OTS. Tocá el ID para verla en mempool.space.'
      }));
      if (branch.merkleRoot) rows.push(U.hexField('Merkle root del bloque', branch.merkleRoot, {
        tip: 'Es lo que recalculás desde el .ots y enfrentás al header del bloque real: la ruta para verificar sin nodo y sin confiar en un explorador. Si coincide con el campo "Merkle Root" del bloque en mempool.space, el sello es auténtico. Es lo que automatiza el botón Verificar.'
      }));
      rows.push(howtoLink(branch));
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

  function anchoredBranches(model) {
    return model.branches.filter(function (b) {
      return b.kind !== 'pending' && b.kind !== 'unknown' && b.blockHeight != null;
    });
  }

  // Puntero al howto, con el texto del banner.
  function verdictHowto(branch) {
    var link = howtoLink(branch);
    link.textContent = '📖 ¿Verificarlo vos mismo? — Cómo verificar un sello';
    return link;
  }

  // Veredicto en lenguaje llano, arriba de todo. Cambia de "afirma" (con el bloque)
  // a "verificado" (con la fecha real) cuando se pulsa Verificar contra Bitcoin:
  // la fecha NO está en el .ots, vive en Bitcoin — el flujo enseña eso.
  function verdictBanner(model) {
    var anchored = anchoredBranches(model);

    // sin anclar todavía
    if (anchored.length === 0) {
      return U.el('div', { class: 'verdict-banner pending' }, [
        U.el('div', { class: 'big' }, '⏳ Este archivo .ots todavía no contiene una prueba en Bitcoin'),
        U.el('div', { class: 'vb-sub' },
          'Lo que ves es el contenido del archivo: por ahora solo guarda el comprobante de un calendar (que recibió tu hash), no una prueba anclada en un bloque. Por sí solo, este archivo no demuestra que haya nada en la cadena. El sello en Bitcoin puede existir o no; cuando el calendar lo ancle, al actualizar el archivo (con "ots upgrade") va a contener el bloque y su fecha.')
      ]);
    }

    var blk = model.earliestBlock;
    var earliest = anchored.filter(function (b) { return b.blockHeight === blk; })[0] || anchored[0];
    var redundant = anchored.length > 1;
    var online = earliest.online;
    var date = (online === 'ok' && root.OtsMempool) ? root.OtsMempool.formatDate(earliest.blockTime) : null;
    var redundTip = 'La fecha probada es la del bloque MÁS ANTIGUO anclado: la más temprana que se puede demostrar. Los bloques posteriores son redundancia, no una fecha "mejor".';

    // verificado, NO coincide
    if (online === 'ok' && !earliest.merkleMatches) {
      return U.el('div', { class: 'verdict-banner bad' }, [
        U.el('div', { class: 'big' }, '⚠️ No coincide con Bitcoin'),
        U.el('div', { class: 'vb-sub' },
          'La merkle root del .ots no coincide con la del bloque #' + blk + ' real: el sello no se pudo confirmar (archivo corrupto o adulterado).')
      ]);
    }

    var children = [];
    var stateClass;

    if (online === 'ok' && earliest.merkleMatches) {
      // verificado OK → ahora SÍ tenemos la fecha
      stateClass = 'confirmed';
      children.push(U.el('div', { class: 'big' }, '✅ Verificado contra Bitcoin'));
      children.push(U.el('div', { class: 'vb-sub' },
        'Queda probado que tu documento ya existía el ' + date + ' —anclado en el bloque #' + blk + ' de Bitcoin—. Nadie puede falsificar esa fecha.'));
      if (redundant) children.push(U.el('div', { class: 'vb-redund muted small' }, [
        'El sello es redundante: llegó por ' + anchored.length + ' caminos; se toma el primero que se minó (#' + blk + ', el ' + date + '). ',
        U.tip(redundTip, { align: 'left' })
      ]));
    } else {
      // claim: tenemos el bloque, pero la fecha vive en Bitcoin
      stateClass = 'claim';
      children.push(U.el('div', { class: 'big' }, '📄 Este archivo .ots afirma —de forma unilateral— que tu documento ya existía'));
      children.push(U.el('div', { class: 'vb-sub' },
        'Lo ancla al bloque #' + blk + ' de Bitcoin, pero por ahora es solo la palabra del archivo: la fecha real vive en Bitcoin, no en el .ots. Tocá "Verificar contra Bitcoin" para confirmarlo y ver la hora exacta.'));
      if (redundant) children.push(U.el('div', { class: 'vb-redund muted small' }, [
        'Llegó por ' + anchored.length + ' caminos independientes; con uno alcanza. Cuenta el más antiguo: bloque #' + blk + '. ',
        U.tip(redundTip, { align: 'left' })
      ]));
    }

    children.push(verdictHowto(earliest));
    return U.el('div', { class: 'verdict-banner ' + stateClass }, children);
  }

  // model -> nodo DOM de la vista Simple.
  function render(model, opts) {
    opts = opts || {};
    return U.el('div', { class: 'simple-view' }, [
      verdictBanner(model),
      docStage(model, opts.matchedDoc),
      hashStage(model),
      forkStage(model),
      calendarsStage(model)
    ]);
  }

  root.OtsRenderSimple = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
