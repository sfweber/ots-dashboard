/*
 * parser.js — Núcleo OFFLINE del dashboard.
 * Convierte los bytes de un archivo .ots en un OtsModel normalizado
 * (ver estructura abajo), que es el único contrato que consumen los renderers.
 *
 * No toca la red. No depende de los otros módulos.
 * Usa la librería global window.OpenTimestamps (v0.4.9) vía OpenTimestamps.json(),
 * cuyos nombres de campo fueron verificados empíricamente:
 *   - timestamp node: { result, ops[], attestations[]?, tx? }
 *   - op:             { fork, op, arg, result, timestamp }
 *   - attestation:    { fork, type, param, merkle? }
 *       PendingAttestation        -> param = URL del calendar
 *       BitcoinBlockHeaderAttestation -> param = altura de bloque, merkle = merkle root del bloque
 *
 * Modelo de salida:
 *   OtsModel = {
 *     fileName, fileSizeBytes,
 *     fileHash,        // hex del digest del documento sellado
 *     hashAlgo,        // "sha256"
 *     branches: [Branch],
 *     status,          // 'pending' | 'partial' | 'confirmed'
 *     earliestBlock,   // menor altura de bloque entre las ramas ancladas (o null)
 *     chains,          // set de cadenas presentes (['Bitcoin', ...])
 *     rawJson, rawTimestamp   // para la vista Detallada / depuración
 *   }
 *   Branch = {
 *     fork,            // id de rama (número)
 *     kind,            // 'pending' | 'bitcoin' | 'litecoin' | 'ethereum' | 'unknown'
 *     chain,           // 'Bitcoin' | 'Litecoin' | 'Ethereum' | null
 *     calendarUri,     // URL del calendar (de la pending attestation de esa rama)
 *     blockHeight,     // altura del bloque (si anclada)
 *     merkleRoot,      // merkle root del BLOQUE que afirma el .ots (uso interno: check trustless)
 *     otsRoot,         // raíz del árbol de OpenTimestamps = dato grabado en el OP_RETURN de la tx
 *     txid,            // txid en esa rama (best-effort)
 *     // enriquecido online (lazy, lo agrega mempool.js): blockHash, blockTime, merkleMatches, online
 *   }
 */
