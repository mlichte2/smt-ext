# SMT Comment Filter

A Chrome extension that filters comments on the SMT by username. Maintain an **allowlist** to show only the people you want to read,
and a **blocklist** to hide the rest.

## Features

- Allowlist mode: show only allowlisted users (and, optionally, the threads
  they participate in).
- Blocklist mode: hide blocklisted users (and, optionally, the threads they
  appear in).
- Case-insensitive username matching with whitespace and legacy `" says"`
  suffix tolerance, so old saved lists keep working after site updates.
- Live filtering: changes apply across every open SMT tab without a page
  reload, via `chrome.storage.onChanged`.
- Lightweight DOM observer scoped to the comments area, with O(N) thread
  resolution.

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome / Edge / Brave.
3. Toggle **Developer mode** on.
4. Click **Load unpacked** and select this folder.
5. Pin the extension if you like, then visit any SMT post.

## Usage

Click the extension icon to open the popup.

- **Allowlist tab** – one username per line. Save.
- **Blocklist tab** – one username per line. Save.
- **Options tab**:
  - _Enable filtering_ – master on/off switch.
  - _Show entire threads containing allowlisted users_ – include replies and
    parents of an allowlisted commenter.
  - _Hide entire threads containing blocklisted users_ – hide whole threads
    if they contain a blocklisted commenter (otherwise only the blocked
    comment itself is hidden).
  - _When allowlist is empty, show all non-blocked comments_ – disable to
    hide everything when the allowlist is empty.

If a username appears in both lists, the **blocklist wins** and the popup
will show a notice.

## Files

| File                      | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `manifest.json`           | MV3 manifest, permissions, host matches                              |
| `content.js`              | Injected on SMT pages; reads settings, filters comments, watches DOM |
| `popup.html` / `popup.js` | The toolbar popup UI                                                 |
| `images/`                 | Toolbar icons                                                        |

## Settings storage

Settings are persisted in `chrome.storage.sync`, so they sync across signed-in
Chrome profiles.
