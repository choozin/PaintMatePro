# PaintPro - Deployment Guide for Vercel

## Overview
This guide walks you through deploying PaintPro (a Vite + Express + Firebase project) to Vercel from GitHub.

## Prerequisites
- GitHub account
- Vercel account (free tier works)
- Firebase project (already configured in this app)

## Step 1: Export from Replit

### Method A: Download as ZIP
1. Click the three-dot menu (⋮) in the Replit file tree
2. Select **"Download as ZIP"**
3. Extract the ZIP on your computer

### Method B: Push to GitHub from Replit (Recommended)
```bash
# In Replit Shell
git init
git add .
git commit -m "Initial commit from Replit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/paintpro.git
git branch -M main
git push -u origin main
```

## Step 2: Prepare for Vercel Deployment

This project uses:
- **Frontend**: Vite + React (client/)
- **Backend**: Express server (server/)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication

### Important Files Already Configured:
- ✅ `vercel.json` - Vercel build configuration
- ✅ `api/index.js` - Serverless API entry point
- ✅ `package.json` - Build scripts

## Step 3: Environment Variables

You'll need to configure these environment variables in Vercel:

### Required Firebase Environment Variables:
1. `VITE_FIREBASE_API_KEY` - Firebase API key
2. `VITE_FIREBASE_APP_ID` - Firebase App ID
3. `VITE_FIREBASE_PROJECT_ID` - Firebase Project ID
4. `SESSION_SECRET` - Session encryption secret (generate a random string)

**Where to find Firebase values:**
- Go to Firebase Console → Project Settings → General
- Scroll to "Your apps" and find the web app config

## Step 4: Deploy to Vercel

### Option A: Vercel Dashboard (Easiest)
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. **Import your GitHub repository**
4. Vercel will auto-detect the framework settings
5. Configure these settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

6. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add all four variables listed in Step 3
   - Apply to: Production, Preview, and Development

7. Click **"Deploy"**

### Option B: Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (run from project root)
vercel

# Follow the prompts:
# - Set up new project? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? paintpro (or your choice)
# - Directory? ./ (default)
# - Override settings? No

# Add environment variables
vercel env add VITE_FIREBASE_API_KEY
vercel env add VITE_FIREBASE_APP_ID
vercel env add VITE_FIREBASE_PROJECT_ID
vercel env add SESSION_SECRET

# Deploy to production
vercel --prod
```

## Step 5: Configure Firebase for Vercel Domain

1. Go to Firebase Console → Authentication → Settings
2. Under **Authorized domains**, add:
   - `your-project-name.vercel.app`
   - Any custom domain you plan to use

3. Go to Firestore → Rules and ensure your security rules are production-ready

## Step 6: Test Your Deployment

Once deployed, test these features:
1. **User Authentication**: Sign up / Log in
2. **Project Creation**: Create a new painting project
3. **Room Measurements**: Add rooms (manual and AR if on mobile)
4. **Quote Generation**: Generate quotes from room data
5. **Client Portal**: Verify client access works

## Vercel-Specific Considerations

### API Routes
- All backend routes are now serverless functions
- They run on-demand (no persistent server)
- Each request is stateless

### Limitations to Know:
- **Serverless timeout**: 10 seconds (free), 60 seconds (Pro)
- **WebSocket support**: Limited (your app uses Firebase Realtime listeners, which work)
- **File uploads**: Use Firebase Storage (already configured)

### Performance Tips:
1. **Enable caching** for static assets (Vercel does this automatically)
2. **Use Firebase Firestore indexes** for complex queries
3. **Implement code splitting** in Vite (already configured)

## Continuous Deployment

Once connected to GitHub:
- Every push to `main` triggers a production deployment
- Pull requests create preview deployments
- Rollback to previous deployments anytime in Vercel dashboard

## Troubleshooting

### Build Fails
- Check Vercel build logs for errors
- Ensure all dependencies are in package.json (not just devDependencies)
- Verify Node version matches (check `engines` in package.json)

### Environment Variables Not Working
- Ensure they're prefixed with `VITE_` for client-side access
- Redeploy after adding/changing environment variables
- Check they're applied to all environments (Production/Preview/Development)

### API Routes Return 404
- Verify `vercel.json` rewrites configuration
- Check that `/api` routes are properly defined
- Look at Vercel function logs in dashboard

### Firebase Auth Not Working
- Verify authorized domains in Firebase Console
- Check CORS settings
- Ensure environment variables are correctly set

## Custom Domain (Optional)

To use your own domain:
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Add the domain to Firebase authorized domains

## Monitoring

Vercel provides:
- **Analytics**: Page views, performance metrics
- **Logs**: Function execution logs
- **Error tracking**: Runtime errors

Access these in: Dashboard → Your Project → Analytics/Logs

## Cost Considerations

**Vercel Free Tier includes:**
- 100GB bandwidth
- 100 hours serverless function execution
- Unlimited websites
- Automatic HTTPS
- Preview deployments

**Firebase Free Tier (Spark Plan):**
- 1GB storage
- 10GB/month bandwidth
- 50,000 reads/day, 20,000 writes/day

For production use, consider upgrading to Vercel Pro + Firebase Blaze plan.

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Vite Deployment**: https://vite.dev/guide/static-deploy

## Next Steps

After successful deployment:
1. ✅ Set up monitoring and alerts
2. ✅ Configure custom domain
3. ✅ Test all features in production
4. ✅ Set up backup strategy for Firebase data
5. ✅ Implement analytics (Firebase Analytics already integrated)
6. ✅ Create documentation for your team

---

**Deployed successfully?** Your PaintPro app is now live at `https://your-project.vercel.app`! 🎉
