# Audio Farble

A minimal Firefox (MV3) extension that resists **AudioContext fingerprinting** by applying a rotating, per-site, imperceptible perturbation to Web Audio readback.

It covers the one high-signal surface Firefox's built-in fingerprinting protection (`privacy.fingerprintingProtection`) does **not** touch: the AudioContext hash. It deliberately leaves canvas / WebGL / screen / navigator / timezone to the engine, so it never collides with FPP.

## What it does

A `world: MAIN` content script runs at `document_start` (before any page script) and hooks the audio-read APIs via `Proxy`, scaling their output by one factor within ±0.15%:

- `AudioBuffer.prototype.getChannelData` (the dominant vector: `OfflineAudioContext` render → read)
- `AudioBuffer.prototype.copyFromChannel`
- `AnalyserNode.prototype.getFloatFrequencyData` / `getFloatTimeDomainData`

The factor is `f(private build salt, registrable domain, performance.timeOrigin)`:

| property | consequence |
|---|---|
| stable within a page load | re-reads match → not detectable by reading twice |
| different per site | the audio hash can't link you across sites |
| **rotates every page load** | a site can't recognise a cookieless returning visitor by audio |
| ±0.15% multiplicative | imperceptible; playback-safe |
| build salt is private | the page knows `timeOrigin` but not the salt, so it cannot recompute or divide out the factor |

`Proxy` hooks forward `name`/`length`/`toString` to the native function, so `fn.toString()` still reads `[native code]` (verified in SpiderMonkey).

## Rotation granularity — read this

This rotates **per page load** (every navigation/reload gets a new factor), which is *stronger* anti-linking than per-session. The one tradeoff: because the audio value changes on every page view, a site that fingerprints audio as a cross-page *consistency* check could notice it changing (a weak "this user randomizes" signal). If you would rather it be **stable within a browser session** and rotate only across sessions, that is a different (heavier) build — see "Why not per-session" below.

### Why not per-session

Per-session rotation needs a per-session salt that stays stable across a session's page loads. Delivering that salt to a `document_start`-synchronous, page-realm hook — privately, before the page's own scripts run — is the hard part in Firefox WebExtensions. Every mechanism tried hit a wall: `exportFunction` fights Xray wrappers; inline `<script>` injection and `scripting.executeScript` from `webNavigation` both lose the timing race against early audio fingerprinting; and Firefox gates the `userScripts` MAIN-world API. Per-*load* rotation sidesteps all of that because `performance.timeOrigin` is available synchronously in the page realm — no async salt, no delivery. It's the clean, working form of rotation; per-session would require the `userScripts`/`scripting` + `webNavigation` route and a larger permission footprint.

## Permissions

**None.** No host access, no `storage`, no `webRequest`, no background. It is a single content script.

## Build

```sh
make          # generates salt.txt (once), writes dist/audio_farble.xpi
make clean
```

`salt.txt` is gitignored and reused across rebuilds, so per-site factors stay unique to your build.

## Install

- **Temporary**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `dist/audio_farble.xpi`.
- **Permanent** (Developer Edition): set `xpinstall.signatures.required=false`, then install the `.xpi`.

## Verify

With the extension loaded, open your probe (`~/code/js/web_fingerprinting`, `fptest-full.html`):
- audio hash **differs** from its no-extension value (native `35.749972…` on this machine);
- **reload** the same origin → the hash **changes** (per-load rotation);
- compare `http://localhost` vs `http://127.0.0.1` → **different** hash (per-site).

## Limits

Any JS-level hook can, with effort, be detected by a determined tamper check. This raises the cost of audio fingerprinting; it does not make the browser provably native. Engine-level protection (RFP/FPP) is stealthier — this only fills FPP's audio gap.
