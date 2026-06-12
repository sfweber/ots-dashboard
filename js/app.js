/*
 * app.js — Orquestador del dashboard.
 * - Espera a que cargue la librería OpenTimestamps.
 * - Drag&drop / file picker (UN .ots a la vez + opcionalmente su documento original).
 * - Detecta .ots (por magic header) -> parsea -> tarjeta. Otros -> documento -> hash + match.
 * - Un nuevo .ots reemplaza el análisis anterior (documento incluido).
 * - Toggle global de vista Simple/Detallado.
 * - Botón por tarjeta "Verificar contra Bitcoin" (enriquecimiento online).
 */
(function (root) {
  'use strict';
  var U = root.OtsUtil;

  var state = { items: [], docs: [], view: 'simple', seq: 0 };
  var dom = {};

  // ---- arranque ----
  function boot() {
    dom.drop = document.getElementById('dropzone');
    dom.fileInput = document.getElementById('file-input');
    dom.results = document.getElementById('results');
    dom.empty = document.getElementById('empty-state');
    dom.toolbar = document.getElementById('toolbar');
    dom.btnSimple = document.getElementById('view-simple');
    dom.btnDetailed = document.getElementById('view-detailed');
    dom.btnClear = document.getElementById('btn-clear');
    dom.status = document.getElementById('lib-status');

    wireDnD();
    wireToolbar();
    waitForLib();
  }

  function waitForLib() {
    var tries = 0;
    (function check() {
      if (root.OpenTimestamps && typeof root.OpenTimestamps.json === 'function') {
        dom.status.textContent = '';
        dom.status.classList.add('ready');
        dom.drop.classList.remove('disabled');
        return;
      }
      if (tries++ > 120) { // ~12s
        dom.status.textContent = '⚠️ No se pudo cargar la librería OpenTimestamps (revisá assets/).';
        return;
      }
      dom.status.textContent = 'Cargando librerías…';
      setTimeout(check, 100);
    })();
  }

  // ---- drag & drop ----
  function wireDnD() {
    ['dragenter', 'dragover'].forEach(function (ev) {
      dom.drop.addEventListener(ev, function (e) { e.preventDefault(); dom.drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dom.drop.addEventListener(ev, function (e) { e.preventDefault(); dom.drop.classList.remove('over'); });
    });
    dom.drop.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files) handleFiles(files);
    });
    dom.drop.addEventListener('click', function () { dom.fileInput.click(); });
    dom.fileInput.addEventListener('change', function () {
      if (dom.fileInput.files) handleFiles(dom.fileInput.files);
      dom.fileInput.value = '';
    });
    // permitir soltar en toda la ventana una vez que hay resultados
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      if (dom.drop.contains(e.target)) return; // el dropzone ya lo maneja
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
  }

  function wireToolbar() {
    dom.btnSimple.addEventListener('click', function () { setView('simple'); });
    dom.btnDetailed.addEventListener('click', function () { setView('detailed'); });
    dom.btnClear.addEventListener('click', clearAll);
  }

  function setView(v) {
    state.view = v;
    dom.btnSimple.classList.toggle('active', v === 'simple');
    dom.btnDetailed.classList.toggle('active', v === 'detailed');
    state.items.forEach(renderCardBody);
  }

  function resetAnalysis() {
    state.items = [];
    state.docs = [];
    dom.results.innerHTML = '';
  }

  function clearAll() {
    resetAnalysis();
    refreshChrome();
  }

  // ---- manejo de archivos ----
  // Se analiza UN .ots a la vez: del lote soltado se toma el primer .ots y el
  // primer documento (no-.ots); el resto se ignora con aviso.
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    Promise.all(files.map(function (file) {
      return readArrayBuffer(file).then(function (buf) {
        return { file: file, buf: buf };
      }).catch(function (err) {
        addError(file.name, 'No se pudo leer el archivo: ' + err.message);
        return null;
      });
    })).then(function (read) {
      var ots = null, doc = null, extraOts = 0, extraDocs = 0;
      read.forEach(function (r) {
        if (!r) return;
        if (isOtsBuffer(r.buf)) {
          if (!ots) ots = r; else extraOts++;
        } else {
          if (!doc) doc = r; else extraDocs++;
        }
      });
      // un solo toast combinado (reemplazo + ignorados), para que no se pisen
      var msgs = [];
      if (ots && state.items.length > 0) msgs.push('Análisis anterior reemplazado.');
      if (extraOts || extraDocs) {
        var parts = [];
        if (extraOts) parts.push(extraOts + ' .ots');
        if (extraDocs) parts.push(extraDocs + ' documento(s)');
        msgs.push('Se analiza un .ots a la vez: se ignoraron ' + parts.join(' y ') + ' extra.');
      }
      if (msgs.length) toast(msgs.join(' '));
      // Primero el .ots (puede resetear el análisis anterior); después el doc,
      // cuyo re-match actualiza la tarjeta ya renderizada.
      if (ots) addOts(ots.file, ots.buf);
      if (doc) addDoc(doc.file, doc.buf);
    });
  }

  function readArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('lectura fallida')); };
      fr.readAsArrayBuffer(file);
    });
  }

  // ¿Los bytes empiezan con el magic header de OpenTimestamps?  \x00 "OpenTimestamps"
  function isOtsBuffer(buf) {
    var u8 = new Uint8Array(buf, 0, Math.min(20, buf.byteLength));
    var magic = 'OpenTimestamps';
    for (var i = 0; i < magic.length; i++) {
      if (u8[i + 1] !== magic.charCodeAt(i)) return false;
    }
    return true;
  }

  function addOts(file, buf) {
    var model;
    try {
      model = root.OtsParser.parseBytes(buf, file.name, file.size);
    } catch (err) {
      addError(file.name, err.message);
      return;
    }
    // Un .ots a la vez: el nuevo reemplaza el análisis anterior (y su documento).
    // El aviso al usuario lo da handleFiles (toast combinado).
    if (state.items.length > 0) resetAnalysis();
    var item = { id: ++state.seq, model: model, matchedDoc: null, verifying: false, card: null };
    // ¿ya teníamos el documento original?
    var doc = findDocForHash(model.fileHash);
    if (doc) item.matchedDoc = { name: doc.name, hash: doc.hash, matches: true };
    state.items.push(item);
    buildCard(item);
    refreshChrome();
  }

  function addDoc(file, buf) {
    root.OtsHash.sha256Hex(buf).then(function (hex) {
      hex = hex.toLowerCase();
      // Un documento a la vez: el nuevo reemplaza al anterior.
      var replaced = state.docs.length > 0;
      state.docs = [{ name: file.name, hash: hex }];
      if (replaced) toast('Documento anterior reemplazado.');
      // si la tarjeta tenía match con el doc viejo, recalcular
      state.items.forEach(function (item) {
        if (item.matchedDoc && item.model.fileHash && item.model.fileHash.toLowerCase() !== hex) {
          item.matchedDoc = null;
          renderCardBody(item);
        }
      });
      // actualizar tarjetas que matcheen
      var matchedAny = false;
      state.items.forEach(function (item) {
        if (item.model.fileHash && item.model.fileHash.toLowerCase() === hex) {
          item.matchedDoc = { name: file.name, hash: hex, matches: true };
          renderCardBody(item);
          matchedAny = true;
        }
      });
      if (!matchedAny) toast('Documento "' + file.name + '" cargado. Soltá su .ots para comprobar la coincidencia.');
    }).catch(function (err) {
      addError(file.name, 'No se pudo calcular el hash: ' + err.message);
    });
  }

  function findDocForHash(hash) {
    if (!hash) return null;
    hash = hash.toLowerCase();
    for (var i = 0; i < state.docs.length; i++) {
      if (state.docs[i].hash === hash) return state.docs[i];
    }
    return null;
  }

  // ---- tarjetas ----
  function statusBadge(model) {
    var badge, tipText;
    if (model.status === 'confirmed') {
      badge = U.el('span', { class: 'badge confirmed' }, '✅ Confirmado');
      tipText = 'Todos los caminos del sello ya están anclados en Bitcoin.';
    } else if (model.status === 'partial') {
      badge = U.el('span', { class: 'badge partial' }, '🟡 Parcial');
      tipText = 'Al menos un camino llegó a Bitcoin — con uno alcanza para probar la fecha; el resto es redundancia.';
    } else {
      badge = U.el('span', { class: 'badge pending' }, '⏳ Pendiente');
      tipText = 'Ningún camino llegó a Bitcoin todavía: la prueba depende de los calendars hasta que se confirme.';
    }
    return U.el('span', { class: 'pill-wrap' }, [badge, U.tip(tipText, { align: 'left' })]);
  }

  function buildCard(item) {
    var verifyBtn = U.el('button', { class: 'btn verify', type: 'button' }, '🔍 Verificar contra Bitcoin');
    verifyBtn.addEventListener('click', function () { verify(item, verifyBtn); });
    if (item.model.status === 'pending') {
      verifyBtn.disabled = true;
      verifyBtn.title = 'No hay ramas ancladas en Bitcoin todavía';
    }

    var header = U.el('div', { class: 'card-header' }, [
      U.el('div', { class: 'card-id' }, [
        U.el('span', { class: 'card-name' }, item.model.fileName || 'archivo.ots'),
        U.el('span', { class: 'muted small' }, U.humanSize(item.model.fileSizeBytes))
      ]),
      U.el('div', { class: 'card-actions' }, [
        statusBadge(item.model),
        verifyBtn,
        U.tip('Consulta mempool.space (o blockstream.info como respaldo) para traer el bloque real y comparar su merkle root con la que afirma el .ots. Solo se envía el número de bloque: tu archivo nunca sale de tu navegador.', { align: 'left' })
      ])
    ]);

    var body = U.el('div', { class: 'card-body' });
    var card = U.el('section', { class: 'card', dataset: { id: String(item.id) } }, [header, body]);
    item.card = card;
    item.bodyEl = body;
    dom.results.appendChild(card);
    renderCardBody(item);
  }

  function renderCardBody(item) {
    if (!item.bodyEl) return;
    item.bodyEl.innerHTML = '';
    var node = (state.view === 'detailed')
      ? root.OtsRenderDetailed.render(item.model)
      : root.OtsRenderSimple.render(item.model, { matchedDoc: item.matchedDoc });
    item.bodyEl.appendChild(node);
  }

  function verify(item, btn) {
    if (item.verifying) return;
    item.verifying = true;
    btn.disabled = true;
    btn.textContent = '⏳ Verificando…';
    item.model.branches.forEach(function (b) { if (b.kind !== 'pending') b.online = 'loading'; });
    renderCardBody(item);
    root.OtsMempool.enrichModel(item.model).then(function () {
      renderCardBody(item);
      btn.textContent = '🔄 Re-verificar';
      btn.disabled = false;
      item.verifying = false;
    });
  }

  function addError(name, msg) {
    var card = U.el('section', { class: 'card error-card' }, [
      U.el('div', { class: 'card-header' }, [
        U.el('span', { class: 'card-name' }, name),
        U.el('span', { class: 'badge bad' }, '✕ Error')
      ]),
      U.el('div', { class: 'card-body' }, U.el('div', { class: 'err-msg' }, msg))
    ]);
    dom.results.appendChild(card);
    refreshChrome();
  }

  // ---- chrome / estados ----
  function refreshChrome() {
    var has = state.items.length > 0 || dom.results.children.length > 0;
    dom.empty.style.display = has ? 'none' : '';
    dom.toolbar.style.display = has ? '' : 'none';
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