(function (root) {
  'use strict';

  var ATT = {
    'BitcoinBlockHeaderAttestation':  { kind: 'bitcoin',  chain: 'Bitcoin'  },
    'LitecoinBlockHeaderAttestation': { kind: 'litecoin', chain: 'Litecoin' },
    'EthereumBlockHeaderAttestation': { kind: 'ethereum', chain: 'Ethereum' }
  };

  // Recorre el árbol agrupando attestaciones por número de fork.
  // tx se "arrastra" por el camino: cada rama (subárbol) ve solo su propio tx.
  function collect(tsNode, txOnPath, byFork) {
    if (!tsNode || typeof tsNode !== 'object') return;
    var tx = (typeof tsNode.tx === 'string' && tsNode.tx) ? tsNode.tx : txOnPath;

    if (Array.isArray(tsNode.attestations)) {
      tsNode.attestations.forEach(function (a) {
        var fk = (a.fork != null) ? a.fork : 0;
        var b = byFork[fk] || (byFork[fk] = {
          fork: fk, kind: 'pending', chain: null,
          calendarUri: null, blockHeight: null, merkleRoot: null, txid: null
        });
        if (a.type === 'PendingAttestation') {
          b.calendarUri = a.param;
        } else if (ATT[a.type]) {
          b.kind = ATT[a.type].kind;
          b.chain = ATT[a.type].chain;
          b.blockHeight = a.param;
          b.merkleRoot = a.merkle || null;
          b.txid = tx || b.txid;
        } else {
          b.kind = 'unknown';
          b.unknownType = a.type;
        }
      });
    }
    if (Array.isArray(tsNode.ops)) {
      tsNode.ops.forEach(function (op) {
        // Detectar el punto donde se reconstruye la transacción Bitcoin: un prepend
        // cuyo arg es el prefijo de la tx (versión 01/02...) y termina en el OP_RETURN
        // que empuja 32 bytes (…6a20). El mensaje de entrada a ese prepend (tsNode.result)
        // es EXACTAMENTE lo que va dentro del OP_RETURN = la raíz del árbol de OpenTimestamps.
        if (op && op.op === 'prepend' && typeof op.arg === 'string' &&
            /^0[12]000000/.test(op.arg) && /6a20$/.test(op.arg)) {
          var fk = (op.fork != null) ? op.fork : 0;
          var b = byFork[fk] || (byFork[fk] = {
            fork: fk, kind: 'pending', chain: null,
            calendarUri: null, blockHeight: null, merkleRoot: null, txid: null
          });
          b.otsRoot = tsNode.result;
        }
        if (op && op.timestamp) collect(op.timestamp, tx, byFork);
      });
    }
  }

  // Transformación pura: objeto JSON de OpenTimestamps.json() -> OtsModel.
  // Separada para poder testearla sin navegador.
  function buildModel(obj, fileName, fileSizeBytes) {
    var byFork = {};
    if (obj && obj.timestamp) collect(obj.timestamp, null, byFork);

    var branches = Object.keys(byFork)
      .map(function (k) { return byFork[k]; })
      .sort(function (a, b) {
        // ramas ancladas primero, luego por altura de bloque, luego por fork
        if (a.kind !== 'pending' && b.kind === 'pending') return -1;
        if (a.kind === 'pending' && b.kind !== 'pending') return 1;
        if (a.blockHeight != null && b.blockHeight != null) return a.blockHeight - b.blockHeight;
        return a.fork - b.fork;
      });

    var anchored = branches.filter(function (b) { return b.kind !== 'pending' && b.kind !== 'unknown'; });
    var status = anchored.length === 0 ? 'pending'
      : (anchored.length === branches.length ? 'confirmed' : 'partial');

    var earliestBlock = null;
    anchored.forEach(function (b) {
      if (b.blockHeight != null && (earliestBlock == null || b.blockHeight < earliestBlock)) {
        earliestBlock = b.blockHeight;
      }
    });

    var chains = {};
    anchored.forEach(function (b) { if (b.chain) chains[b.chain] = true; });

    return {
      fileName: fileName || null,
      fileSizeBytes: fileSizeBytes != null ? fileSizeBytes : null,
      fileHash: obj ? obj.hash : null,
      hashAlgo: obj ? obj.op : null,
      branches: branches,
      status: status,
      earliestBlock: earliestBlock,
      chains: Object.keys(chains),
      rawJson: obj,
      rawTimestamp: obj ? obj.timestamp : null
    };
  }

  // Bytes (Uint8Array | ArrayBuffer | Array<number>) -> OtsModel.
  // Usa la librería global OpenTimestamps. Lanza Error si el .ots es inválido.
  function parseBytes(bytes, fileName, fileSizeBytes) {
    var OTS = root.OpenTimestamps;
    if (!OTS || typeof OTS.json !== 'function') {
      throw new Error('Librería OpenTimestamps no cargada todavía.');
    }
    var arr;
    if (bytes instanceof ArrayBuffer) arr = Array.from(new Uint8Array(bytes));
    else if (bytes instanceof Uint8Array) arr = Array.from(bytes);
    else if (Array.isArray(bytes)) arr = bytes;
    else throw new Error('Tipo de entrada no soportado para parseBytes.');

    var size = fileSizeBytes != null ? fileSizeBytes : arr.length;
    var jsonStr = OTS.json(arr);
    var obj = JSON.parse(jsonStr);
    if (obj.result === 'KO') {
      throw new Error('No es un .ots válido: ' + (obj.error || 'formato desconocido'));
    }
    return buildModel(obj, fileName, size);
  }

  var api = { parseBytes: parseBytes, buildModel: buildModel };
  root.OtsParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
