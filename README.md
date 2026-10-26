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
| GET | `/coworkingspaces` | Public (supports select, sort, page, limit, filters; `?date=YYYY-MM-DD` adds `reservedRooms` / `availableRooms` for that day) |
| GET | `/coworkingspaces/nearby?lat&lng&radius&date` | Public — spaces within `radius` km (default 5) of `lat`/`lng`, nearest first, each with `distanceKm`; optional `date` adds availability |
| GET | `/coworkingspaces/:id` | Public (optional `?date=YYYY-MM-DD` adds `reservedRooms` / `availableRooms`) |
| POST / PUT / DELETE | `/coworkingspaces[/:id]` | Admin — body includes `latitude` (-90..90), `longitude` (-180..180), `totalRooms` (whole number ≥ 1) |
| GET | `/reservations` | User: own only · Admin: all |
| GET | `/coworkingspaces/:coworkingSpaceId/reservations` | User: own only · Admin: all |
| POST | `/coworkingspaces/:coworkingSpaceId/reservations` | Logged in — max 3 per user (admin unlimited); rejected with 400 when the date is not in the future, the time is outside the space's opening hours (Thai time), or no room is free that day (admins too) |
| GET / PUT / DELETE | `/reservations/:id` | Owner or admin — moving to another date/space is rejected with 400 when the new date is in the past, outside opening hours, or the target day is full |
| GET | `/stats/reservations?from&to&groupBy&top` | Admin — most-booked spaces, peak hour/day, utilisation per space, reservations per day/month |

Dates are days in Thai time (Asia/Bangkok, +07:00). Available rooms are computed live from the reservations,
so they change as soon as a reservation is created, edited or deleted.

## Postman / Newman tests

The demo collection is in `postman/` (`coworking-space-api.postman_collection.json` + `local.postman_environment.json`).
Folders follow the presentation order (register → login → spaces → reservations → confidentiality → admin →
booking rules → extras → cleanup); every response is also checked to arrive within 3000 ms.

```bash
npm run seed       # once: creates admin@seed.test / 123456
npm run dev        # in another terminal
npm run test:api   # runs the collection with Newman
```

The collection runs green again without reseeding: it registers new users, creates uniquely named spaces,
computes reservation dates relative to now, and deletes its spaces at the end. In the Postman app, import both
files, select the "Co-working Space API – local" environment and run the collection with the Runner.

A run sends about 60 requests, and the API allows 100 requests per IP per 10 minutes. For the demo we set
`RATE_LIMIT_MAX=500` in `config/config.env` so the collection can be run several times in a row (default stays 100).
