# Co-working Space Reservation API

2110503 Software Development Practice — Term Project #6 (group jubjub)

REST API built with Node.js, Express and MongoDB Atlas, based on the VacQ codebase.

## Setup

```bash
npm install
cp config/config.env.example config/config.env   # then fill in real values
npm run dev
```

API base URL: `http://localhost:5000/api/v1`
Swagger docs: `http://localhost:5000/api-docs`

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | Public — name, tel, email, password |
| POST | `/auth/login` | Public — email, password |
| GET | `/auth/me` | Logged in |
| GET | `/auth/logout` | Logged in |
| GET | `/coworkingspaces` | Public (supports select, sort, page, limit, filters) |
| GET | `/coworkingspaces/:id` | Public |
| POST / PUT / DELETE | `/coworkingspaces[/:id]` | Admin |
| GET | `/reservations` | User: own only · Admin: all |
| GET | `/coworkingspaces/:coworkingSpaceId/reservations` | User: own only · Admin: all |
| POST | `/coworkingspaces/:coworkingSpaceId/reservations` | Logged in — max 3 per user (admin unlimited) |
| GET / PUT / DELETE | `/reservations/:id` | Owner or admin |
