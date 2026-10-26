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
| POST | `/auth/forgotpassword` | Public — email; sends a reset link valid 15 min |
| PUT | `/auth/resetpassword/:resettoken` | Public — password; token works once |
| GET | `/coworkingspaces` | Public (supports select, sort, page, limit, filters) |
| GET | `/coworkingspaces/:id` | Public |
| POST / PUT / DELETE | `/coworkingspaces[/:id]` | Admin |
| GET | `/coworkingspaces` | Public (supports select, sort, page, limit, filters; `?date=YYYY-MM-DD` adds `reservedRooms` / `availableRooms` for that day) |
| GET | `/coworkingspaces/nearby?lat&lng&radius&date` | Public — spaces within `radius` km (default 5) of `lat`/`lng`, nearest first, each with `distanceKm`; optional `date` adds availability |
| GET | `/coworkingspaces/:id` | Public (optional `?date=YYYY-MM-DD` adds `reservedRooms` / `availableRooms`) |
| POST / PUT / DELETE | `/coworkingspaces[/:id]` | Admin — body includes `latitude` (-90..90), `longitude` (-180..180), `totalRooms` (whole number ≥ 1) |
| GET | `/reservations` | User: own only · Admin: all |
| GET | `/coworkingspaces/:coworkingSpaceId/reservations` | User: own only · Admin: all |
| POST | `/coworkingspaces/:coworkingSpaceId/reservations` | Logged in — max 3 per user (admin unlimited); rejected with 400 when no room is free that day (admins too) |
| GET / PUT / DELETE | `/reservations/:id` | Owner or admin — moving to another date/space is rejected with 400 when the target day is full |
| GET | `/stats/reservations?from&to&groupBy&top` | Admin — most-booked spaces, peak hour/day, utilisation per space, reservations per day/month |

Dates are days in Thai time (Asia/Bangkok, +07:00). Available rooms are computed live from the reservations,
so they change as soon as a reservation is created, edited or deleted.
