/*
 * mempool.js — Enriquecimiento ONLINE opcional (único módulo que usa la red).
 *
 * Por cada rama anclada en Bitcoin:
 *   1) GET {api}/block-height/{h}  -> hash del bloque (texto plano)
 *   2) GET {api}/block/{hash}      -> JSON { timestamp, merkle_root, ... }
 *
 * Devuelve la fecha real del bloque y el veredicto TRUSTLESS:
 *   merkleMatches = la merkle root que afirma el .ots coincide con la del bloque real.
 *
 * El dashboard funciona 100% sin este módulo; es opt-in (botón).
 * Si falla (sin red / CORS desde file://), degrada con estado 'error'.
 */
(function (root) {
  'use strict';

  var ENDPOINTS = [
    'https://mempool.space/api',     // primario
    'https://blockstream.info/api'   // plan B (misma forma de API)
  ];

  var cache = {}; // height -> Promise<{hash, timestamp, merkle_root, source}>

  function fetchText(url) {
    return root.fetch(url, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
      return r.text();
    });
  }
  function fetchJson(url) {
    return root.fetch(url, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
      return r.json();
    });
  }

  function fetchBlockFrom(api, height) {
    return fetchText(api + '/block-height/' + height).then(function (hash) {
      hash = (hash || '').trim();
      if (!/^[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Hash de bloque inesperado');
      return fetchJson(api + '/block/' + hash).then(function (block) {
        return {
          hash: hash,
          timestamp: block.timestamp,        // unix segundos
          merkle_root: block.merkle_root,    // hex big-endian (display)
          source: api
        };
      });
    });
  }

  // Intenta cada endpoint en orden hasta que uno responda.
  function fetchBlock(height) {
    if (cache[height]) return cache[height];
    var p = ENDPOINTS.reduce(function (chain, api) {
      return chain.catch(function () { return fetchBlockFrom(api, height); });
    }, Promise.reject());
    cache[height] = p;
    p.catch(function () { delete cache[height]; }); // no cachear fallos
    return p;
  }

  function reverseHex(hex) {
    if (!hex) return hex;
    var out = '';
    for (var i = hex.length - 2; i >= 0; i -= 2) out += hex.substr(i, 2);
    return out;
  }

  // Compara la merkle root del .ots contra la del bloque real, tolerando endianness.
  function merkleMatches(otsMerkle, blockMerkle) {
    if (!otsMerkle || !blockMerkle) return false;
    var a = otsMerkle.toLowerCase();
    var b = blockMerkle.toLowerCase();
    return a === b || a === reverseHex(b);
  }

  // Enriquece UNA rama bitcoin. Muta y devuelve la rama.
  function enrichBranch(branch) {
    if (branch.kind === 'pending' || branch.blockHeight == null) {
      branch.online = 'skip';
      return Promise.resolve(branch);
    }
    branch.online = 'loading';
    return fetchBlock(branch.blockHeight).then(function (block) {
      branch.blockHash = block.hash;
      branch.blockTime = block.timestamp;
      branch.blockMerkleRoot = block.merkle_root;
      branch.merkleMatches = merkleMatches(branch.merkleRoot, block.merkle_root);
      branch.source = block.source;
      branch.online = 'ok';
      return branch;
    }).catch(function (err) {
      branch.online = 'error';
      branch.onlineError = err.message;
      return branch;
    });
  }

  // Enriquece todas las ramas bitcoin de un modelo. Devuelve Promise<model>.
  function enrichModel(model) {
    var jobs = model.branches.map(enrichBranch);
    return Promise.all(jobs).then(function () { return model; });
  }

  // "UTC-3" / "UTC+5:30" a partir de un offset en minutos.
  function offsetLabel(mins) {
    var sign = mins < 0 ? '-' : '+';
    var h = Math.floor(Math.abs(mins) / 60), mm = Math.abs(mins) % 60;
    return 'UTC' + sign + h + (mm ? ':' + (mm < 10 ? '0' + mm : mm) : '');
  }

  // Formatea un unix timestamp (segundos) en la zona local del navegador.
  // Usa Date nativo: las reglas de huso (incl. horario de verano) las pone el SO,
  // siempre actualizadas y para cualquier año.
  function formatDate(unixSeconds) {
    if (unixSeconds == null) return null;
    var d = new Date(unixSeconds * 1000);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    var fecha = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    return fecha + ' (' + offsetLabel(-d.getTimezoneOffset()) + ', hora local)';
  }

  root.OtsMempool = {
    fetchBlock: fetchBlock,
    enrichBranch: enrichBranch,
    enrichModel: enrichModel,
    merkleMatches: merkleMatches,
    reverseHex: reverseHex,
    formatDate: formatDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
