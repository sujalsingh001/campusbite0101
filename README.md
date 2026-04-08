# CampusBite - College Canteen Token System

A digital token system for college canteens to eliminate physical queues and streamline order management.

## Features

- **Student Ordering**: Browse menu, place orders, receive digital tokens
- **QR Payment**: Optional UPI payment with priority queue
- **Canteen Dashboard**: Manage orders with simple status updates
- **Admin Panel**: Manage canteens, menu items, and QR payments
- **Real-time Updates**: SSE notifications for order status

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python), MongoDB
- **Authentication**: JWT tokens
- **Payments**: UPI integration with QR codes

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

## Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Import repository in Vercel
3. Configure:
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
4. Add environment variable:
   - `REACT_APP_BACKEND_URL`: Your backend API URL

### Backend
Deploy on any platform supporting Python/FastAPI:
- Railway
- Render
- AWS/Google Cloud

Set environment variables:
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name
- `JWT_SECRET`: Secret key for JWT
- `CORS_ORIGINS`: Frontend URL

## Environment Variables

### Frontend (`frontend/.env`)
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Backend (`backend/.env`)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=campusbite
JWT_SECRET=your-secret-key
CORS_ORIGINS=https://your-frontend-url.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-strong-admin-password

# Supabase Auth (college-restricted students)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
ALLOWED_EMAIL_DOMAIN=acharya.ac.in
ALLOW_LEGACY_STUDENT_LOGIN=false
```

## Project Structure

```
/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── contexts/     # React contexts
│   │   ├── pages/        # Page components
│   │   └── lib/          # Utilities
│   ├── public/
│   └── package.json
├── backend/           # FastAPI application
│   ├── server.py      # Main application
│   └── requirements.txt
└── vercel.json        # Vercel deployment config
```

## Build for Production

```bash
cd frontend
npm run build
```

Output: `frontend/build/`

## Supabase Auth Setup

See `SUPABASE_SETUP.md` for complete setup (SQL, auth settings, backend env, and Vercel env).

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
