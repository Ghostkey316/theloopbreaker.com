# Deployment Guide

## Quick Deploy to Vercel (Recommended)

### 1. Prepare Your Environment

Get a WalletConnect Project ID:
1. Go to https://cloud.walletconnect.com/
2. Sign up or log in
3. Create a new project
4. Copy your Project ID

### 2. Deploy

**Option A: Deploy via Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# From the project root
cd apps/verified-dm-demo

# Deploy
vercel

# Add environment variable when prompted:
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = your_project_id
```

**Option B: Deploy via Vercel Dashboard**

1. Push this code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Set Root Directory to `apps/verified-dm-demo`
5. Add environment variable:
   - Key: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - Value: Your WalletConnect Project ID
6. Click "Deploy"

### 3. Share the Link

Once deployed, you'll get a URL like:
```
https://verified-dm-demo.vercel.app
```

Share this with Shane Mac or anyone who wants to test!

## Alternative Deployments

### Netlify

```bash
# Build the app
npm run build

# Deploy to Netlify
npx netlify-cli deploy

# Set environment variables in Netlify dashboard
```

### Self-Hosted (VPS/Cloud)

```bash
# Build for production
npm run build

# Start production server
npm run start

# Or use PM2 for process management
pm2 start npm --name "verified-dms" -- start
```

## Environment Variables

Required:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Your WalletConnect Project ID

Optional:
- `NEXT_PUBLIC_BASE_RPC_URL` - Custom Base RPC endpoint
- `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` - Custom Base Sepolia RPC endpoint

## Post-Deployment

### Test the deployment:
1. Visit your deployed URL
2. Connect wallet
3. Send a test message
4. Verify the spam filtering works

### Monitor:
- Check Vercel/Netlify logs for any errors
- Monitor XMTP message delivery
- Track verification performance

## Troubleshooting

**Wallet connection fails:**
- Verify NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set correctly
- Check browser console for errors
- Ensure you're on a supported network (Base, Base Sepolia)

**XMTP initialization fails:**
- XMTP requires the wallet to sign a message
- Make sure you approve the signature request
- Check that you have sufficient gas for transaction

**Messages not appearing:**
- XMTP messages may take a few seconds to propagate
- Refresh the page to force a reload
- Check browser console for errors

## Performance Optimization

For production deployments:

1. **Enable caching:**
   - Configure CDN caching headers
   - Cache static assets aggressively

2. **Optimize bundle:**
   - Use Next.js Image optimization
   - Enable compression in vercel.json

3. **Monitor performance:**
   - Set up Vercel Analytics
   - Monitor Core Web Vitals
   - Track XMTP latency

## Security Checklist

Before sharing publicly:

- ✅ Environment variables are set securely (not in code)
- ✅ No private keys or secrets in the repository
- ✅ CORS is properly configured
- ✅ Rate limiting is enabled
- ✅ Error messages don't leak sensitive info

---

**Ready to deploy?** 🚀

Follow the steps above and you'll have a live demo in minutes!
