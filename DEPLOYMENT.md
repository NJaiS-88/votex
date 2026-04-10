# Deployment Guide (Vercel + Realtime Backend)

This project has:
- `frontend` (React + Vite) -> deploy on Vercel
- `backend` (Express + Socket.IO + MongoDB) -> deploy on a Node host (Render/Railway/EC2)

## Why backend is not on Vercel

Your app uses Socket.IO real-time signaling for meetings. Vercel serverless functions are not suitable for long-lived WebSocket server processes in this architecture.

Use Vercel for frontend, and deploy backend on a persistent Node server platform.

## 1) Deploy backend first

Deploy `backend` to Render (or Railway) with:
- Build command: `npm install`
- Start command: `npm start`

Environment variables:
- `MONGODB_URI`
- `JWT_SECRET`
- `PORT` (optional on some hosts)

After deploy, note backend URL:
- Example: `https://your-backend.onrender.com`

## 2) Deploy frontend to Vercel

In Vercel:
- Import repo
- Set root directory to `frontend`
- Framework preset: Vite

Environment variables in Vercel project:
- `VITE_API_URL=https://your-backend.onrender.com/api`
- `VITE_SOCKET_URL=https://your-backend.onrender.com`

`frontend/vercel.json` is already configured for SPA routing.

## 3) Update backend CORS (if needed)

If your backend host blocks requests, allow your Vercel domain in backend CORS config.

## 4) Verify production

- Signup/Login works
- Meeting join with same ID works between two devices
- Chat, reactions, mute/cam controls work
- Recording metadata saves in MongoDB

