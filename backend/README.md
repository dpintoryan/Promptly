# PromptPerfect — Backend v2

Secure Node.js/Express backend with Google OAuth, MongoDB user management, and tier-based rate limiting.

---

## Architecture

```
Chrome Extension
  ├─ background.js  → Google OAuth (chrome.identity)
  ├─ auth.js        → Token storage (chrome.storage.local)
  ├─ api.js         → Fetch wrapper (attaches JWT)
  └─ popup.js       → UI state machine

Railway Backend
  ├─ POST /auth/google   → verify Google token → create/update user → return JWT
  ├─ GET  /auth/me       → validate JWT → return current user data
  ├─ POST /auth/signout  → (stateless; extension clears storage)
  ├─ POST /optimize      → verify JWT + tier limit → call OpenAI → return result
  └─ GET  /health        → Railway health check

MongoDB Atlas
  └─ users collection    → stores profile, tier, daily usage, reset date
```

---

## Environment Variables

Set all of these in Railway's **Variables** tab:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers → copy connection string |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |

---

## Setup Guide

### 1. MongoDB Atlas

1. Go to https://cloud.mongodb.com and create a free account
2. Create a new **free** cluster (M0)
3. Under **Database Access**: create a user with Read/Write permissions
4. Under **Network Access**: click "Allow access from anywhere" (0.0.0.0/0)
5. Click **Connect → Drivers**, copy the connection string
6. Replace `<username>` and `<password>` in the string with your DB user credentials
7. Add the full string as `MONGODB_URI` in Railway

### 2. Google Cloud OAuth

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Enable the **Google+ API** or **People API** (under APIs & Services → Library)
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Chrome Extension**
6. Under "Item ID": paste your Chrome extension's ID
   - Load the extension in Chrome first to get its ID from chrome://extensions
7. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)
8. Add it as `GOOGLE_CLIENT_ID` in Railway
9. Also paste it into `manifest.json` in the extension: replace `YOUR_GOOGLE_CLIENT_ID`

### 3. JWT Secret

Run this in your terminal and copy the output:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Add the output as `JWT_SECRET` in Railway.

### 4. Deploy to Railway

```bash
# In the promptperfect-backend folder:
git add .
git commit -m "v2: add auth, MongoDB, tiers"
git push
```
Railway auto-redeploys. Check the **Deployments** tab.

### 5. Update Extension Files

In `api.js` AND `background.js`, replace:
```
https://YOUR-RAILWAY-URL.up.railway.app
```
with your actual Railway domain.

In `manifest.json`, replace:
```
YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```
with your actual Google Client ID.

---

## Admin Access

`YOUR_ADMIN_EMAIL` is set in `routes/auth.js`.
Admin accounts get unlimited prompts and bypass all rate limit checks.
To change the admin email, edit the `ADMIN_EMAIL` constant in `routes/auth.js`.

---

## Tiers

| Tier | Daily Limit | Notes |
|---|---|---|
| basic | 10 | Default for all new users |
| pro | 50 | Exists in code; no payment flow yet |
| admin | Unlimited | Auto-assigned to admin email on sign in |

---

## Project Structure

```
promptperfect-backend/
├── server.js              ← Entry point
├── config/db.js           ← MongoDB connection
├── models/User.js         ← Mongoose schema + daily reset logic
├── middleware/auth.js     ← JWT verification
├── middleware/rateLimit.js← Tier enforcement + daily reset
├── routes/auth.js         ← Google OAuth + JWT issuance
├── routes/optimize.js     ← Prompt optimization endpoint
├── utils/tiers.js         ← Tier config (limits, names)
├── package.json
├── railway.toml
├── .env.example
└── README.md
```

---

## Updating & Redeploying

Any push to `main` triggers an automatic Railway redeploy:
```bash
git add .
git commit -m "your change"
git push
```
