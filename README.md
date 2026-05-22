# Student Course Registration

This repository contains a small Student Course Registration system with:

- Backend: Node.js + Express serving API endpoints and a simple JSON file database
- Frontend: React + Vite single-page app with a responsive registration form

Quick start (develop):

1. Backend

```bash
cd "d:/Downloads/Final question/student-registration/backend"
npm install
npm run dev
```

2. Frontend

```bash
cd "d:/Downloads/Final question/student-registration/frontend"
npm install
npm run dev
```

Build & serve production (single host):

```bash
cd frontend
npm run build
cd ../backend
# copy frontend/dist into backend's ../frontend/dist (already referenced by server)
npm start
```

Deployment suggestions:
- Deploy backend to Render, Railway or Heroku and frontend to Vercel/Netlify, or build frontend and serve static files from the backend.
