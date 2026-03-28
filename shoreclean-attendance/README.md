# ShoreClean Attendance System

ShoreClean Attendance System is a QR-based volunteer attendance platform for beach cleanup events. It allows volunteers to register and receive event QR passes, while NGO/admin operators scan check-in and check-out in real time.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Database Setup

```bash
createdb shoreclean
psql -d shoreclean -f database/schema.sql
```

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DB credentials
```

Add this dev script in backend package.json scripts:

```json
"dev": "node --watch server.js"
```

Run backend:

```bash
npm run dev
```

Backend default URL: http://localhost:5000

## Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend default URL: http://localhost:3000

## Test Accounts

- NGO/Scanner: ngo@test.com / password123
- Volunteer: volunteer@test.com / password123

## Feature Walkthrough

1. Register as a volunteer.
2. Browse events at /events.
3. Register for an event and receive a QR token.
4. Open /dashboard to view your generated QR code.
5. Log in as NGO account and open /volunteer/scanner.
6. Select the event, choose Check-In mode, and scan volunteer QR.
7. After cleanup, switch to Check-Out mode and scan the same QR.
8. Duration is calculated automatically during checkout.

## API Reference

| Endpoint | Method | Auth | Description |
| --- | --- | --- | --- |
| /api/health | GET | No | Service health check |
| /api/auth/register | POST | No | Register a user and return token |
| /api/auth/login | POST | No | Authenticate user and return token |
| /api/auth/me | GET | User token | Return current user profile |
| /api/events | GET | No | List all events with registered_count |
| /api/events/:id | GET | No | Get single event details |
| /api/events | POST | User token (ngo/admin) | Create event |
| /api/registrations | POST | User token | Register current user for event |
| /api/registrations/my | GET | User token | Get current user registrations with event details |
| /api/scan | POST | Volunteer scanner token (ngo/admin) | Process QR check-in or check-out |
| /api/scan/event/:event_id/status | GET | Volunteer scanner token (ngo/admin) | Live registration status for one event |

## Project Structure

- backend: Express API, auth, event, registration, and scan routes
- frontend: Next.js pages and reusable components
- database: PostgreSQL schema and seed data
