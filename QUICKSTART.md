# Quick Start Guide - CampusBite

## Getting Started in 5 Minutes

### 1. Clone & Install
```bash
git clone <repository-url>
cd campusbite

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies (in new terminal)
cd ../backend
pip install -r requirements.txt
```

### 2. Setup Environment

**Frontend** (`frontend/.env`):
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Backend** (`backend/.env`):
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=campusbite
JWT_SECRET=dev-secret-key
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@campusbite.com
ADMIN_PASSWORD=your-strong-admin-password
```

### 3. Start MongoDB
```bash
# Option 1: Local MongoDB
mongod

# Option 2: Use MongoDB Atlas
# Update MONGO_URL with your connection string
```

### 4. Run the App

**Terminal 1 - Backend**:
```bash
cd backend
uvicorn server:app --reload --port 8001
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm start
```

### 5. Access the App
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001/api/

## Credentials

Configure admin and staff credentials through environment variables only.

Example:
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` for admin seed
- `STAFF_SEED_JSON` for optional staff seed (email/name/canteen_id/password per staff entry)

**Student:**
- AUID: Any valid format (e.g., AIT26TEST01)
- Or Phone: Any 10-digit number

## Project Structure

```
campusbite/
├── frontend/           # React app (Port 3000)
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── contexts/      # State management
│   │   ├── pages/         # Route pages
│   │   └── lib/           # Utilities
│   └── package.json
│
├── backend/            # FastAPI (Port 8001)
│   ├── server.py          # Main API
│   └── requirements.txt
│
└── README.md           # Full documentation
```

## Common Commands

```bash
# Frontend
npm start              # Development server
npm run build          # Production build
npm test               # Run tests

# Backend
uvicorn server:app --reload    # Development server
python -m pytest               # Run tests
```

## Features Overview

### Students
- Browse menu by canteen
- Add items to cart
- Place orders (counter payment or QR/UPI)
- Track order status
- Receive notifications

### Canteen Staff
- View incoming orders
- Update order status (Placed → Preparing → Ready)
- Toggle menu item availability
- View paid/priority orders first

### Super Admin
- Manage all canteens
- Add/edit menu items
- Configure UPI payment per canteen
- Manage staff accounts
- Override payment status

## Next Steps

1. **Customize Canteens**: Login as admin, edit canteen details
2. **Add Menu Items**: Navigate to Menu Items tab
3. **Configure Payments**: Add UPI IDs and enable QR payments
4. **Test Ordering**: Place a test order as student
5. **Deploy**: Follow DEPLOYMENT.md guide
6. **Supabase Auth**: Follow SUPABASE_SETUP.md

## Development Tips

- **Hot Reload**: Both frontend and backend support hot reload
- **Path Aliases**: Use `@/` for absolute imports in frontend
- **API Testing**: Use `curl` or Postman with `http://localhost:8001/api/`
- **Database**: Check MongoDB Compass for visual database access

## Troubleshooting

**Port Already in Use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 8001
lsof -ti:8001 | xargs kill -9
```

**MongoDB Connection Failed:**
- Ensure MongoDB is running
- Check MONGO_URL format
- Try MongoDB Atlas if local setup fails

**Build Fails:**
- Delete `node_modules` and run `npm install` again
- Ensure Node.js version is 18+
- Check for syntax errors in console

## Need Help?

- Check README.md for full documentation
- See DEPLOYMENT.md for deployment guide
- Review code comments for implementation details

Happy Coding! 🚀
