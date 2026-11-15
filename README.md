# comical-bridge-kit

Site-agnostic scraping helpers shared by the pos5drow Comical bridge repos
([comical-bridges](https://github.com/pos5drow/comical-bridges) and its NSFW sibling).

It knows about web infrastructure (anti-bot vendors, redirects, date formats) but never about a
particular site. It imports nothing from Comical: its results are plain data that a small adapter in
each bridge repo (`src/core/guarded.ts`) maps onto Comical's error vocabulary. Comical stays
agnostic, and so does this.

| Module | What it does |
|---|---|
| `guards` | recognises responses that aren't content: Cloudflare challenge/block, DDoS-Guard, a redirect off the site's domains (`domainMoved`) |
| `urls` | mirrors and domain moves: `siteHost`, `hostCovers`, `pathOf`, `rebase`, `pickMirror` |
| `dates` | "3 hours ago", "hace 2 días", "Nov 14, 2026", "14 de noviembre de 2026" → epoch ms, without `Date.parse` (unreliable off V8) |
| `chapters` | chapter numbers from labels ("Vol.2 Ch.15", "Capítulo 40") |
| `status` | publication status words (English and Spanish) → `ongoing`/`completed`/`hiatus`/`cancelled`/`unknown` |
| `text` | `fold`: lowercase and strip accents, with a fallback for engines without `String.prototype.normalize` |
| `md5` | MD5 of a string's UTF-8 bytes as hex, for sites that sign request parameters with it (not for security) |
| `aes` | `aesCbcDecrypt` (AES-128/192/256-CBC) plus `stripZeroPadding` / `stripPkcs7`, for data a page script decrypts with a key in plain sight (not for security) |

## Use

Pin it to a commit, so a bridge bundle's bytes only change when you bump it on purpose:

```jsonc
// package.json
"dependencies": { "comical-bridge-kit": "github:pos5drow/comical-bridge-kit#<commit-sha>" }
```

Published bridge versions are immutable. Bumping the pin changes the bytes of every bridge that uses
a changed helper, so those bridges need a version bump in the same commit.

## Develop

```sh
bun test
```

Everything must run on JavaScriptCore and QuickJS as well as V8: no Node or Bun APIs, no `Intl`, no
non-ISO `Date.parse`.
