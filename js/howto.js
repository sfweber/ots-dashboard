/*
 * howto.js — Rellena la guía de verificación manual con los valores del sello
 * que el usuario estaba analizando, pasados por query params:
 *   howto.html?block=ALTURA&merkle=HEX64&txid=HEX64
 * Sin params (o con params inválidos) la guía queda en modo genérico.
 * Los params son input controlado por la URL: se validan con regex y se
 * insertan SIEMPRE via textContent / setAttribute (nunca innerHTML).
 */
(function () {
  'use strict';

  var qs = new URLSearchParams(window.location.search);

  // validación estricta: altura decimal, hashes de 64 hex
  var block = /^\d{1,9}$/.test(qs.get('block') || '') ? qs.get('block') : null;
  var merkle = /^[0-9a-f]{64}$/i.test(qs.get('merkle') || '') ? qs.get('merkle').toLowerCase() : null;
  var txid = /^[0-9a-f]{64}$/i.test(qs.get('txid') || '') ? qs.get('txid').toLowerCase() : null;

  // invierte un hex byte a byte (pares de caracteres) — mismo criterio que mempool.js
  function reverseHex(hex) {
    var out = '';
    for (var i = hex.length - 2; i >= 0; i -= 2) out += hex.substr(i, 2);
    return out;
  }

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
    var txLine = document.getElementById('tx-line');
    if (txLine) txLine.hidden = false;
    var txLink = document.getElementById('tx-link');
    if (txLink) txLink.setAttribute('href', 'https://mempool.space/tx/' + txid);
  }

  if (block || merkle || txid) {
    var banner = document.getElementById('ctx-banner');
    if (banner) banner.hidden = false;
  }
})();
