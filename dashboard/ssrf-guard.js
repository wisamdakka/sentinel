/**
 * SSRF guard for the raid executor's target.endpoint.
 *
 * Blocks requests to private/reserved network ranges that an authenticated
 * user shouldn't be able to reach through our server. Required because the
 * /api/raids executor performs server-side fetches to a caller-supplied URL.
 *
 * Opt-out for local dev only: SENTINEL_ALLOW_PRIVATE_TARGETS=1
 * (When set, the guard resolves names but skips the private-IP rejection.
 *  Useful for pointing the executor at a local Ollama/llama.cpp instance.)
 */

const dns = require('dns').promises;
const net = require('net');

// Hostname blocklist — these names usually resolve to loopback/private IPs
// but we reject them by name too, in case DNS is unusual.
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.intranet',
  '.corp',
  '.home',
  '.lan',
];

// IPv4 ranges we refuse to contact.
// Each entry: [network (32-bit int), prefix bits]
function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

const BLOCKED_IPV4_RANGES = [
  ['0.0.0.0',        8],   // "this network"
  ['10.0.0.0',       8],   // RFC 1918 private
  ['100.64.0.0',    10],   // carrier-grade NAT
  ['127.0.0.0',      8],   // loopback
  ['169.254.0.0',   16],   // link-local (AWS/GCP metadata lives at 169.254.169.254)
  ['172.16.0.0',    12],   // RFC 1918 private
  ['192.0.0.0',     24],   // IETF protocol assignments
  ['192.0.2.0',     24],   // TEST-NET-1
  ['192.168.0.0',   16],   // RFC 1918 private
  ['198.18.0.0',    15],   // network benchmark
  ['198.51.100.0',  24],   // TEST-NET-2
  ['203.0.113.0',   24],   // TEST-NET-3
  ['224.0.0.0',     4],    // multicast
  ['240.0.0.0',     4],    // reserved
  ['255.255.255.255', 32], // broadcast
].map(([cidr, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [ipv4ToInt(cidr) & mask, mask];
});

function isBlockedIPv4(ip) {
  const n = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([network, mask]) => (n & mask) === network);
}

function isBlockedIPv6(ip) {
  const lower = ip.toLowerCase();
  // ::1 loopback, :: unspecified
  if (lower === '::1' || lower === '::') return true;
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast
  if (/^f[cd]/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  if (/^ff/.test(lower)) return true;
  return false;
}

function hostnameLooksInternal(hostname) {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

/**
 * Validate a target URL. Returns {ok: true} if safe to fetch, or
 * {ok: false, reason: "..."} if the request should be rejected.
 */
async function validateTargetUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      ok: false,
      reason: `protocol "${url.protocol}" not allowed — use http or https`,
    };
  }

  const hostname = url.hostname;
  if (!hostname) {
    return { ok: false, reason: 'URL has no hostname' };
  }

  if (hostnameLooksInternal(hostname)) {
    return {
      ok: false,
      reason: `hostname "${hostname}" points at a private/internal network`,
    };
  }

  const allowPrivate = process.env.SENTINEL_ALLOW_PRIVATE_TARGETS === '1';

  // If the hostname IS a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (!allowPrivate) {
      const blocked = net.isIPv4(hostname)
        ? isBlockedIPv4(hostname)
        : isBlockedIPv6(hostname);
      if (blocked) {
        return {
          ok: false,
          reason: `IP address "${hostname}" is in a reserved/private range`,
        };
      }
    }
    return { ok: true, resolved: [hostname] };
  }

  // Otherwise resolve DNS and reject if ANY answer is private.
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    return { ok: false, reason: `DNS lookup failed for "${hostname}": ${err.code || err.message}` };
  }

  if (!addresses.length) {
    return { ok: false, reason: `hostname "${hostname}" did not resolve` };
  }

  if (!allowPrivate) {
    for (const a of addresses) {
      const blocked = a.family === 4 ? isBlockedIPv4(a.address) : isBlockedIPv6(a.address);
      if (blocked) {
        return {
          ok: false,
          reason: `hostname "${hostname}" resolves to private address ${a.address}`,
        };
      }
    }
  }

  return { ok: true, resolved: addresses.map((a) => a.address) };
}

module.exports = {
  validateTargetUrl,
  // exported for tests
  isBlockedIPv4,
  isBlockedIPv6,
  hostnameLooksInternal,
};
