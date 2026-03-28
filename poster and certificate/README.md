# ShoreClean - Certification & Gamified Impact Platform

A focused platform that delivers **instant digital certificates** and **gamified achievements** for beach cleanup volunteers, with impact tracking and competitive leaderboards.

## 🌊 Project Focus

ShoreClean transforms beach cleanup into a gamified experience through:

- **⚡ Instant Certificates**: Digital certificates issued immediately upon check-out (no admin delays)
- **🏆 Badge Tiers**: Bronze, Silver, Gold achievements based on hours & waste collected
- **📍 Geofencing**: GPS-verified check-in/check-out to ensure authentic participation
- **📊 Impact Dashboard**: Personal achievement hub showing badges, certificates, and stats
- **🎯 Leaderboard**: Real-time volunteer rankings by impact score
- **✅ Auto-Verification**: Unique QR codes for third-party certificate verification

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** for data persistence
- **PDFKit** for certificate generation
- **Google Gemini API** for AI waste classification
- **Cloudinary** for image storage
- **JWT** for authentication

### Frontend
- **React** 18
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Chart.js** for analytics visualization
- **html5-qrcode** for QR scanning

## 📋 Project Structure (Simplified)

```
shoreclean/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app
│   │   ├── routes/
│   │   │   ├── auth.js           # Login/Register
│   │   │   ├── qr.js             # Check-in/Check-out → Certificate
│   │   │   ├── certificates.js   # Certificate generation & verification
│   │   │   └── dashboard.js      # Impact stats & leaderboard
│   │   ├── services/
│   │   │   ├── certificateService.js  # PDF generation + QR
│   │   │   └── aiService.js            # Waste classification
│   │   ├── middleware/auth.js
│   │   ├── utils/geofencing.js
│   │   └── config/database.js
│   ├── db/migrations/init.sql
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── VolunteerDashboard.js   # Impact hub
│   │   │   └── CertificateGallery.js   # Certificate collection
│   │   ├── components/
│   │   │   ├── Navbar.js
│   │   │   ├── QRScanner.js
│   │   │   ├── CertificateCard.js
│   │   │   └── LeaderboardCard.js
│   │   ├── services/api.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 14+
- PostgreSQL 12+
- Cloudinary account (for certificate storage)
- Google Gemini API key (for waste classification)

### Setup

```bash
# Install dependencies
npm install  # (uses workspace configuration)

# Configure environment
cp .env.example .env

# Setup database
cd backend && npm run db:migrate

# Start both servers
npm run dev   # Backend on :5000
npm start     # Frontend on :3000 (in another terminal)
```

## 🔑 Key Features

### 1. QR-Based Check-in/Check-out
- Location verification using GPS geofencing (500m radius)
- Minimum 2-hour duration requirement to prevent abuse
- Automatic fraud flag if check-out location is outside geofence

### 2. Waste Photo Validation
- EXIF data extraction for GPS verification
- Google Gemini AI classification of waste type
- Manual verification by admin if confidence < threshold

### 3. Certificate Generation
- Dynamic PDF generation with volunteer details
- Unique verification QR code
- Tier-based visual design (Bronze/Silver/Gold)
- Cloudinary storage for secure access

### 4. Gamification System

**Badge Tiers:**
- **Bronze (Commended)**: 2+ hours
- **Silver (Impact Leader)**: 4+ hours or 10+ cumulative hours
- **Gold (Coastal Guardian)**: 20+ hours or 50+ kg waste collected

**Impact Score Formula:**
```
Score = (Hours × 10) + (Kg Plastic × 5) + (Consistency Bonus)
```

### 5. Admin Dashboard
- Real-time fraud flag monitoring
- Event statistics and impact metrics
- Volunteer activity verification
- Certificate issuance tracking

## 🔐 Security Features

- JWT-based authentication (7-day expiration)
- Password hashing with bcryptjs
- Geofencing validation
- EXIF metadata verification
- Unique certificate hash for verification
- Fraud flag system for suspicious activity

## 📊 Core Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles |
| `events` | Beach cleanup events |
| `event_attendance` | Check-in/check-out records |
| `waste_logs` | Collected waste with AI classification |
| `certificates` | Generated certificates + verification hash |
| `volunteer_badges` | Badge counts & impact stats |
| `leaderboard` | Real-time rankings cache |

## 🌐 Essential API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Register volunteer |
| POST | `/api/auth/login` | Login |
| POST | `/api/qr/checkin` | Start event (records time & location) |
| POST | `/api/qr/checkout` | End event → **Triggers certificate generation** |
| POST | `/api/waste/upload` | Upload proof photos (AI classifies) |
| GET | `/api/certificates/my-certificates` | Volunteer's certificate collection |
| POST | `/api/certificates/generate` | Manually generate certificate |
| GET | `/api/certificates/verify/:hash` | **Public verification** (no auth needed) |
| GET | `/api/dashboard/volunteer` | Impact stats + badges + rank |
| GET | `/api/dashboard/leaderboard` | Global rankings |

## 📝 Environment Variables

See `.env.example` for complete list. Key variables:
- `DB_*` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `CLOUDINARY_*` - Image storage
- `GEMINI_API_KEY` - AI waste classification
- `PORT` - Server port (default: 5000)

## 🎮 Clauses (Business Rules)

The system implements four clauses to prevent gaming:

1. **Temporal Clause**: QR exit cannot be scanned < 2 hours after check-in
2. **Geofence Clause**: GPS coordinates must be within 500m of event location
3. **Content Clause**: At least one verified waste photo required for certificate
4. **Integrity Clause**: Each certificate has unique hash for third-party verification

## 🚧 Future Enhancements

- Real-time notifications for volunteers
- Integration with college/corporate partner systems
- Advanced analytics and reporting
- Mobile app (React Native)
- Community challenges and team competitions
- Reward redemption system
- Social media integration
- Multi-language support

## 📄 License

MIMobile app (React Native)
- Email certificate delivery
- Social media certificate sharing
- Reward redemption system
- Team competitions & challenges
- Corporate/college integration
- Advanced analytics dashboard
- Real-time notificationsps recommended
- Monitor Gemin API usage for costs

