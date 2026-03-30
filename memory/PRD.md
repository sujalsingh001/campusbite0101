# CampusBite - College Canteen Token System

## Problem Statement
Mobile-first web app for college canteen token system to reduce crowds and eliminate physical queues. Students browse menu, place orders, get a unique token with real-time tracking (Order placed -> Preparing -> Ready). Canteen staff view and update order statuses. 3-panel system: Student, Canteen Admin, Super Admin. Secret 5-tap door on landing page logo reveals hidden admin access.

## Architecture
- Frontend: React + Tailwind CSS + Shadcn UI (Neo-brutalist design)
- Backend: FastAPI + MongoDB (Motor)
- Auth: JWT-based
- Real-time: SSE (Server-Sent Events) for push notifications

## Completed Features
- Full student order and token flow APIs
- Canteen Staff and Super Admin Dashboards
- Hidden admin/canteen panel buttons (5-tap secret door on logo)
- AUID-based student login with validation (>7 chars, mix of letters & numbers)
- Phone number fallback login when AUID is invalid
- Landing page: enlarged logo (284px), removed heading/subtitle text
- Edit canteen names/descriptions in Admin Dashboard
- Removed non-functional notification bell from Canteen Dashboard
- Sequential token generation
- **Real-time push notifications via SSE** — students get toast notifications when order moves to "Preparing" and "Ready"
- Sonner toasts with neo-brutalist styling + mobile vibration

## Upcoming Tasks (P1)
- Gmail Login integration for Canteen Admins

## Key Credentials
- See /app/memory/test_credentials.md
