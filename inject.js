// Audio Farble — resist AudioContext fingerprinting.
// Runs in the page realm at document_start (world: MAIN), so it hooks the audio
// APIs before any page script can read them, with no Xray juggling and no CSP issue.
//
// Factor = f(private build salt, registrable domain, page-load time). Therefore:
//   * Stable within a page load  -> re-reads match (not detectable by re-reading).
//   * Different per site          -> not usable to link you across sites.
//   * Rotates every page load     -> a site cannot recognise a cookieless returning
//                                    visitor by audio. (performance.timeOrigin is
//                                    page-readable, but the build salt is not, so the
//                                    page cannot recompute or divide out the factor.)
//   * +/-0.15% multiplicative     -> imperceptible, playback-safe.
(() => {
  "use strict";
  const FLAG = "__audio_farble_installed__";
  if (Object.prototype.hasOwnProperty.call(window, FLAG)) return;
  Object.defineProperty(window, FLAG, { value: 1, enumerable: false });

  const SALT = "__SALT__"; // baked per build; private (not derivable by the page)
  const host = location.hostname || "local";
  const parts = host.split(".");
  const domain = parts.length > 2 ? parts.slice(-2).join(".") : host;
  const load = Math.floor((performance.timeOrigin || 0)); // ms; constant per document

  const hash32 = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
  const rand01 = (s) => { let t = (s + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const FACTOR = 1 + (rand01(hash32(SALT + "|" + domain + "|" + load)) - 0.5) * 0.003;

  const scaled = new WeakSet();
  const wrap = (proto, name, kind) => {
    if (!proto) return;
    const d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d || typeof d.value !== "function") return;
    proto[name] = new Proxy(d.value, { apply(target, self, args) {
      const r = Reflect.apply(target, self, args);
      if (kind === "channel") {
        if (r && !scaled.has(r)) { scaled.add(r); for (let i = 0; i < r.length; i++) r[i] *= FACTOR; }
      } else {
        const a = args[0];
        if (a) for (let i = 0; i < a.length; i++) a[i] *= FACTOR;
      }
      return r;
    }});
  };
  if (typeof AudioBuffer !== "undefined") { wrap(AudioBuffer.prototype, "getChannelData", "channel"); wrap(AudioBuffer.prototype, "copyFromChannel", "dest"); }
  if (typeof AnalyserNode !== "undefined") { wrap(AnalyserNode.prototype, "getFloatFrequencyData", "dest"); wrap(AnalyserNode.prototype, "getFloatTimeDomainData", "dest"); }
})();
