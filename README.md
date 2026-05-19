# Interview Coach — Vercel Deployment

AI mock interview app powered by Claude. No API key required from users — key is stored securely as a Vercel environment variable.

## Project structure


```
interview-coach/
├── index.html        # Full app (landing, setup, interview, summary)
├── style.css         # Design system
├── app.js            # Frontend logic — calls /api/claude
├── vercel.json       # Vercel routing config
├── api/
│   └── claude.js     # Serverless function — proxies Anthropic API
└── README.md
```




## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
Create a new GitHub repo and upload all these files (keep the `api/` folder structure).

### 2. Import to Vercel
- Go to [vercel.com](https://vercel.com) and sign up (free)
- Click **"Add New Project"**
- Import your GitHub repo
- Click **Deploy** (no build settings needed)

### 3. Add your API key
- In your Vercel project, go to **Settings → Environment Variables**
- Add a new variable:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** `sk-ant-...` (your key from console.anthropic.com)
- Click **Save**


### 4. Redeploy
- Go to **Deployments** tab
- Click the three dots on your latest deployment → **Redeploy**

Your site is now live at `https://your-project.vercel.app` — no API key required from users.

## How the proxy works

The frontend calls `/api/claude` instead of Anthropic directly.
The `api/claude.js` serverless function adds your secret key server-side and forwards the request.
Users never see your key.




## Cost note
Each 5-question session costs roughly $0.01 in API usage.
Consider adding rate limiting if your app gets heavy traffic.

