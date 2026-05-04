# 🎼 VoctManager | Enterprise Choral OS & Digital Operations Platform

🌍 *Read this in other languages: [English](README.md), [Polski](README.pl.md).*

![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript 6](https://img.shields.io/badge/TypeScript_6-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Django 6](https://img.shields.io/badge/Django_6-092E20?style=for-the-badge&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis 5](https://img.shields.io/badge/Redis_5-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Celery 5](https://img.shields.io/badge/Celery_5-37814A?style=for-the-badge&logo=celery&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

**VoctManager** is a high-performance, dual-architecture enterprise resource planning (ERP) and digital operations platform. Engineered specifically as the official digital infrastructure for the professional vocal ensemble **VoctEnsemble**, it seamlessly bridges the gap between complex production logistics, secure asset management, and an immersive, cinematic digital experience.

The platform strictly adheres to **Feature-Sliced Design (FSD)** architecture, ensuring massive scalability, domain separation, and robust long-term maintainability.

🌐 **Live Public Experience:** [test.voctensemble.com](https://test.voctensemble.com)
🔐 **Enterprise Panel (Demo):** [test.voctensemble.com/panel](https://test.voctensemble.com/panel)

---

## 🏛️ System Architecture & Engineering Standards

The platform is built on a highly decoupled architecture designed for high availability, offline-resilient caching, and asynchronous background processing. 

```mermaid
graph TD
    Client([Web Browser / Mobile]) -->|HTTPS| Nginx[Nginx Reverse Proxy]
    
    subgraph Frontend: React 19 (Vite + FSD)
        Nginx -->|Serves Static UI| React[React SPA]
        React -->|TanStack Query v5 / Zustand| StateManager[State & Cache]
    end
    
    subgraph Backend: Django 6.0 (DRF)
        Nginx -->|REST API requests| Gunicorn[Gunicorn / Uvicorn]
        StateManager -->|JSON / JWT| Gunicorn
    end
    
    subgraph Data & Storage
        Gunicorn <-->|psycopg3| DB[(PostgreSQL)]
        Gunicorn -->|Task Queues| Redis[(Redis 5)]
    end
    
    subgraph Background Processing
        Redis <--> Celery[Celery 5.3 Workers]
        Celery <--> DB
        Celery -->|WeasyPrint PDF Gen| Ext[File System / S3]
    end
    
    classDef default fill:#1f2937,stroke:#4b5563,stroke-width:1px,color:#f3f4f6;
    classDef highlight fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#ffffff;
    classDef db fill:#059669,stroke:#1d4ed8,stroke-width:2px,color:#ffffff;
    
    class React,StateManager,Gunicorn highlight;
    class DB,Redis db;
```

---

## ✨ Core Enterprise Features

### 1. Cinematic "Ethereal" UX (Frontend)
- **Zero-Layout-Shift Architecture:** Mandatory use of suspense boundaries, `EtherealLoader`, and strict skeleton states ensuring absolute layout stability during asynchronous data fetching.
- **Hardware-Accelerated Kinematics:** Complex, non-bouncy 60FPS animations driven by **Framer Motion v12** and **Three.js**. Custom React hooks (e.g., `useMouseAndGyro`) map hardware telemetry to UI micro-interactions.
- **Bento Grid Layouts:** Dashboards orchestrated via a mathematical staggered bento grid architecture (`<StaggeredBentoContainer>`), providing a spatial, multi-layered 3D interface using custom glassmorphism variants.
- **EAA Accessibility:** Radix UI Primitives and semantic HTML guarantee compliance with the European Accessibility Act (EAA).

### 2. Enterprise OS & Logistics (Backend)
- **Granular RBAC:** Deep, Role-Based Access Control matrix (Admin, Manager, Artist, Crew) securing endpoints, data payloads, and UI visibility.
- **Web Push & Real-Time Alerts:** Native-like, real-time push notifications built on the W3C VAPID standard. Handled asynchronously via Celery alongside a robust transactional email engine, keeping artists instantly updated on casting and schedule changes.
- **Calendar Synchronization (iCal):** Seamless external calendar integration, providing auto-generated iCal feeds for Google Calendar and Apple Calendar synchronization.
- **Optimistic UI:** Aggressive server-state caching using **@tanstack/react-query v5.91+**, delivering a zero-latency feel for critical mutations (e.g., attendance confirmation, casting updates).
- **Asynchronous Document Engine:** Production workflows, such as dynamic Contract generation and Run Sheet compilation, are offloaded to **Celery workers** and **WeasyPrint**, guaranteeing the main thread remains unblocked.
- **Smart Archive & Asset Protection:** Secure, token-gated distribution of sensitive repertoire assets (Sheet Music PDFs, Reference Audio) tied strictly to active project casting.
- **Micro-Casting System:** Touch-ready Drag & Drop interfaces (`@dnd-kit/core`) for building complex concert programs and managing individual artist assignments.
- **Internationalization (i18n):** Full localization support (English, French, Polish) tailored for international touring and diverse artist rosters.

---

## 🛠️ Tech Stack (2026 Standards)

### Frontend Environment
* **Core:** React 19.2+, Vite 7.3+, TypeScript 6.0+
* **Architecture:** Feature-Sliced Design (FSD)
* **Styling:** Tailwind CSS v4.2+ (with Ethereal Design System tokens), `clsx`, `tailwind-merge`
* **State & Fetching:** Zustand 5+, `@tanstack/react-query` v5.91+
* **Motion & Interactions:** Framer Motion v12+, `@dnd-kit/core` v6+ (TouchSensor)
* **Forms:** React Hook Form v7+ combined with Zod v4.3+

### Backend Environment
* **Core:** Python 3.12+, Django 6.0+, Django REST Framework (DRF) 3.16+
* **Validation & Typing:** Strict Python Type Hints, Pydantic 
* **Database:** PostgreSQL (via `psycopg` v3 driver)
* **Authentication:** JWT via `djangorestframework-simplejwt`
* **Message Broker & Workers:** Redis 5+, Celery 5.3+
* **Document Generation:** WeasyPrint v68+

### Infrastructure & DevOps
* **Containerization:** Docker & Docker Compose (Zero-parity between Dev and Prod)
* **Web Server:** Nginx, Gunicorn 21+ (Uvicorn for async)
* **Static Asset Management:** WhiteNoise

---

## 🔒 Security & Data Compliance

Processing artist contracts, rehearsal schedules, and copyrighted musical material requires uncompromising security:
* **Stateless Authentication:** Secure, `httpOnly` cookie strategies with JWT rotation to mitigate XSS and CSRF vectors.
* **GDPR Compliance:** Built-in data minimization workflows and soft-deletion mechanisms to preserve production history while meeting strict privacy regulations.
* **Domain Integrity:** Strict relational database constraints coupled with Pydantic service-layer validation to guarantee data consistency.

---

## 📸 System Interface (Ethereal Design System)

| Main Dashboard (Staggered Bento OS) | Project & Logistics Editor |
|:---:|:---:|
| <img src="docs/assets/dashboard.png" width="400" alt="Main Dashboard showcasing Bento Grid"/> | <img src="docs/assets/editor.png" width="400" alt="Project Editor"/> |
| **Smart Archive (Asset Management)** | **High-Density Attendance Matrix** |
| <img src="docs/assets/archive.png" width="400" alt="Smart Archive view"/> | <img src="docs/assets/matrix.png" width="400" alt="Attendance Matrix"/> |

---

## 🚀 Quickstart (Local Infrastructure)

The project utilizes Docker Compose for a standardized development environment.

### Prerequisites
* Docker and Docker Compose (v2)
* GNU Make

### Initialization

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bedikryst/voctmanager.git
   cd voctmanager
   ```

2. **Environment Configuration:**
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

3. **Orchestrate Infrastructure:**
   Using the provided Makefile for streamlined execution:
   ```bash
   make up
   ```

4. **Database Provisioning:**
   ```bash
   make migrate
   make seed
   make superuser
   ```

5. **Frontend Development Server (Optional for UI engineering):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   * API Access: `http://localhost:8000/api/`
   * Frontend Application: `http://localhost:5173`

### 📖 API Documentation
The backend provides fully interactive, automatically generated OpenAPI (Swagger) documentation. Once the containers are running, access it at:
👉 **[http://localhost:8000/api/docs](http://localhost:8000/api/docs)**

---

## 👨‍💻 Engineering Leadership

**Krystian Bugalski**  
Enterprise Software Engineer & UI/UX Specialist  
* [LinkedIn](https://www.linkedin.com/in/krystian-bugalski)  
* [GitHub](https://github.com/bedikryst)  

*Designed and engineered with strict adherence to the VoctManager 2026 AI directives and Ethereal design principles.*
