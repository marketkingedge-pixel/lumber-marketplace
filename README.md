# Local Lumber Marketplace — Prototype

A working prototype: local lumber companies' specials/close-outs in one place, a public material request board, and an AI-powered Project Scanner that turns a photo + a couple of details into a materials list and cost estimate.

## Run it

Requires Node.js 18+.

```bash
cd lumber-marketplace
npm install
cp .env.example .env
```

Open `.env` and set `ADMIN_PASSWORD` to whatever you want. Leave `ANTHROPIC_API_KEY` blank for now — see below.

```bash
npm start
```

Visit `http://localhost:3000`. Admin area is at `/admin` (password from `.env`).

## What's in the prototype

- **Browse Specials** (`/`) — public listing board with filters. Seeded with 3 sample companies and 5 sample listings.
- **Material Request Board** (`/requests`) — anyone can post what they need; you (admin) mark requests fulfilled or remove them.
- **Company Directory** (`/companies`) — participating companies and their active listings.
- **Project Scanner** (`/scanner`) — upload a photo of a project area, pick a project type, enter rough dimensions, and get back a materials list + cost range, with a one-click handoff to post it as a request.
- **Admin** (`/admin`) — password-protected. Add/edit/remove listings and companies, moderate requests.

## How the Project Scanner works

Without any setup, it runs in **rule-of-thumb mode**: a small lookup table (deck, fence, shed, retaining wall, other) turns your entered dimensions into a materials list and rough cost — no AI call, works immediately, good enough to demo the flow.

To turn on **real AI photo analysis**, get an API key from https://console.anthropic.com, add it to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Restart the server. Now the photo itself gets analyzed by Claude alongside the dimensions and notes you enter, and the estimate reflects what's actually in the picture (condition, materials visible, etc.), not just a formula. If the AI call ever fails, it automatically falls back to the rule-of-thumb estimate so the feature never dead-ends.

The estimator logic lives in `lib/estimator.js` — the rule-of-thumb tables there are placeholders using generic national pricing. Swap in your own local pricing before relying on these numbers for real quotes.

## Data storage

Everything is stored in `data/db.json` — a plain JSON file, not a real database. That's intentional for a prototype: zero setup, easy to inspect/edit by hand, easy to reset (just restore the seed data). Before a real launch, swap this for a proper database (Postgres, SQLite via a real driver, etc.) — the `db.js` module is the only place that would need to change.

## Known prototype limitations (by design, for now)

- Companies don't have their own logins — you manage listings on their behalf (matches Phase 1 of the spec doc).
- Admin sessions are in-memory — restarting the server logs you out.
- No email/SMS notifications yet when someone responds to a request.
- Rule-of-thumb pricing is generic, not localized.

## Suggested next steps

1. Swap in your real local company list and current specials.
2. Get an Anthropic API key and turn on real AI scanning.
3. Decide on hosting (Netlify/Vercel/Render all work for an app this size) and a domain.
4. When ready, move `data/db.json` to a real database.
