/*
 * hash.js — SHA-256 de un documento original, en el navegador.
 * Se usa para comprobar que el documento que el usuario suelta coincide
 * con el hash sellado dentro del .ots.
 *
 * Intenta primero crypto.subtle (Web Crypto API). En contextos file://
 * algunos navegadores deshabilitan SubtleCrypto -> fallback a CryptoJS.
 */
(function (root) {
  'use strict';

  function bufToHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += (bytes[i] >>> 4).toString(16) + (bytes[i] & 0xf).toString(16);
    }
    return hex;
  }

  // ArrayBuffer -> hex SHA-256 (lowercase). Async.
  function sha256Hex(arrayBuffer) {
    if (root.crypto && root.crypto.subtle && root.crypto.subtle.digest) {
      try {
        return root.crypto.subtle.digest('SHA-256', arrayBuffer)
          .then(function (digest) { return bufToHex(digest); })
          .catch(function () { return sha256HexCryptoJS(arrayBuffer); });
      } catch (e) {
        return sha256HexCryptoJS(arrayBuffer);
      }
    }
    return sha256HexCryptoJS(arrayBuffer);
  }

  function sha256HexCryptoJS(arrayBuffer) {
    return new Promise(function (resolve, reject) {
      if (!root.CryptoJS || !root.CryptoJS.SHA256) {
        reject(new Error('No hay SubtleCrypto ni CryptoJS disponibles para hashear.'));
        return;
      }
      try {
        var wordArray = arrayBufferToWordArray(arrayBuffer);
        resolve(root.CryptoJS.SHA256(wordArray).toString(root.CryptoJS.enc.Hex));
      } catch (e) {
        reject(e);
      }
    });
  }

  function arrayBufferToWordArray(ab) {
    var u8 = new Uint8Array(ab);
    var words = [];
    for (var i = 0; i < u8.length; i++) {
      words[i >>> 2] |= u8[i] << (24 - (i % 4) * 8);
    }
    return root.CryptoJS.lib.WordArray.create(words, u8.length);
  }

  root.OtsHash = { sha256Hex: sha256Hex };
})(typeof window !== 'undefined' ? window : globalThis);
