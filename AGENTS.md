# AGENTS.md

## Clinical Data Loss Guardrails

- Patient registration and SOAP/narrative note entry must never fail with the default red error screen while the user is typing.
- Any save, plugin, attachment, loader, or render failure that can be handled locally must surface as an in-app toast or panel message and preserve the current route context.
- Unsaved clinical text must be persisted continuously before network requests or navigation. The SOAP route uses encrypted local draft storage so refreshes, render failures, and accidental reloads can restore the draft.
- Do not use the browser-visible login token as a draft encryption key. The auth cookie is intentionally `httpOnly`; keep that boundary intact. Browser draft ciphertext may live in `localStorage`, with encryption keys managed separately by Web Crypto/IndexedDB.
- Clear clinical drafts only after a confirmed successful save or an explicit user discard action. Validation errors and backend failures must keep the draft intact.
- When adding new patient-facing clinical input surfaces, add the same autosave, before-unload protection, and recoverable error handling before shipping.
