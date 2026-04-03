# Deployment Guide - CampusBite

## Quick Deploy to Vercel (Frontend)

### Option 1: GitHub Integration
1. Push code to GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`
6. Add Environment Variable:
   - Key: `REACT_APP_BACKEND_URL`
   - Value: Your backend API URL (e.g., `https://api.campusbite.com`)
7. Click "Deploy"

### Option 2: Vercel CLI
```bash
cd frontend
npm install -g vercel
vercel
# Follow prompts
```

## Deploy Backend

### Railway.app
1. Go to [Railway](https://railway.app)
2. Create new project from GitHub
3. Select `backend` directory
4. Add environment variables:
   - `MONGO_URL`
   - `DB_NAME`
   - `JWT_SECRET`
   - `CORS_ORIGINS` (your Vercel frontend URL)
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Railway will auto-deploy

### Render.com
1. Go to [Render](https://render.com)
2. New Web Service
3. Connect repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (same as Railway)
6. Deploy

## MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow from anywhere)
5. Get connection string
6. Use in `MONGO_URL` environment variable

### Option 2: Local MongoDB
```bash
# Install MongoDB locally
# Update MONGO_URL to: mongodb://localhost:27017
```

## Environment Variables Reference

### Frontend
```env
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

### Backend
```env
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=campusbite
JWT_SECRET=your-random-secret-key-here
CORS_ORIGINS=https://your-app.vercel.app
ADMIN_EMAIL=admin@campusbite.com
ADMIN_PASSWORD=SecurePassword123
```

## Post-Deployment Checklist

- [ ] Frontend accessible at Vercel URL
- [ ] Backend API responding at `/api/`
- [ ] Can login as admin
- [ ] Can login as student
- [ ] Can place orders
- [ ] QR payment working (if UPI IDs configured)
- [ ] Notifications working

## Troubleshooting

### Build Fails
- Check Node version (must be 18+)
- Run `npm install` locally first
- Check for syntax errors

### API Not Connecting
- Verify `REACT_APP_BACKEND_URL` is correct
- Check CORS settings in backend
- Ensure backend is deployed and running

### Database Connection Failed
- Verify `MONGO_URL` format
- Check MongoDB Atlas IP whitelist
- Ensure database user has correct permissions

## Custom Domain

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Backend
1. Add custom domain in Railway/Render
2. Update `REACT_APP_BACKEND_URL` in Vercel

## Continuous Deployment

Both Vercel and Railway/Render support auto-deployment:
- Push to `main` branch → Auto-deploy
- Pull requests → Preview deployments

## Local Testing Before Deploy

```bash
# Frontend
cd frontend
npm install
npm run build
npm install -g serve
serve -s build

# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

## Support

For deployment issues:
- Check build logs in Vercel dashboard
- Check runtime logs in Railway/Render
- Verify environment variables are set correctly
