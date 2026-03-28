# ShoreClean Architecture & Implementation Guide

This document provides a comprehensive overview of the ShoreClean project's structure, focusing on the recent integration of the teammate's attendance/QR scanning module into the main platform. It is designed to help other models and developers understand the current state of the codebase.

## 1. Project Overview

ShoreClean is a gamified beach cleanup platform built for a hackathon. It connects Volunteers (who clean beaches and earn rewards/certificates) with NGOs/Organizers (who host events, generate AI posters, and manage attendance).

The current version operates in **Demo Mode**:
- **Authentication is disabled** on critical routes to ensure frictionless testing by judges.
- Users bypass login screens and select their persona (Volunteer, Organizer, or QR Scanner) directly from the `HomeScreen`.
- Database operations often rely on hardcoded "demo" user IDs or fetch the first available record.

## 2. System Architecture

The project follows a standard client-server architecture using the PERN stack (with React instead of Next.js for the final merged frontend).

### 2.1 Backend (Node.js + Express)
**Directory:** `d:\Projects\hackathon_J\backend\`

The backend is built with Express and connects to a PostgreSQL database using `pg`. It manages business logic, AI integrations (Gemini for descriptions, Stability AI for posters), Cloudinary uploads, and Nodemailer emails.

**Key Routes (`backend/src/routes/`):**

*   **Original Core:**
    *   `events.js`: CRUD for beach cleanup events. Auth is removed; `organizer_id` can be null.
    *   `dashboard.js`: Aggregates data for the Volunteer dashboard (impact scores, total hours, upcoming events).
    *   `admin.js`: Handles AI poster generation (Stability AI + sharp overlay) and manual email announcements.
    *   `certificates.js`: Retrieves generated certificates.
*   **Teammate Integration (New):**
    *   `registrations.js`: Handles volunteer self-registration for an event. Generates a unique 20-character alphanumeric `qr_token` and returns a QR code image data URL.
    *   `scan.js`: The core logic for the QR scanner state machine.
        *   Accepts a `qr_token` and `scan_type` (`checkin` or `checkout`).
        *   Manages `event_registrations` status transitions: `PENDING` → `ACTIVE` (checkin) → `DONE` (checkout).
        *   **Crucial Trigger:** Upon successful `checkout`, it fires an asynchronous call to `certificateService.generateAndEmailCertificate()`.

**Key Services (`backend/src/services/`):**
*   `certificateService.js`: Uses `pdfkit` to draw a certificate, uploads the PDF buffer to Cloudinary, saves the record to the `certificates` table, and triggers the email via `emailService.js`.
*   `emailService.js`: Wraps Nodemailer to send HTML emails (event invitations, certificate delivery, etc.).

### 2.2 Frontend (React / Create React App)
**Directory:** `d:\Projects\hackathon_J\frontend\`

The frontend is a single-page React application. The teammate's original Next.js frontend components were ported to work within this React app.

**Key Pages (`frontend/src/pages/`):**

*   `App.js` & `HomeScreen`: The entry point. Presents a 3-card layout allowing the user to jump straight into `/volunteer`, `/organizer`, or `/scanner`.
*   `VolunteerDashboard.js`: Shows the volunteer's impact, badges, and downloaded certificates.
*   `OrganizerDashboard.js`: Allows NGOs to create events (simplified: removed lat/lng), generate AI promotional posters, and trigger email announcements via a dedicated section.
*   `ScannerPage.js`: **(New Ported Component)** A dedicated UI for the QR check-in/check-out station. It uses `html5-qrcode` (lazy-loaded to avoid SSR/bundling issues) to access the device camera. It POSTs to `/api/scan` and displays success/error banners.

### 2.3 Database (PostgreSQL)
**Configuration:** `backend/.env` (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)

The schema was unified by modifying the teammate's SQL to match the original project's conventions (specifically, using `SERIAL` integer IDs for foreign keys instead of `UUID`s).

**Key Tables:**
*   `users`: Stores Volunteers, NGOs, and Admins.
*   `events`: Stores cleanup events. Recent additions include `beach_name`, `start_time`, `end_time`, and `max_volunteers`.
*   **Teammate Integration Tables:**
    *   `event_registrations`: Maps a `user_id` to an `event_id`. Contains the `qr_token` and tracks the attendance state (`status`, `entry_time`, `exit_time`, `duration_mins`).
    *   `scan_logs`: An audit trail recording every individual scan action.
*   `certificates`: Stores the generated Cloudinary URL, badge tier, and the `verification_hash` (auto-generated UUID `uuid_generate_v4()`).

## 3. Current Implementation Focus: The QR & Certificate Pipeline

We have just completed the integration of the attendee QR scanner and tied it directly into the gamified certificate system.

**The End-to-End Workflow:**

1.  **Event Creation (Organizer):** NGO creates an event via `/organizer`.
2.  **Registration (Simulated):** A volunteer registers for the event (via `/api/registrations`). The backend generates a unique `qr_token` and saves it in `event_registrations`.
3.  **Check-In (Scanner Station):**
    *   The volunteer presents their QR code at the event.
    *   The Organizer uses the `/scanner` page, set to **CHECK IN**.
    *   The `ScannerPage.js` reads the code and POSTs to `/api/scan` (`scan_type: checkin`).
    *   Backend updates the `event_registrations` status from `PENDING` to `ACTIVE` and records `entry_time`.
4.  **Check-Out & Reward (Scanner Station):**
    *   When the event finishes, the volunteer scans out.
    *   Organizer uses `/scanner`, set to **CHECK OUT**.
    *   POST to `/api/scan` (`scan_type: checkout`).
    *   Backend sets status to `DONE`, records `exit_time`, and calculates `duration_mins`.
    *   **The Bridge:** The backend asynchronously calls `generateAndEmailCertificate()`. It generates a PDF, uploads to Cloudinary, saves the URL/badges to the DB, and emails the volunteer.

## 4. Notes for Future Modifying Agents

*   **Demo Mode Constraints:** Do not attempt to re-introduce JWT authentication middleware (`verifyToken`, `roleMiddleware`) on the core routes unless explicitly requested by the user to build out the production version. The current priority is a seamless hackathon demo.
*   **Database Adapters:** The teammate's original code imported `const { query } = require('../config/db')`. To prevent refactoring all their queries, an adapter was created at `backend/src/config/db-query.js` which wraps the original project's database pool (`backend/src/config/database.js`).
*   **UUID vs SERIAL:** Ensure any new database migrations dealing with foreign keys reference the `users.id` and `events.id` as `INTEGER` (`SERIAL`), not `UUID`.
*   **Environment Variables:** Verify Cloudinary, Nodemailer, Stability AI, and Gemini API keys are properly set in `backend/.env` if testing the full pipeline. Ensure `PGPASSWORD` is set in the terminal session if running `psql` migrations on Windows.
