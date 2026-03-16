# Promptly

A Chrome extension that transforms raw, vague AI prompts into structured, high-quality prompts using proven prompt engineering frameworks. It also measures the real output token savings of using a structured prompt vs a raw one by running both through GPT-4o in parallel.

---

## What It Does

Most people get poor results from AI tools because their prompts are too vague. Promptly fixes this by automatically rewriting your prompt using one of three frameworks:

- **TCRTE** (Role, Context, Task, Constraints, Output Format) — best for work, school, planning, email
- **Chain-of-Thought** — best for math, decisions, debugging, step-by-step reasoning
- **Few-Shot** — best for copying a style, format, tone, or pattern

After optimizing, Promptly runs both your original and optimized prompt through GPT-4o and shows you the real output token difference — proving whether the structured prompt produces a more focused, cheaper response.

Users sign in with Google, get 10 free optimizations per day, and their last 10 prompts are saved to a history tab with copy, favourite, and delete options.

---

## Features

- Google OAuth sign-in (no passwords)
- Three prompt engineering frameworks with use-case chips
- Real output token comparison using parallel GPT-4o calls
- Cost per 100 uses displayed for raw vs optimized prompt
- Prompt history (last 10) synced to MongoDB — works across devices
- Favourite, copy, and delete on history entries
- Tier system: Basic (10/day), Pro (50/day), Admin (unlimited)
- Security: JWT auth, input sanitization, injection blocking, IP rate limiting, Helmet headers, NoSQL injection protection

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3, Vanilla JS |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | Google OAuth 2.0 + JWT |
| AI | OpenAI GPT-4o |
| Hosting | Railway (or any Node host) |

---

## Project Structure

```
promptly/
├── extension/               # Chrome extension files
│   ├── manifest.json        # Extension config, permissions, OAuth client ID
│   ├── popup.html           # Full UI — sign in, optimize, history views
│   ├── popup.js             # UI logic, framework definitions, token display
│   ├── background.js        # Service worker — handles Google OAuth flow
│   ├── api.js               # Fetch wrapper with JWT auth
│   └── auth.js              # chrome.storage helpers for token/user
│
└── backend/                 # Node.js Express backend
    ├── server.js            # Entry point, middleware stack
    ├── config/
    │   └── db.js            # MongoDB connection
    ├── models/
    │   ├── User.js          # User schema — tier, usage, daily reset
    │   └── PromptHistory.js # History schema — prompts, token stats, favourites
    ├── routes/
    │   ├── auth.js          # POST /auth/google, GET /auth/me, POST /auth/signout
    │   ├── optimize.js      # POST /optimize — runs parallel GPT calls
    │   └── history.js       # GET/DELETE /history, PATCH /history/:id/favourite
    ├── middleware/
    │   ├── auth.js          # JWT verification
    │   ├── rateLimit.js     # Per-user daily tier limit via MongoDB
    │   └── globalRateLimit.js # IP-based rate limiting (global + auth routes)
    └── utils/
        ├── sanitize.js      # Input sanitization, injection detection, char limits
        └── tiers.js         # Tier definitions and limit helpers
```

---

## Setup Guide

### Prerequisites

- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- An [OpenAI](https://platform.openai.com) account with API access
- A [Google Cloud Console](https://console.cloud.google.com) project
- A [Railway](https://railway.app) account (or any Node hosting)
- A [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee) — required for a fixed extension ID

---

### Step 1 — MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with a password
3. Under **Network Access** add `0.0.0.0/0` to allow all IPs
4. Click **Connect** → **Drivers** → copy the connection string
5. Replace `<username>` and `<password>` in the string — save it for later

---

### Step 2 — OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key — save it for later

---

### Step 3 — Deploy the Backend

1. Push the `backend/` folder to a GitHub repository
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Go to your service → **Variables** tab and add:

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI key |
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and paste the output |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID (set up in Step 4) |

5. Railway will deploy automatically. Note your Railway URL — it looks like `https://your-app.up.railway.app`

---

### Step 4 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Go to **APIs & Services** → **Library** → enable the **People API**
4. Go to **APIs & Services** → **OAuth consent screen**
   - Select **External**
   - Fill in app name (Promptly), your email, and save
5. Go to **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Chrome Extension**
   - Name: Promptly
   - Item ID: your Chrome Web Store extension ID (from Step 5)
6. Copy the **Client ID** — it ends in `.apps.googleusercontent.com`
7. Add this Client ID to Railway as `GOOGLE_CLIENT_ID`

---

### Step 5 — Chrome Web Store (required for fixed extension ID)

A fixed extension ID is required so Google OAuth works for all users, not just you.

1. Go to [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) and pay the $5 registration fee
2. Click **New Item** and upload a zip of the `extension/` folder
3. The store assigns your extension a **permanent ID** immediately — copy it
4. Use this ID as the **Item ID** in your Google Cloud OAuth client (Step 4)
5. You can keep the listing as **Unlisted** — only people with your direct link can install it

---

### Step 6 — Configure the Extension

Open `extension/api.js` and `extension/background.js` and replace:

```javascript
const BACKEND_URL = "YOUR_BACKEND_URL_HERE";
```

With your Railway URL:

```javascript
const BACKEND_URL = "https://your-app.up.railway.app";
```

Open `extension/manifest.json` and replace:

```json
"client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

With your actual Google OAuth Client ID.

---

### Step 7 — Set Your Admin Email

Open `backend/routes/auth.js` and replace:

```javascript
const ADMIN_EMAIL = "YOUR_ADMIN_EMAIL@gmail.com";
```

With your Google account email. This account will automatically get the **Admin** tier (unlimited prompts) every time it signs in.

---

### Step 8 — Add the Extension Key (for local testing)

To make your local extension use the same ID as the Web Store version:

1. Go to your Chrome Web Store developer console → your listing → **Package** tab
2. Download your uploaded package and unzip it
3. Copy the `"key"` field from that `manifest.json`
4. Paste it into your local `extension/manifest.json`

This ensures Google OAuth works when loading the extension locally via developer mode.

---

### Step 9 — Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder
4. The Promptly icon will appear in your toolbar

---

## Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `JWT_SECRET` | Generate locally: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → OAuth 2.0 Client ID |

---

## Tier System

Tiers are stored per user in MongoDB. To change a user's tier, find their document in the `users` collection and update the `tier` field.

| Tier | Daily limit |
|---|---|
| `basic` | 10 prompts |
| `pro` | 50 prompts |
| `admin` | Unlimited |

Daily usage resets at midnight EST. The admin email set in `routes/auth.js` is automatically assigned the `admin` tier on every sign-in.

---

## Token Comparison — How It Works

When a user clicks **Perfect This Prompt**, the backend fires two GPT-4o calls simultaneously using `Promise.all`:

1. **Optimization call** — rewrites the raw prompt using the selected framework
2. **Baseline call** — runs the raw prompt as-is with a simple "be concise" system prompt, capped at 512 tokens

Both calls return `usage.completion_tokens` from OpenAI's API — the actual number of output tokens generated. The difference is shown as a real measured saving, not an estimate.

Pricing used for the cost card: **$10.00 per 1M output tokens** (GPT-4o rate as of 2024 — update `OUTPUT_COST_PER_TOKEN` in `routes/optimize.js` if this changes).

---

## License

MIT — free to use, modify, and distribute.
