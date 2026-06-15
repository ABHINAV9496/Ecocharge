# EcoCharge

A full-stack EV trip planning platform for finding charging stations, booking slots, planning routes with battery predictions, and getting AI-powered assistance — all in real time.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, React Router 7, Leaflet, Recharts |
| **Backend** | Django 4.2, DRF, Django Channels, GeoDjango / PostGIS |
| **AI Service** | FastAPI (Python) — LangChain chatbot & battery prediction |
| **Database** | PostgreSQL + PostGIS |
| **Message Broker** | Redis, Mosquitto MQTT |
| **Containers** | Docker Compose (11 services) |

## Quick Start

1. **Clone and configure**
   ```bash
   cp .env.example .env   # or edit .env with your values
   ```

2. **Start all services**
   ```bash
   docker compose up --build
   ```

3. **Access the app**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Django API: [http://localhost:8000/api/](http://localhost:8000/api/)
   - Swagger docs: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
   - FastAPI: [http://localhost:8001](http://localhost:8001)

## Project Structure

```
ecocharge/
├── frontend/           # React SPA
├── django-backend/     # Django REST API + WebSockets
│   ├── core/           # Project config (settings, URLs, ASGI, Celery)
│   ├── users/          # Auth & user profiles (JWT)
│   ├── stations/       # Charging stations & slots (GeoDjango, MQTT)
│   ├── bookings/       # Slot reservations (concurrent-safe)
│   ├── wallet/         # Digital wallet & transactions
│   └── trips/          # Trip planning & history
├── fastapi-service/    # AI microservice (chatbot, predictions)
├── docker-compose.yml  # 11-container orchestration
└── .env                # Environment variables
```

## Key Features

- **Interactive Map** — Leaflet map with dual-source stations (bookable + Open Charge Map), GPS location, radius search, availability filtering
- **Real-time Updates** — MQTT IoT simulation + WebSocket push for live slot status
- **Smart Booking** — Concurrent-safe reservations with `select_for_update()`, automatic wallet deduction
- **Role-based Dashboard** — Driver, Station Owner, and Super Admin views with analytics
- **AI Assistant (EcoBot)** — Natural-language querying for stations, predictions, and trip planning
- **EV Trip Planner** — Route planning with battery consumption estimates

## API Documentation

Interactive API docs are available at `/api/docs/` (Swagger) and `/api/redoc/` (ReDoc) when the Django service is running sucessfully.
