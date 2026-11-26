const crypto = require("crypto");
const dns = require("dns");
const net = require("net");
const http = require("http");
const https = require("https");

/**
 * Sends one webhook delivery, safely.
 *
 *  - https only (http only when WEBHOOK_ALLOW_HTTP=true, for testing)
 *  - never to the server's own network: loopback, private, link-local,
 *    cloud metadata and similar addresses are refused, checked on the
 *    address actually connected to, so a hostname cannot be pointed at one
 *    after it was saved (WEBHOOK_ALLOW_PRIVATE=true lifts this, for an
 *    internal receiver)
 *  - redirects are not followed
 *  - 8 second time limit; the reply is read only far enough to get a status
 *  - signed: X-CompanyStore-Signature = sha256=HMAC(secret, timestamp.body)
 *  - retried on network errors, 429 and 5xx: 3 tries over about 35 seconds
 */

const TIMEOUT_MS = 8000;
const RETRY_DELAYS = [5000, 30000];
const allowHttp = () => process.env.WEBHOOK_ALLOW_HTTP === "true";
const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === "true";

/** Addresses that belong to this machine or its private network. */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

/** Why an address cannot be used, in words for the panel, or null. */
function urlProblem(raw) {
  let u;
  try {
    u = new URL(String(raw || ""));
  } catch (_) {
    return "That is not a web address.";
  }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && allowHttp())) {
    return "The address must start with https://";
  }
  if (u.username || u.password) return "Leave the user name and password out of the address.";
  if (!allowPrivate()) {
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
      return "Webhooks cannot be sent to this server's own network.";
    }
    if (net.isIP(host) && isPrivateAddress(host)) return "Webhooks cannot be sent to a private address.";
  }
  return null;
}

/** DNS lookup that refuses private addresses at connect time. */
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
    if (!allowPrivate() && list.some((a) => isPrivateAddress(a.address))) {
      const e = new Error("refused: the address points at a private network");
      e.code = "EPRIVATE";
      return callback(e);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function sign(secret, timestamp, body) {
  return "sha256=" + crypto.createHmac("sha256", String(secret || "")).update(`${timestamp}.${body}`).digest("hex");
}

/** One attempt. Resolves { ok, status, error, retry }. */
function attempt(url, body, secret) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      u,
      {
        method: "POST",
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "CompanyStore-Forms-Webhook/1.0",
          "X-CompanyStore-Timestamp": timestamp,
          "X-CompanyStore-Signature": sign(secret, timestamp, body),
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        let seen = 0;
        res.on("data", (chunk) => {
          seen += chunk.length;
          if (seen > 65536) res.destroy();
        });
        res.on("end", () => finish());
        res.on("close", () => finish());
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          const ok = status >= 200 && status < 300;
          resolve({
            ok,
            status,
            error: ok ? "" : status >= 300 && status < 400 ? `Redirect (${status}) not followed` : `Receiver answered ${status}`,
            retry: status === 429 || status >= 500,
          });
        };
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out after 8 seconds")));
    req.on("error", (err) =>
      resolve({ ok: false, status: 0, error: err.code === "EPRIVATE" ? err.message : `Could not connect: ${err.message}`, retry: err.code !== "EPRIVATE" })
    );
    req.end(body);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Delivers, retrying when worth it. Resolves { ok, status, error, attempts }. */
async function deliver(url, payload, secret, { retries = true } = {}) {
  const problem = urlProblem(url);
  if (problem) return { ok: false, status: 0, error: problem, attempts: 0 };
  const body = JSON.stringify(payload);
  let last = null;
  const tries = retries ? RETRY_DELAYS.length + 1 : 1;
  for (let i = 0; i < tries; i += 1) {
    if (i > 0) await wait(RETRY_DELAYS[i - 1]);
    last = await attempt(url, body, secret);
    if (last.ok || !last.retry) return { ...last, attempts: i + 1 };
  }
  return { ...last, attempts: tries };
}

module.exports = { deliver, urlProblem, sign, isPrivateAddress };