/*
 * howto.js — (1) rellena la guía con los valores del sello que el usuario
 * estaba analizando, pasados por query params:
 *   howto.html?block=ALTURA&merkle=HEX64&txid=HEX64&otsroot=HEX64
 * (2) maneja el switch de solapas (niveles de confianza).
 * Sin params (o inválidos) la guía queda genérica. Los params son input
 * controlado por la URL: se validan con regex y se insertan SIEMPRE via
 * textContent / setAttribute (nunca innerHTML).
 */
(function () {
  'use strict';

  // ---------- 1. valores del sello ----------
  var qs = new URLSearchParams(window.location.search);
  var hex64 = /^[0-9a-f]{64}$/i;

  var block = /^\d{1,9}$/.test(qs.get('block') || '') ? qs.get('block') : null;
  var merkle = hex64.test(qs.get('merkle') || '') ? qs.get('merkle').toLowerCase() : null;
  var txid = hex64.test(qs.get('txid') || '') ? qs.get('txid').toLowerCase() : null;
  var otsroot = hex64.test(qs.get('otsroot') || '') ? qs.get('otsroot').toLowerCase() : null;

  // invierte un hex byte a byte (pares de caracteres) — mismo criterio que mempool.js
  function reverseHex(hex) {
    var out = '';
    for (var i = hex.length - 2; i >= 0; i -= 2) out += hex.substr(i, 2);
    return out;
  }

  // rellena TODOS los nodos con ese data-param, estén en la solapa visible o no
  function fill(name, value) {
    var nodes = document.querySelectorAll('[data-param="' + name + '"]');
    Array.prototype.forEach.call(nodes, function (n) {
      n.textContent = value;
      n.classList.add('filled');
    });
  }

  if (block) {
    fill('block', block);
    var blockLink = document.getElementById('block-link');
    if (blockLink) blockLink.setAttribute('href', 'https://mempool.space/block/' + block);
    var blockAlt = document.getElementById('block-link-alt');
    if (blockAlt) blockAlt.setAttribute('href', 'https://blockstream.info/block-height/' + block);
  }

  if (merkle) {
    fill('merkle', merkle);
    fill('merkle-rev', reverseHex(merkle));
    var both = document.getElementById('merkle-both');
    if (both) both.hidden = false;
  }

  if (txid) {
    fill('txid', txid);
    var txLink = document.getElementById('tx-link');
    if (txLink) txLink.setAttribute('href', 'https://mempool.space/tx/' + txid);
  }

  if (otsroot) fill('otsroot', otsroot);

  if (block || merkle || txid || otsroot) {
    var banner = document.getElementById('ctx-banner');
    if (banner) banner.hidden = false;
  }

  // ---------- 2. solapas (niveles de confianza) ----------
  var tabs = document.querySelectorAll('.howto-tabs button[data-tab]');
  var panels = document.querySelectorAll('.tab-panel[data-panel]');
  function selectTab(name) {
    Array.prototype.forEach.call(tabs, function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    Array.prototype.forEach.call(panels, function (p) {
      p.hidden = (p.getAttribute('data-panel') !== name);
    });
  }
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); });
  });
})();
