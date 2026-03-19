# 07 — Messaging System

**Files:** `src/types/messages.ts`, `src/background/index.ts`

## Simple Version

**Analogy: Walkie-talkies in a building with no hallways**

The panel, background, popup, and options pages are like people in separate rooms with no doors between them. They can only communicate via walkie-talkies. But not just any message — every message must be from an approved list written on a card (`messages.ts`). If you send a message type that's not on the card, nobody knows what to do with it.

When the panel wants to trigger a ZIP download, it picks up the walkie-talkie and says `"DOWNLOAD_ALL"`. The background hears it, does the work, and replies `"success: true"`. The panel hears the reply and knows the job is done.

```
Panel SPA                      Background SW
   │                                │
   │── { type: 'DOWNLOAD_ALL' } ──► │
   │                                │  finds active tab
   │                                │  calls captureAndDownload()
   │◄── { success: true, data: null}│
```

---

## Deep Version

### The Message Contract

All cross-context communication uses a **discriminated union type**:

```ts
// src/types/messages.ts
export type ExtensionMessage =
  | { type: 'SCRIPT_CAPTURED'; payload: CapturedScript }
  | { type: 'DOWNLOAD_SCRIPT'; payload: { id: string } }
  | { type: 'DOWNLOAD_ALL' }
  | { type: 'CLEAR_SCRIPTS' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<CaptureSettings> }

export type MessageResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

A discriminated union means TypeScript narrows the type based on the `type` field. In a `switch (message.type)` block, within the `'DOWNLOAD_ALL'` case, TypeScript knows `message` has no `payload` — it's just `{ type: 'DOWNLOAD_ALL' }`. Within the `'DOWNLOAD_SCRIPT'` case, it knows `message.payload.id` is a `string`.

This makes it impossible to forget to handle a `payload` or to misspell a field — the type checker catches it at compile time.

### Sending a Message (Panel → Background)

```ts
import browser from 'webextension-polyfill'
import type { ExtensionMessage, MessageResponse } from '@/types/messages'

// Example: trigger download from the panel
const response = await browser.runtime.sendMessage(
  { type: 'DOWNLOAD_ALL' } satisfies ExtensionMessage
) as MessageResponse
```

`satisfies ExtensionMessage` validates that the object literal matches one member of the union **without widening the type**. This is a TypeScript 4.9+ feature preferred over a simple cast.

### Receiving a Message (Background)

```ts
// src/background/index.ts
browser.runtime.onMessage.addListener((message: unknown, _sender: unknown) => {
  return handleMessage(message as ExtensionMessage).catch((err: unknown) => {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error } satisfies MessageResponse
  })
})
```

**The polyfill's Promise-return pattern:**

The `webextension-polyfill` changes how async message responses work compared to raw `chrome.*`:

| API | Async pattern |
|-----|--------------|
| Raw `chrome.runtime.onMessage` | Return `true` from listener + call `sendResponse(value)` later |
| Polyfill `browser.runtime.onMessage` | Return a `Promise` from the listener — the resolved value is the response |

The polyfill approach is cleaner and avoids the footgun of `return true` (forgetting it means the response channel closes before your async work finishes).

### The Handler Switch

```ts
async function handleMessage(message: ExtensionMessage): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case 'DOWNLOAD_ALL': {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab?.id && tab?.url) captureAndDownload(tab.id, tab.url)
      return { success: true, data: null }
    }
    case 'DOWNLOAD_SCRIPT':
      return { success: true, data: null }  // stub — not yet implemented
    default:
      return { success: false, error: 'Unhandled message type' }
  }
}
```

The `default` branch handles any message whose `type` is not in the implemented set. This is defensive — even well-typed senders can theoretically send stale message shapes if there's a version mismatch between a cached extension page and a just-updated background.

### Message Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Extension Contexts                                              │
│                                                                  │
│  ┌─────────────┐    sendMessage()    ┌─────────────────────────┐│
│  │ Panel SPA   │ ─────────────────► │ Background Service Worker││
│  │             │                    │                           ││
│  │             │ ◄───────────────── │  handleMessage(msg)       ││
│  │             │   MessageResponse  │    case 'DOWNLOAD_ALL'    ││
│  └─────────────┘                    │    case 'DOWNLOAD_SCRIPT' ││
│                                     │    default → error        ││
│  ┌─────────────┐                    └─────────────────────────┘ │
│  │ Options SPA │ ─────────────────► (same path)                 │
│  └─────────────┘                                                 │
│                                                                  │
│  ┌─────────────┐                                                 │
│  │ Popup SPA   │ ─────────────────► (same path)                 │
│  └─────────────┘                                                 │
└──────────────────────────────────────────────────────────────────┘

All messages are serialised to JSON.
Only JSON-serialisable values can be sent (no functions, no class instances).
```

### Currently Implemented vs. Defined

| Message type | Defined in type | Handled in background |
|-------------|----------------|----------------------|
| `SCRIPT_CAPTURED` | ✓ | ✗ (panel uses Redux directly) |
| `DOWNLOAD_SCRIPT` | ✓ | Stub (returns success, does nothing) |
| `DOWNLOAD_ALL` | ✓ | ✓ (triggers captureAndDownload) |
| `CLEAR_SCRIPTS` | ✓ | ✗ (not yet wired) |
| `GET_SETTINGS` | ✓ | ✗ (not yet wired) |
| `UPDATE_SETTINGS` | ✓ | ✗ (not yet wired) |

Several message types are defined speculatively — they represent the intended future architecture where settings and script lists are persisted in `chrome.storage` and kept in sync across all extension contexts via messaging. Currently, each SPA manages its own in-memory Redux store without cross-context synchronisation.

### Error Handling Pattern

The `MessageResponse` type is a **result type** (discriminated by `success`):

```ts
type MessageResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Callers should always check the `success` field before accessing `data`. This is the extension equivalent of a `Result<T, E>` type from languages like Rust. It prevents accidentally reading `response.data` when the background threw an error.

---

## Gotchas

- **Messages are serialised to JSON.** You cannot send functions, class instances, `undefined` (it becomes `null`), `Date` objects (they become strings), or circular references. Only plain objects, arrays, strings, numbers, booleans, and null.
- **`SCRIPT_CAPTURED` is unused.** The message type is defined but the panel never sends it — scripts are captured directly via the DevTools API and dispatched to the local Redux store, bypassing the message bus entirely. The type was designed for a future architecture where the background acts as a central data store.
- **No message routing.** `browser.runtime.sendMessage` broadcasts to all listeners in the extension (background + all open extension pages). If multiple pages register `onMessage` listeners, they all receive every message. Currently only the background registers a listener, so this is safe.
- **The background must be awake to receive messages.** MV3 service workers can be terminated. `sendMessage` from the panel will wake the service worker if it's sleeping, but there's a small latency and a theoretical race if the message arrives before the background's `onMessage` listener is registered.

---

## Quick Recap

- All inter-context communication uses a **typed discriminated union** (`ExtensionMessage`) to prevent invalid messages at compile time.
- The polyfill uses **Promise return** from `onMessage` listeners — simpler and safer than the raw `sendResponse` callback.
- **Only `DOWNLOAD_ALL` is fully implemented** on the background side; other message types are stubs or planned for future storage-sync features.
- **Messages are JSON-only** — no functions, class instances, or circular references can cross context boundaries.
