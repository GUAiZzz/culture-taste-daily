import { lookup as systemLookup } from 'node:dns';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

// Only publicly routable unicast IP addresses are usable for this health probe.
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const first = parseInt(address.split(':')[0], 16);
    return first >= 0x2000 && first <= 0x3fff && !/^2001:db8:/i.test(address);
  }
  return false;
}

export function isAllowedHealthUrl(value) {
  try {
    const url = new URL(value), host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || !host || !host.includes('.') && !isIP(host)) return false;
    if ([...url.searchParams.keys()].some(key => /^(?:token|access_token|api[_-]?key|authorization|password|secret)$/i.test(key))) return false;
    if (/(^|\.)(localhost|internal|intranet|office-sec)(\.|$)/i.test(host)
      || /(?:^|\.)(?:local|corp|home|lan)$/i.test(host)) return false;
    return !isIP(host) || isPublicAddress(host);
  } catch { return false; }
}

// Supply the validated lookup directly to the socket, preventing a second DNS
// resolution between validation and connection.
export function createPublicLookup(lookup = systemLookup) {
  return (hostname, options, callback) => {
    lookup(hostname, { all: true, verbatim: true }, (error, records) => {
      if (error || !records?.length || records.some(record => !isPublicAddress(record.address))) {
        const rejected = new Error('HEALTH_DNS_UNAVAILABLE_OR_NONPUBLIC'); rejected.code = 'HEALTH_DNS_UNAVAILABLE_OR_NONPUBLIC';
        return callback(rejected);
      }
      return options?.all ? callback(null, records) : callback(null, records[0].address, records[0].family);
    });
  };
}

// https.request never follows redirects. Its lookup is validated and bound to
// the actual connection; the source hostname remains the TLS identity.
export function safePublicRequest(url, options = {}) {
  if (!isAllowedHealthUrl(url)) return Promise.reject(new Error('UNSAFE_TARGET_BLOCKED'));
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: options.method ?? 'GET', headers: options.headers,
      signal: options.signal, lookup: createPublicLookup(), agent: false }, response => {
      resolve({ status: response.statusCode, url, headers: { get: name => response.headers[name.toLowerCase()] ?? null },
        body: { cancel: async () => response.destroy() } });
    });
    req.once('error', reject); req.end();
  });
}
