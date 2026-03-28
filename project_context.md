# ShoreClean Project Context & Current State

This document is for future developers or AI models joining this repository to understand what's been built, how it's structured, and what the current focus is.

## 1. Project Goal
**ShoreClean** is a gamified beach cleanup platform built for a hackathon. 
- **Volunteers** register, attend cleanups, and earn gamified PDF certificates (Bronze/Silver/Gold) based on hours and waste collected.
- **NGOs/Organizers** create events, generate AI promotional posters (using Stability AI + Cloudinary), and track attendance via a QR scanner.

---

## 2. Tech Stack & App Structure

- **Database:** PostgreSQL (using the `pg` driver)
- **Backend:** Node.js + Express (running on port `5000`)
- **Frontend:** React (Create React App, running on port `3000`)
- **Key Integrations:** 
  - **Cloudinary:** Hosts generated Certificates and AI Posters.
  - **Nodemailer:** Sends HTML emails for event invites and certificate delivery.
  - **Stability AI:** Generates poster background images.
  - **Gemini:** Generates 2-line event descriptions.

---

## 3. "Demo Mode" Configuration (Important!)
To reduce friction during the hackathon pitch, the app is currently in **Demo Mode**:
1. **No Login Walls:** The `jwt` authentication middleware (`verifyToken`, `roleMiddleware`) has been stripped from all critical backend routes (`/events`, `/dashboard`, `/admin`, `/scan`).
2. **Direct Access Routing:** The frontend `App.js` currently routes users to a `HomeScreen` where they can click directly into the Volunteer Dashboard, Organizer Dashboard, or the QR Scanner—no passwords required.
3. **Hardcoded Relations:** Where the database requires a `user_id` or `organizer_id`, the backend currently allows `null` or fetches a default ID (e.g., `SELECT id FROM users LIMIT 1`) to ensure the demo flows don't crash without an active session.

---

## 4. The Recent Teammate Integration
A teammate built the QR attendance module as a separate Next.js/Express app. We have just fully merged their code into our PERN monorepo.

### How it was merged:
1. **Frontend:** Their Next.js `VolunteerScanner` was ported to React (`frontend/src/pages/ScannerPage.js`) using `html5-qrcode`.
2. **Backend Routes:** Their `scan.js` and `registrations.js` routes were copied into our `backend/src/routes/` and mounted in our `index.js`.
3. **Database Adapter:** Because their code used `const { query } = require('../config/db')`, we created an adapter at `backend/src/config/db-query.js` to route their queries through our existing `pg` pool.
4. **Database Schema Fix:** Their app used `UUID` for foreign keys, but our core app uses `SERIAL` (Integers). We wrote a migration (`add_teammate_tables.sql`) that safely adds their `event_registrations` and `scan_logs` tables using `INTEGER REFERENCES` to match our schema.

---

## 5. The Core Technical Flow: Scanning & Gamification

The most complex pipeline in the app is the check-out flow, which ties the teammate's scanner into our gamification engine:

1. **Check-In:** Organizer scans a volunteer's QR code (`POST /api/scan`, type: `checkin`). The `event_registrations` row goes to `ACTIVE`.
2. **Check-Out:** Organizer scans the QR code again (`POST /api/scan`, type: `checkout`). The row goes to `DONE`.
3. **The Bridge (Automated Certificate):** 
   - Inside `scan.js`, the successful checkout fires an asynchronous call to `certificateService.generateAndEmailCertificate()`.
   - This service uses `pdfkit` to draw an A4 landscape certificate.
   - It calculates a badge (Bronze/Silver/Gold) based on the calculated `duration_mins`.
   - It streams the PDF directly to **Cloudinary**.
   - It saves the Cloudinary URL to the `certificates` table.
   - Finally, it uses `emailService.js` to email the PDF link to the volunteer.

---

## 6. Where Things Stand Right Now
- The integration is complete at the code level.
- The SQL migrations have been successfully run by the user.
- The `html5-qrcode` library is installed.
- **The app is ready for end-to-end testing of the QR check-in ➔ check-out ➔ auto-certificate pipeline.**

If you are a new agent picking up this task, your next steps will likely involve running the app, testing the scanner flow, and fixing any UI bugs that arise during the demo walkthrough.
