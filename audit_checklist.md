# Security Audit Checklist: Waidrin

**Version:** 0.1.0  
**Stack:** Next.js 15, React 19, Zustand, OpenAI SDK, TypeScript  
**Date:** 2026-05-13

---

## CRITICAL FINDINGS

### 1. [CRITICAL] API Key Exposed to Browser Client
**File:** `lib/backend.ts:49`  
**Issue:** `dangerouslyAllowBrowser: true` is used in the OpenAI client. The API key and URL are stored in browser-side Zustand state, transmitted to the client, and used directly in browser-side API calls. Anyone with DevTools can extract the key.
**Risk:** Complete API key compromise. An attacker can use the key to make requests against the user's LLM provider, potentially incurring significant costs or accessing data.
**Recommendation:** Route LLM API calls through a Next.js API route (server-side proxy) that injects the API key. Store the key server-side (encrypted in a cookie or server session) instead of in localStorage.
**Status:** [ ] Fixed

### 2. [CRITICAL] Dynamic Code Execution via Plugin System
**File:** `app/page.tsx:77`  
**Issue:** Plugins are loaded via dynamic `import()` from user-controlled paths, fetched from the server's filesystem. If an attacker can place a `.js` file in the `plugins/` directory (or via `PLUGINS_DIR` env var manipulation), it will be executed as arbitrary JavaScript in the browser context.
**Risk:** Full remote code execution in the browser. A malicious plugin can steal API keys, exfiltrate all state data, make arbitrary network requests, or compromise the user's session.
**Recommendation:** Implement a plugin sandbox, content signing/verification, or at minimum a user confirmation prompt with a clear warning before executing new plugins.
**Status:** [ ] Fixed

### 3. [CRITICAL] Path Traversal in Plugin File Server (partially mitigated)
**File:** `app/plugins/[...path]/route.ts:19-23`  
**Issue:** The catch-all route serves files from the filesystem. The `startsWith()` check can be bypassed via prefix-matching attacks if `PLUGINS_DIR` is a prefix of another directory.
**Recommendation:** Use `filePath.startsWith(PLUGINS_DIR + path.sep)` to prevent prefix-matching attacks. Also validate that the resolved path doesn't use `..` segments.
**Status:** [ ] Fixed

### 4. [CRITICAL] Plugin Manifest Injection
**File:** `app/plugins/route.ts:26`  
**Issue:** The parsed `main` field from `manifest.json` comes directly from untrusted JSON and is used to construct import paths.
**Risk:** A crafted manifest could load files outside the plugins directory.
**Recommendation:** Validate `manifest.main` - ensure it's a simple filename (no path separators, no `..`), and resolve it within the plugin's directory.
**Status:** [ ] Fixed

---

## HIGH FINDINGS

### 5. [HIGH] State Persistence Without Encryption
**File:** `lib/state.ts:106-157`  
**Issue:** All application state (including `apiUrl`, `apiKey`, `model`) is persisted to `localStorage` via Zustand's `persist` middleware with no encryption.
**Risk:** Any XSS vulnerability or browser extension can read the API key.
**Recommendation:** Exclude `apiKey` from persisted state and request it from the user each session.
**Status:** [ ] Fixed

### 6. [HIGH] State Debugger Allows Arbitrary State Mutation
**File:** `components/StateDebugger.tsx:65-68`  
**Issue:** The state debugger uses `react-json-view` with callbacks that directly write to the Zustand store.
**Risk:** Any user can inject arbitrary state values, including modifying `apiUrl` to point to an attacker-controlled server.
**Recommendation:** Gate the state debugger behind a development mode flag.
**Status:** [ ] Fixed

### 7. [HIGH] Prompt Injection via User/LLM Inputs
**File:** `lib/prompts.ts`, `lib/context.ts`  
**Issue:** User-provided and LLM-generated content is interpolated directly into LLM prompts with no sanitization.
**Risk:** A sufficiently capable LLM could produce outputs designed to influence future prompt construction.
**Recommendation:** Sanitize all LLM-generated content before interpolating it into prompts. Use clear prompt boundaries/separators.
**Status:** [ ] Fixed

### 8. [HIGH] SSRF via User-Controlled API URL
**File:** `lib/backend.ts:46-51`, `views/ConnectionSetup.tsx`  
**Issue:** The `apiUrl` is fully user-controlled. The API key will be sent to whatever URL is configured.
**Risk:** If a malicious plugin modifies the URL, the API key will be sent to an attacker-controlled server.
**Recommendation:** Validate the API URL. Move API calls server-side.
**Status:** [ ] Fixed

---

## MEDIUM FINDINGS

### 9. [MEDIUM] No Content Security Policy (CSP) Headers
**File:** `next.config.ts`  
**Issue:** The Next.js config has no security headers configured.
**Risk:** Without CSP, the app is more vulnerable to XSS.
**Recommendation:** Add security headers in `next.config.ts`.
**Status:** [ ] Fixed

### 10. [MEDIUM] Unvalidated Error Messages Reflected to UI
**File:** `app/page.tsx:108-112`, `views/Chat.tsx:30-34`  
**Issue:** Error messages from exceptions are displayed directly in the UI.
**Risk:** Internal paths, server names, or stack traces may be exposed.
**Recommendation:** Sanitize error messages before display.
**Status:** [ ] Fixed

