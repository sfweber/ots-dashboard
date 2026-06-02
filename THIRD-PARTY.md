# Librerías de terceros

Este proyecto **incluye** ("vendorea") las siguientes librerías en `assets/`, sin
modificarlas, para que el dashboard funcione 100% offline y sin dependencias de red.
Cada una conserva su licencia original y pertenece a sus respectivos autores.

| Archivo | Librería | Versión | Licencia | Upstream |
|---|---|---|---|---|
| `assets/opentimestamps.min.js` | javascript-opentimestamps | 0.4.9 | **LGPL-3.0** | https://github.com/opentimestamps/javascript-opentimestamps |
| `assets/crypto-js.js` | CryptoJS | — | **MIT** | https://github.com/brix/crypto-js |
| `assets/moment.min.js` | Moment.js | — | **MIT** | https://github.com/moment/moment |
| `assets/moment-timezone.min.js` | Moment Timezone | 2012–2022 data | **MIT** | https://github.com/moment/moment-timezone |

El **código propio** de este repositorio (todo lo que está fuera de `assets/`) está
licenciado bajo MIT — ver [LICENSE](LICENSE).

> Nota: `javascript-opentimestamps` es LGPL-3.0. Se distribuye aquí sin modificaciones,
> cargado dinámicamente vía `<script>`. Si querés actualizar o reemplazar esa librería,
> obtené la versión oficial desde su repositorio upstream.

Servicios externos consultados en tiempo de ejecución (solo si usás "Verificar contra Bitcoin"):
- [mempool.space](https://mempool.space) — API pública de exploración de Bitcoin.
- [blockstream.info](https://blockstream.info) — endpoint alternativo (misma forma de API).
