<h1 align="center">
  <br>
  ⚡ EcoCharge — EV Trip Planning Platform
  <br>
</h1>

<p align="center">
  <strong>Find charging stations · Book slots · Plan routes · Chat with AI — all in real time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Django-4.2-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL+PostGIS-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions">
</p>

<<<<<<< HEAD
<p align="center">
  <a href="https://ecocharge.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Live_Demo-Visit-orange?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo">
  </a>
</p>

<br>
=======
>>>>>>> 803c97eb6a1b54bde2185bf2b769ed9b90748c9b


## 📑 Table of Contents

- [Highlights](#-highlights)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)
- [CI/CD](#-cicd)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Author](#-author)

<br>

## ✨ Highlights

- **3-service architecture** — React frontend, Django REST API, FastAPI AI microservice, all orchestrated with Docker Compose
- **Concurrent-safe bookings** — Database-level row locking (`select_for_update`) prevents double-booking under race conditions
- **AI-powered EcoBot** — LLM chatbot (Groq Llama 3.3 70B) with tool calling, RAG pipeline, safety guards, and streaming responses
- **GeoDjango + PostGIS** — Spatial queries for radius search, route-corridor search, and proximity-based station discovery
- **Zero-cost deployment** — Entire stack runs on AWS free tier ($0/month) with automated CI/CD via GitHub Actions

<br>

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🔍 **Interactive Map** | Leaflet map with dual-source stations (EcoCharge + Open Charge Map), GPS location, radius search, marker clustering |
| 📅 **Slot Booking** | Concurrent-safe reservations with `select_for_update()`, real-time slot status via WebSockets |
| 🗺️ **Trip Planner** | EV-aware route planning with battery consumption estimates, charging stop suggestions, and OSRM integration |
| 🤖 **AI Assistant (EcoBot)** | Natural-language chatbot for station search, trip planning, weather queries — with streaming SSE responses |
| 💳 **Payments** | Razorpay integration for INR payments with order creation and signature verification |
| 🌦️ **Weather Integration** | Current weather, forecasts, and 7-day outlook via Open-Meteo API |
| 📊 **Role-based Dashboard** | Driver, Station Owner, and Super Admin views with analytics (Recharts) |
| 🔔 **Real-time Updates** | Django Channels + WebSockets push live slot status and user events |
| 🧠 **RAG Knowledge Base** | pgvector + sentence-transformers for semantic search across EV knowledge documents |
| 🔐 **JWT Authentication** | SimpleJWT with Google OAuth, role-based permissions, and automatic token refresh |
| 🛡️ **AI Safety Guards** | Prompt injection protection (InputGuard) and PII redaction (OutputGuard) for the chatbot |
| 📱 **Responsive Design** | Tailwind CSS 4 utility-first styling across all pages |

<br>

## 🧰 Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 19.2 | UI framework |
| | Vite | 6.4 | Build tool & dev server |
| | Tailwind CSS | 4.3 | Utility-first CSS |
| | React Router | 7.17 | Client-side routing |
| | Leaflet + React-Leaflet | 1.9 / 5.0 | Interactive maps |
| | Recharts | 3.8 | Dashboard charts |
| | Axios | 1.17 | HTTP client |
| **Backend** | Django | 4.2 (LTS) | Web framework |
| | Django REST Framework | 3.15 | REST API toolkit |
| | GeoDjango + PostGIS | — | Spatial queries |
| | Django Channels | 4.0 | WebSocket support |
| | Celery | 5.3 | Async task queue |
| | drf-spectacular | 0.27 | OpenAPI/Swagger docs |
| **AI Service** | FastAPI | 0.115 | Async API framework |
| | Groq SDK | 0.12+ | LLM API client |
| | sentence-transformers | 3.3+ | Embedding model |
| **Database** | PostgreSQL | 16 | Primary database |
| | PostGIS | 3.4 | Geospatial extension |
| | pgvector | 0.3+ | Vector similarity search |
| | Redis | 7 | Cache, Celery broker, channel layer |
| **Payments** | Razorpay | 1.4 | Payment gateway (INR) |
| **Auth** | SimpleJWT + Google OAuth | — | Authentication |
| **Containers** | Docker Compose | 2.x | Multi-service orchestration |
| **CI/CD** | GitHub Actions | — | Automated testing & deployment |
| **Cloud** | AWS (EC2, RDS, S3, CloudFront) | — | Production hosting |
| | Vercel | — | Frontend hosting |
| **Linting** | Ruff (Python) / ESLint (JS) | — | Code quality |

<br>

## 🏗️ Architecture

```
                        ┌─────────────┐
                        │   Vercel    │  ← React SPA (production)
                        │  (Frontend) │
                        └──────┬──────┘
                               │
                    ┌──────────▼──────────┐
                    │                     │
                    │    Nginx :80/443    │  ← Reverse proxy + SSL
                    │                     │
                    └──┬──────────────┬───┘
                       │              │
            ┌──────────▼──┐    ┌──────▼──────────┐
            │   Django    │    │    FastAPI      │
            │   :8000     │    │    :8001        │
            │             │    │                 │
            │ REST API    │    │ AI Chatbot      │
            │ WebSocket   │    │ RAG Pipeline    │
            │ Admin       │    │ Tool Calling    │
            │ Celery      │    │ Safety Guards   │
            └──┬──────┬───┘    └────────┬────────┘
               │      │                 │
        ┌──────▼──┐ ┌─▼─────────┐ ┌────▼─────┐
        │PostgreSQL│ │   Redis   │ │  Groq    │
        │+PostGIS  │ │  :6379    │ │ Llama 3.3│
        │+pgvector │ │           │ │  70B     │
        └─────────┘ └───────────┘ └──────────┘
```

<br>

## 🏁 Getting Started

### Prerequisites

- **Docker & Docker Compose** (v2+) — [Install Docker](https://docs.docker.com/get-docker/)
- **Git** — [Install Git](https://git-scm.com/)

> No Python, Node.js, or PostgreSQL installation required — everything runs inside Docker containers.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ecocharge.git
   cd ecocharge
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env   # If .env.example exists
   # Otherwise, create .env manually (see Environment Variables section)
   ```

3. **Start all services**
   ```bash
   docker compose up --build
   ```

4. **Run database migrations**
   ```bash
   docker compose exec django python manage.py migrate
   ```

5. **Create a superuser** (optional)
   ```bash
   docker compose exec django python manage.py createsuperuser
   ```

### Access the Application

| Service | URL |
|---------|-----|
| 🌐 Frontend | [http://localhost:3000](http://localhost:3000) |
| 🔌 Django API | [http://localhost:8000/api/](http://localhost:8000/api/) |
| 📖 Swagger Docs | [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/) |
| 📚 ReDoc | [http://localhost:8000/api/redoc/](http://localhost:8000/api/redoc/) |
| 🤖 FastAPI AI | [http://localhost:8001](http://localhost:8001) |
| 🛠️ Django Admin | [http://localhost:8000/admin/](http://localhost:8000/admin/) |

<br>

## 💻 Usage

### Development Commands

```bash
# Start all services (build on first run)
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f django
docker compose logs -f fastapi
docker compose logs -f celery_worker

# Stop all services
docker compose down

# Rebuild a single service
docker compose build django --no-cache
docker compose up -d django
```

### Django Management Commands

```bash
# Sync stations from Open Charge Map
docker compose exec django python manage.py sync_ocm_stations

# Import Kaggle dataset
docker compose exec django python manage.py sync_kaggle_stations

# Generate highway stations
docker compose exec django python manage.py generate_highway_stations

# Ingest knowledge documents for RAG
docker compose exec django python manage.py ingest_knowledge

# Update slot pricing
docker compose exec django python manage.py update_slot_rates

# Collect static files
docker compose exec django python manage.py collectstatic --noinput
```

### Frontend (without Docker)

```bash
cd frontend
npm install
npm run dev       # Dev server at :5173
npm run build     # Production build
npm run lint      # ESLint check
```

### Linting

```bash
# Python (Ruff)
ruff check django-backend/ fastapi-ai/

# Frontend (ESLint)
cd frontend && npm run lint
```

<br>

<details>
<summary><strong>📁 Project Structure</strong> (click to expand)</summary>

```
ecocharge/
├── frontend/                       # React SPA (Vite + Tailwind)
│   ├── src/
│   │   ├── api/                    # 14 API client modules
│   │   │   ├── ai.js               # AI chat (SSE streaming)
│   │   │   ├── auth.js             # Login, register, OAuth
│   │   │   ├── bookings.js         # Slot reservations
│   │   │   ├── stations.js         # Station search & CRUD
│   │   │   ├── trips.js            # Trip planning
│   │   │   ├── payments.js         # Razorpay payments
│   │   │   ├── vehicles.js         # Vehicle profiles
│   │   │   ├── weather.js          # Weather data
│   │   │   └── ...
│   │   ├── components/             # Reusable UI components
│   │   │   ├── ai/                 # Chat widget, message bubbles
│   │   │   ├── dashboard/          # Dashboard cards, charts
│   │   │   ├── map/                # Map container, markers, popups
│   │   │   ├── trip/               # Trip planner UI
│   │   │   ├── vehicle/            # Vehicle forms, selectors
│   │   │   └── weather/            # Weather widgets
│   │   ├── context/                # 7 React Context providers
│   │   │   ├── AuthContext.jsx     # JWT auth state
│   │   │   ├── AIChatContext.jsx   # AI chat state + SSE
│   │   │   ├── StationSocketCtx.jsx # WebSocket connection
│   │   │   ├── EventSocketCtx.jsx  # User event WebSocket
│   │   │   ├── VehicleContext.jsx   # Vehicle management
│   │   │   ├── NotificationCtx.jsx # Real-time notifications
│   │   │   └── ToastContext.jsx    # Toast notifications
│   │   ├── pages/                  # 16 page components
│   │   │   ├── HomePage.jsx
│   │   │   ├── MapPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── BookingsPage.jsx
│   │   │   ├── TripsPage.jsx
│   │   │   ├── AdminPage.jsx
│   │   │   └── ...
│   │   ├── data/                   # Static data (vehicle specs)
│   │   ├── utils/                  # Helper functions
│   │   ├── App.jsx                 # Routes + Provider tree
│   │   ├── main.jsx                # Entry point
│   │   └── config.js               # API URL config
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile                  # Multi-stage: node build → nginx
│   └── nginx.conf
│
├── django-backend/                 # Django REST API + WebSockets
│   ├── core/                       # Project config
│   │   ├── settings.py             # Django settings
│   │   ├── urls.py                 # URL routing
│   │   ├── asgi.py                 # ASGI entry (Channels)
│   │   ├── celery.py               # Celery config
│   │   └── wsgi.py                 # WSGI entry
│   ├── users/                      # Auth & user management
│   │   ├── models.py               # CustomUser (role-based)
│   │   ├── serializers.py          # Registration, login, profile
│   │   ├── views.py                # Auth views, Google OAuth
│   │   └── tests/                  # User tests
│   ├── stations/                   # Charging stations
│   │   ├── models.py               # ChargingStation, ChargingSlot
│   │   ├── views.py                # Station CRUD, search
│   │   ├── serializers.py
│   │   ├── consumers.py            # WebSocket consumers
│   │   └── tests/
│   ├── bookings/                   # Slot reservations
│   │   ├── models.py               # Booking model
│   │   ├── views.py                # Concurrent-safe booking
│   │   ├── tasks.py                # Celery: auto-cancel, expiry
│   │   └── tests/
│   ├── trips/                      # Trip planning
│   │   ├── models.py               # Trip, TripStop
│   │   ├── views.py                # Trip CRUD
│   │   ├── services/
│   │   │   └── route_planner.py    # OSRM route planning
│   │   └── tests/
│   ├── vehicles/                   # EV profiles
│   │   ├── models.py               # VehicleProfile (specs, curves)
│   │   └── tests/
│   ├── payments/                   # Razorpay integration
│   │   ├── models.py               # Payment model
│   │   ├── views.py                # Order creation, verification
│   │   └── tests/
│   ├── weather/                    # Weather service
│   │   ├── services.py             # Open-Meteo API client
│   │   └── tests/
│   ├── events/                     # WebSocket events
│   │   ├── consumers.py            # Event consumers
│   │   └── tests/
│   ├── notifications/              # Notification system
│   │   ├── models.py
│   │   └── tests/
│   ├── knowledge/                  # RAG knowledge base
│   │   ├── models.py               # KnowledgeDocument + embeddings
│   │   ├── management/commands/
│   │   │   └── ingest_knowledge.py # Document ingestion
│   │   └── tests/
│   ├── contact/                    # Contact form
│   ├── Dockerfile                  # Python 3.11 + GDAL
│   ├── requirements.txt
│   └── conftest.py                 # Shared pytest fixtures
│
├── fastapi-ai/                     # AI microservice (EcoBot)
│   ├── app.py                      # FastAPI entry point
│   ├── config.py                   # Settings (Groq, Redis, RAG)
│   ├── schemas.py                  # Pydantic models
│   ├── agent/                      # Agent loop (tool routing)
│   ├── orchestrator/               # Router → Planner → Executor
│   ├── tools/                      # Tool implementations
│   │   ├── trip_planner.py         # Geocoding + OSRM
│   │   ├── station_tool.py         # Station search
│   │   ├── weather_tool.py         # Weather queries
│   │   └── booking_tool.py         # Booking lookup
│   ├── skills/                     # Skill system
│   │   ├── route_planner.py        # EV route planning
│   │   ├── trip_explainer.py       # Route explanations
│   │   ├── weather_adaptation.py   # Weather-aware advice
│   │   └── general_ev_knowledge.py # RAG + web search
│   ├── rag/                        # RAG pipeline
│   │   ├── embeddings.py           # sentence-transformers
│   │   └── retriever.py            # Hybrid retrieval
│   ├── memory/                     # Redis-backed user memory
│   ├── safety/                     # AI safety
│   │   ├── input_guard.py          # Prompt injection protection
│   │   └── output_guard.py         # PII redaction
│   ├── prompts/                    # System prompts
│   ├── routes/                     # API routes
│   ├── context/                    # Context assembly
│   ├── observability/              # Structured logging
│   ├── tests/
│   │   └── test_agent_eval.py      # Router + planner eval
│   ├── Dockerfile                  # Python 3.11 + PyTorch CPU
│   ├── requirements.txt
│   └── pyproject.toml              # Ruff config
│
├── nginx/                          # Reverse proxy
│   ├── nginx.conf
│   └── Dockerfile
│
├── postgres/                       # Custom PostGIS image
│   └── Dockerfile                  # postgis/postgis:16-3.4 + pgvector
│
├── scripts/
│   └── ec2-setup.sh                # EC2 provisioning script
│
├── .github/workflows/
│   ├── ci.yml                      # CI pipeline (6 jobs)
│   └── cd.yml                      # CD pipeline (build → deploy)
│
├── docker-compose.yml              # Dev: 6 services
├── docker-compose.prod.yml         # Prod: 7 services + SSL
├── .env                            # Environment variables
├── .gitignore
└── readme.md
```

</details>

<br>

<details>
<summary><strong>🔐 Environment Variables</strong> (click to expand)</summary>

Create a `.env` file in the project root with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/ecocharge` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `DJANGO_SECRET_KEY` | Django secret key | `your-secret-key` |
| `DEBUG` | Enable debug mode | `True` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | CORS whitelist | `http://localhost:5173` |
| `RAZORPAY_KEY_ID` | Razorpay API key | `rzp_test_xxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret | `your-razorpay-secret` |
| `GROQ_API_KEY` | Groq LLM API key | `gsk_xxxxx` |
| `GROQ_MODEL` | LLM model identifier | `llama-3.3-70b-versatile` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `your-google-secret` |
| `EMAIL_HOST` | SMTP server | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_HOST_USER` | SMTP username | `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | SMTP app password | `your-app-password` |
| `DEFAULT_FROM_EMAIL` | Sender email address | `EcoCharge <noreply@ecocharge.com>` |

**Frontend variables** (prefix with `VITE_`):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Django API base URL |
| `VITE_WS_STATIONS_URL` | Station WebSocket URL |
| `VITE_WS_EVENTS_URL` | Events WebSocket URL |
| `VITE_OCM_API_KEY` | Open Charge Map API key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

</details>

<br>

## 🧪 Testing

### Run All Tests

```bash
# Django tests (with PostGIS service)
docker compose exec django pytest -v

# FastAPI tests
docker compose exec fastapi pytest tests/ -v

# Frontend lint
cd frontend && npm run lint
```

### Test Structure

| Component | Framework | Coverage |
|-----------|-----------|----------|
| Django models | pytest-django | Models, serializers, views per app |
| Django views | pytest-django | API endpoint tests with auth fixtures |
| FastAPI agent | pytest | Router intent classification (25 prompts) |
| Frontend | ESLint | React hooks + refresh linting |

**Shared fixtures** (`django-backend/conftest.py`):
- `api_client` — Unauthenticated DRF client
- `auth_client` — Authenticated DRIVER client
- `owner_client` — Authenticated STATION_OWNER client
- `admin_client` — Authenticated SUPER_ADMIN client
- `test_station`, `test_slot`, `test_vehicle` — Reusable test data

<br>

## ⚙️ CI/CD

### CI Pipeline (on push/PR to `main`)

| Job | What It Does |
|-----|--------------|
| `lint-frontend` | ESLint check on React code |
| `build-frontend` | Vite production build |
| `lint-python` | Ruff check on Django + FastAPI |
| `test-fastapi` | Pytest on AI service |
| `test-django` | Pytest on Django with PostGIS container |
| `docker-build` | Verify Docker images build successfully |

### CD Pipeline (on push to `main`)

1. Build Docker images with `docker-compose.prod.yml`
2. Push images to GitHub Container Registry (`ghcr.io`)
3. SSH into EC2 and pull latest images
4. Run migrations + collectstatic
5. Restart services with `docker compose up -d`

See [CD.md](./CD.md) for detailed deployment documentation.

<br>

## 🌐 Deployment

The production environment runs entirely on **AWS free tier** ($0/month):

| Service | AWS Resource | Purpose |
|---------|-------------|---------|
| Compute | EC2 t3.micro | App server |
| Database | RDS PostgreSQL 16 | Managed database with PostGIS |
| Storage | S3 | Media file storage |
| CDN | CloudFront | Static asset delivery |
| Queue | SQS | Async message processing |
| Secrets | SSM Parameter Store | Secure env var storage |
| Domain | DuckDNS | Free dynamic DNS |
| SSL | Let's Encrypt | Free SSL certificates |
| Frontend | Vercel | React SPA hosting |
| CI/CD | GitHub Actions | Automated pipelines |

For detailed setup instructions, see [AWS-DEPLOY.md](./AWS-DEPLOY.md).

<br>

<br>

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Style

- **Python**: [Ruff](https://docs.astral.sh/ruff/) (line length 120, single quotes, Python 3.11)
- **JavaScript**: [ESLint](https://eslint.org/) with React hooks plugin
- Run linters before committing:
  ```bash
  ruff check django-backend/ fastapi-ai/
  cd frontend && npm run lint
  ```

<br>

## 👤 Author

**Abhinav** — [GitHub](https://github.com/ABHINAV9496)

---

<p align="center">
  Made with ⚡ for a sustainable future
</p>