### 11. [MEDIUM] LLM-Generated Content Rendered as Markdown
**File:** `components/NarrationEventView.tsx:81`  
**Issue:** LLM-generated narration text is rendered through `react-markdown` without input sanitization.
**Risk:** Malformed or adversarial markdown could cause rendering issues or ReDoS.
**Recommendation:** Sanitize markdown input before rendering.
**Status:** [ ] Fixed

### 12. [MEDIUM] Missing Rate Limiting on Server Endpoints
**File:** `app/plugins/route.ts`, `app/plugins/[...path]/route.ts`  
**Issue:** The plugin endpoints have no rate limiting.
**Risk:** Can be abused for denial of service or file enumeration.
**Recommendation:** Add rate limiting middleware.
**Status:** [ ] Fixed

### 13. [MEDIUM] Zustand State Hydration Race Condition
**File:** `app/page.tsx:150-167`  
**Issue:** No protection against state being modified before hydration completes.
**Risk:** Partially hydrated state could be used, potentially leading to undefined behavior.
**Recommendation:** Use Zustand's `onRehydrateStorage` callback for more robust hydration handling.
**Status:** [ ] Fixed

---

## LOW FINDINGS

### 14. [LOW] `PLUGINS_DIR` Environment Variable Not Validated
**Files:** `app/plugins/route.ts:16`, `app/plugins/[...path]/route.ts:8`  
**Issue:** `PLUGINS_DIR` from the environment is used without validation.
**Recommendation:** Validate that `PLUGINS_DIR` exists, is a directory, and is within expected bounds.
**Status:** [ ] Fixed

### 15. [LOW] No Input Sanitization on User Text Fields
**File:** `views/ScenarioSetup.tsx`, `views/ConnectionSetup.tsx`  
**Issue:** Text fields have no input sanitization beyond `maxLength` on the action text field.
**Recommendation:** Add basic input validation.
**Status:** [ ] Fixed

### 16. [LOW] Dependency Audit Surface
**File:** `package.json`  
**Issue:** The project uses `lodash` (large attack surface) when only `throttle` is used.
**Recommendation:** Replace `lodash` with native alternatives.
**Status:** [ ] Fixed

### 17. [LOW] `enableClipboard: false` in State Debugger Can Be Bypassed
**File:** `components/StateDebugger.tsx:61`  
**Issue:** Users can still copy data from browser DevTools.
**Recommendation:** Acceptable as-is for a development tool.
**Status:** [x] Accepted - not applicable

### 18. [LOW] No CSRF Protection
**Issue:** The Next.js API routes don't implement CSRF tokens.
**Recommendation:** Add CSRF protection if the app evolves to include state-modifying endpoints.
**Status:** [ ] Fixed

---

## POSITIVE SECURITY OBSERVATIONS

1. No `dangerouslySetInnerHTML` used anywhere in the codebase
2. `react-markdown` without HTML support - explicit security comment
3. Path traversal protection in plugin file server
4. Error responses don't leak details - generic 500 responses
5. `.npmrc` with `ignore-scripts=true` - prevents supply chain script execution
6. `.npmrc` with `audit=true` - enables npm audit on install
7. `.gitignore` properly excludes `.env` files
8. External links use `noopener,noreferrer`
9. Zod schema validation on all state transitions
10. Biome linter configured with recommended rules
11. Strict TypeScript enabled
12. `SECURITY.md` documents security practices for contributors

---

## SUMMARY TABLE

| # | Severity | Finding | File | Status |
|---|----------|---------|------|--------|
| 1 | CRITICAL | API key exposed in browser | `lib/backend.ts:49` | [ ] |
| 2 | CRITICAL | Arbitrary plugin code execution | `app/page.tsx:77` | [ ] |
| 3 | CRITICAL | Path traversal (partial mitigation) | `app/plugins/[...path]/route.ts:21` | [ ] |
| 4 | CRITICAL | Plugin manifest injection | `app/plugins/route.ts:26` | [ ] |
| 5 | HIGH | Unencrypted state persistence | `lib/state.ts:106` | [ ] |
| 6 | HIGH | State debugger allows state mutation | `components/StateDebugger.tsx:65` | [ ] |
| 7 | HIGH | Prompt injection via user/LLM inputs | `lib/prompts.ts` | [ ] |
| 8 | HIGH | SSRF via user-controlled API URL | `lib/backend.ts:46` | [ ] |
| 9 | MEDIUM | No security headers/CSP | `next.config.ts` | [ ] |
| 10 | MEDIUM | Unvalidated errors reflected to UI | `app/page.tsx:108` | [ ] |
| 11 | MEDIUM | LLM content rendered as markdown | `NarrationEventView.tsx:81` | [ ] |
| 12 | MEDIUM | No rate limiting on endpoints | `app/plugins/route.ts` | [ ] |
| 13 | MEDIUM | State hydration race condition | `app/page.tsx:150` | [ ] |
| 14 | LOW | `PLUGINS_DIR` env var not validated | `app/plugins/route.ts:16` | [ ] |
| 15 | LOW | No input sanitization on text fields | `views/*.tsx` | [ ] |
| 16 | LOW | Large dependency surface (lodash) | `package.json` | [ ] |
| 17 | LOW | State debugger clipboard bypass | `StateDebugger.tsx:61` | [x] Accepted |
| 18 | LOW | No CSRF protection | API routes | [ ] |
