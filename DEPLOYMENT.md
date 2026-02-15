# ArtFreak Deployment Guide

This guide will help you deploy ArtFreak to production. You have several deployment options:

## 🚀 Quick Deploy Options

### Option 1: Vercel (Frontend) + Railway (Backend) - EASIEST
**Cost**: Free tier available, then $5-20/month
**Difficulty**: ⭐⭐☆☆☆

#### Frontend (Vercel):
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign up
3. Click "New Project" → Import your GitHub repo
4. Set build command: `npm run build`
5. Set output directory: `dist`
6. Deploy!

#### Backend (Railway):
1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → Deploy from GitHub repo
3. Select your backend folder (`wb-backend`)
4. Set environment variables:
   ```
   PORT=1234
   HOST=0.0.0.0
   ENVIRONMENT=production
   ```
5. Deploy and get your backend URL

### Option 2: Netlify (Frontend) + Render (Backend) - GOOD ALTERNATIVE
**Cost**: Free tier available, then $7-25/month
**Difficulty**: ⭐⭐⭐☆☆

#### Frontend (Netlify):
1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git" → GitHub
4. Set build command: `npm run build`
5. Set publish directory: `dist`
6. Deploy!

#### Backend (Render):
1. Go to [render.com](https://render.com)
2. Click "New Web Service" → Connect GitHub
3. Select your backend repo
4. Set build command: `npm install`
5. Set start command: `node ws-server.js`
6. Deploy!

### Option 3: DigitalOcean App Platform - MOST CONTROL
**Cost**: $5-25/month
**Difficulty**: ⭐⭐⭐⭐☆

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create account and add payment method
3. Go to "Apps" → "Create App"
4. Connect GitHub and select your repo
5. Configure both frontend and backend services
6. Deploy!

## 🔧 Required Changes Before Deploying

### 1. Update API URLs
In `wb-frontend/src/routes/Home.jsx`, change:
```javascript
const API = (import.meta.env.MODE === 'development')  
  ? 'http://localhost:1234' 
  : 'https://your-backend-url.com'; // Update this!
```

### 2. Update CORS Origins
In `wb-backend/ws-server.js`, change:
```javascript
origin: environment === 'production' 
  ? ['https://your-domain.com', 'https://www.your-domain.com'] 
  : ['http://localhost:5173'],
```

### 3. Environment Variables
Create `.env` file in backend:
```bash
PORT=1234
HOST=0.0.0.0
ENVIRONMENT=production
```

## 🌐 Domain Setup

### 1. Buy a Domain
- [Namecheap](https://namecheap.com) - $10-15/year
- [Google Domains](https://domains.google) - $12/year
- [GoDaddy](https://godaddy.com) - $12-15/year

### 2. Point to Your Deployment
- **Vercel**: Add custom domain in project settings
- **Netlify**: Add custom domain in site settings
- **Railway/Render**: Use their provided URLs or set up custom domains

## 📱 Mobile App (Optional)

### PWA Features
Your app already has PWA capabilities! Just:
1. Update `public/manifest.json` with ArtFreak branding
2. Test on mobile devices
3. Users can "Add to Home Screen"

## 🔒 Security Considerations

### 1. Rate Limiting
✅ Already implemented in backend

### 2. CORS
✅ Already configured

### 3. Input Sanitization
✅ Already implemented

### 4. HTTPS
✅ Automatically handled by deployment platforms

## 📊 Monitoring & Analytics

### 1. Health Check
Your backend has a health endpoint: `/health`

### 2. Logs
- **Vercel**: Built-in logging
- **Railway**: Built-in logging
- **Render**: Built-in logging

### 3. Performance
- **Vercel**: Built-in analytics
- **Netlify**: Built-in analytics

## 🚨 Common Issues & Solutions

### 1. CORS Errors
- Check your backend CORS origins match your frontend domain
- Ensure environment variables are set correctly

### 2. WebSocket Connection Issues
- Verify backend URL is correct
- Check if your deployment platform supports WebSockets

### 3. Build Failures
- Ensure all dependencies are in `package.json`
- Check Node.js version compatibility

## 💰 Cost Breakdown

### Free Tier (Recommended to start):
- **Frontend**: Vercel/Netlify - $0/month
- **Backend**: Railway/Render - $0/month (limited usage)
- **Domain**: $10-15/year
- **Total**: ~$15/year

### Paid Tier (When you scale):
- **Frontend**: Vercel Pro - $20/month
- **Backend**: Railway Pro - $20/month
- **Domain**: $15/year
- **Total**: ~$40/month

## 🎯 Next Steps

1. **Choose deployment option** (I recommend Vercel + Railway)
2. **Update API URLs** in your code
3. **Deploy backend first**, then frontend
4. **Test everything** works
5. **Add custom domain**
6. **Share with the world!**

## 🆘 Need Help?

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Netlify Docs**: [docs.netlify.com](https://docs.netlify.com)
- **Render Docs**: [render.com/docs](https://render.com/docs)

Good luck with your ArtFreak deployment! 🎨✨
