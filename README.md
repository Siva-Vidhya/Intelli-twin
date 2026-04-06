# IntelliTwin – Personal AI Digital Twin

IntelliTwin is an AI-powered study planner, tracking, and analytics platform that transforms your digital learning experience.

## Live Deployment
**https://intellitwin.vercel.app**

## Deployment Instructions

This project is configured for seamless deployment on Vercel from a GitHub repository.

### Step 1: Connect to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Select **Import from Git Repository** and choose `Intelli-twin`.
4. Configure the project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (or `intellitwin-app` if deploying a subfolder)
   - Configuration is automatically handled by the included `vercel.json`.

### Step 2: Environment Variables
During import (or in Vercel Project Settings > Environment Variables), you **must** add the following environment variables. Use the `.env.example` file for reference:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

### Step 3: Deploy
1. Click **Deploy**.
2. Once the build finishes, Vercel will set up Continuous Deployment. Every time you push to the `main` branch on GitHub, Vercel will automatically redeploy the application.

## Local Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
