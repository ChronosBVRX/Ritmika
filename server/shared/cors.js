/**
 * CORS origin validation para el relay.
 *
 * Reglas:
 *  - Sin `CORS_ALLOWED_ORIGINS` configurado el relay es público (móviles por datos).
 *  - Con allowlist configurada SOLO se permite:
 *      · orígenes/hostnames de la allowlist (comparación exacta de hostname/origin)
 *      · localhost, 127.0.0.1, ::1 (la TV WebView2 local debe seguir conectando)
 *    Cualquier otro origen se deniega: no existe fallback permisivo.
 *
 * No usar `origin.includes(pattern)` — se compara hostname/origin correctamente.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLocalHostname(hostname) {
  if (!hostname) return false;
  return LOCAL_HOSTNAMES.has(String(hostname).toLowerCase());
}

function matchEntry(parsed, entry) {
  const e = String(entry || '').trim().toLowerCase().replace(/\/+$/, '');
  if (!e) return false;

  // Entrada con esquema: comparar origin completo (esquema + host + puerto)
  if (e.includes('://')) {
    try {
      return new URL(e).origin === parsed.origin;
    } catch {
      return false;
    }
  }

  const host = parsed.hostname.toLowerCase();
  const hostPort = parsed.host.toLowerCase();

  // Wildcard explícito de subdominio: *.example.com
  if (e.startsWith('*.')) {
    const base = e.slice(2);
    return host === base || host.endsWith('.' + base);
  }

  // Hostname exacto o host:puerto exacto
  return host === e || hostPort === e;
}

/**
 * @param {string|undefined|null} origin  Header Origin de la petición.
 * @param {string[]} allowedOrigins        Lista desde CORS_ALLOWED_ORIGINS.
 * @returns {boolean}
 */
function isOriginAllowed(origin, allowedOrigins) {
  const list = Array.isArray(allowedOrigins) ? allowedOrigins.filter(Boolean) : [];

  // Relay público: sin allowlist se permite cualquier origen.
  if (list.length === 0) return true;

  // Cliente no-navegador (sin header Origin). CORS es un mecanismo de navegador;
  // no hay origen que validar y no se concede acceso de navegador.
  if (!origin) return true;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (isLocalHostname(parsed.hostname)) return true;

  return list.some(entry => matchEntry(parsed, entry));
}

module.exports = { isOriginAllowed, isLocalHostname, matchEntry };
