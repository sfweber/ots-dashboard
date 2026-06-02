/*
 * util.js — Helpers compartidos de UI (creación de DOM, copiar, links, formato).
 * Sin dependencias. Expone window.OtsUtil.
 */
(function (root) {
  'use strict';

  // Crea un elemento. attrs: {class, title, href, target, ...} o {dataset:{...}}.
  // children: string | Node | array de ellos.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
        else if (k === 'onclick') node.addEventListener('click', attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(node, c); });
    } else if (typeof children === 'string' || typeof children === 'number') {
      node.appendChild(document.createTextNode(String(children)));
    } else {
      node.appendChild(children);
    }
  }

  function shortHex(hex, head, tail) {
    if (!hex) return '—';
    head = head || 10; tail = tail || 8;
    if (hex.length <= head + tail + 1) return hex;
    return hex.slice(0, head) + '…' + hex.slice(-tail);
  }

  // Nombre amigable del calendar a partir de su URL.
  function calendarName(uri) {
    if (!uri) return 'calendar';
    try {
      var host = uri.replace(/^https?:\/\//, '').split('/')[0];
      var sub = host.split('.')[0];
      return sub || host;
    } catch (e) { return uri; }
  }

  function mempoolBlockUrl(height) { return 'https://mempool.space/block/' + height; }
  function mempoolTxUrl(txid) { return 'https://mempool.space/tx/' + txid; }

  // Botón de copiar al portapapeles con feedback visual.
  function copyBtn(getText, titleText) {
    var b = el('button', { class: 'copy-btn', title: titleText || 'Copiar', type: 'button' }, '⧉');
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var txt = typeof getText === 'function' ? getText() : getText;
      doCopy(txt).then(function () { flash(b, '✓'); }).catch(function () { flash(b, '✕'); });
    });
    return b;
  }

  function doCopy(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand falló'));
      } catch (e) { reject(e); }
    });
  }

  function flash(btn, symbol) {
    var prev = btn.textContent;
    btn.textContent = symbol;
    btn.classList.add('copied');
    setTimeout(function () { btn.textContent = prev; btn.classList.remove('copied'); }, 1100);
  }

  // Campo "etiqueta: valor monoespaciado + copiar + (opcional) link".
  function hexField(label, value, opts) {
    opts = opts || {};
    var valNode;
    if (opts.href) {
      valNode = el('a', { class: 'mono', href: opts.href, target: '_blank', rel: 'noopener', title: value }, shortHex(value, opts.head, opts.tail));
    } else {
      valNode = el('span', { class: 'mono', title: value }, shortHex(value, opts.head, opts.tail));
    }
    return el('div', { class: 'field' }, [
      el('span', { class: 'field-label' }, label),
      valNode,
      copyBtn(function () { return value; }, 'Copiar ' + label)
    ]);
  }

  function humanSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' kB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  root.OtsUtil = {
    el: el, append: append, shortHex: shortHex, calendarName: calendarName,
    mempoolBlockUrl: mempoolBlockUrl, mempoolTxUrl: mempoolTxUrl,
    copyBtn: copyBtn, hexField: hexField, humanSize: humanSize, doCopy: doCopy
  };
})(typeof window !== 'undefined' ? window : globalThis);
