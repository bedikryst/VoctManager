# 🎼 VoctManager | Immersive Web Experience & Enterprise OS

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Django](https://img.shields.io/badge/Django_4-092E20?style=for-the-badge&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

**VoctManager** is a dual-architecture project bridging the gap between high-end creative frontend development and robust software engineering. It serves as both an immersive, cinematic landing page (Public Face) and a complex ERP/CRM operating system (Private OS) for professional vocal ensembles and orchestras.

> **Note:** This project is a flagship piece of my engineering portfolio. It demonstrates the rare ability to deliver Awwwards-winning creative web experiences alongside scalable, data-heavy enterprise applications within a single Full-Stack monorepo.

---

## 🎭 Part I: The Public Face (Creative Development)
A highly optimized, immersive web experience built for storytelling and brand building.

* 🎬 **Scrollytelling & Parallax:** Mathematical scroll kinematics using **Framer Motion** (`useScroll`, `useTransform`). Elements dynamically react to the user's scroll position, controlling video scaling, opacity masks, and architectural grids.
* 🌊 **Smooth Scrolling:** Integrated **Lenis** (`@studio-freight/lenis`) for 60FPS fluid scrolling mechanics, ensuring that scroll-linked animations remain perfectly synced and buttery smooth across all devices.
* 🎛️ **Hardware-Accelerated Physics:** Custom interactive hooks (`useMouseAndGyro`, `useScrollyAudio`) that tie mouse movement, gyroscope data, and audio playback to UI micro-interactions.
* ✨ **Cinematic UI/UX:** Deep Glassmorphism, brutalist typography masks, dynamic lighting overlays, and a custom interactive cursor (`CursorContext`).

---

## 🏢 Part II: The Enterprise OS (Software Engineering)
A secured, scalable ERP platform that digitizes and automates production workflows.

* 👥 **HR & Roster Management:** Advanced artist profiles, technical crew management, and financial settlements.
* 🗄️ **Smart Archive:** Digital repertoire management with automated distribution of sheet music (PDFs) and practice tracks (MP3/MIDI).
* 📅 **Event & Production Planning:** Concert project creation, automated *Call Sheet* (PDF) generation, and detailed *Run-sheet* building.
* 🎵 **Micro-Casting & Setlists:** Interactive concert program builder using a fluid Drag & Drop interface (`@hello-pangea/dnd`).
* ✅ **High-Performance Attendance Matrix:** A powerful, 60FPS grid module for rapid attendance tracking, backed by `O(1)` Hash Maps to prevent the "Grid of Death" re-render issue.

---

## 🏗️ Architecture & Engineering Highlights

The application stack was carefully chosen to solve specific technical challenges.

### 🌐 Frontend Architecture
* **State Management Paradigm:** A hybrid approach using **Zustand** for lightweight global UI state (e.g., loading screens, themes) and **React Query (`@tanstack/react-query`)** for Server State. 
* **Zero Prop-Drilling:** Completely eliminated the *Double-Fetch* anti-patterns. The UI relies on smart cache invalidation and background data synchronization.
* **CSS & Layout:** Bypassed CSS *Stacking Context* traps using `React.createPortal()`, ensuring flawless z-index layering for complex Slide-over panels.

### ⚙️ Backend (Django + DRF)
* **API Design:** RESTful API built with Django REST Framework, enforcing strict *Role-Based Access Control* (RBAC).
* **Database Optimization:** Advanced implementation of `select_related` and `prefetch_related`, eliminating N+1 query bottlenecks.
* **Soft-Delete Resolution:** Preserved database integrity by overriding `create` methods to seamlessly "resurrect" historical records in junction tables, preventing Unique Constraint errors.
* **Asynchronous Processing:** Integrated **Celery** to offload heavy I/O operations (e.g., generating complex, styled PDF contracts and ZAiKS reports via WeasyPrint) from the Main Thread.

### 🐳 DevOps & Infrastructure
* Fully containerized environment using **Docker** and **Docker Compose**.
* Environment separation for Development and Production (`docker-compose.prod.yml`).
* Reverse Proxy utilizing **Nginx** optimized for serving static assets (Vite build) and routing API traffic to WSGI/ASGI containers.


📸 Screenshots

Main Dashboard (Bento Grid View)

Project Editor Panel (Slide-over / Portals)

Attendance Matrix (High-density data grid)

Archive Management (MP3/PDF Uploads)

---

## 🚀 Quickstart (Local Development)

The project relies on Docker, simplifying the bootstrapping process to just a few commands.

### Prerequisites
* Docker and Docker Compose
* Node.js (optional, for local frontend development outside the container)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/voctmanager.git](https://github.com/your-username/voctmanager.git)
   cd voctmanager
   ```

### 2. Set up environment variables:
   Copy the example files from the root and module directories.
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

### 3. Spin up the Docker containers:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
   ```

### 4. Run migrations, seed the database and create a superuser (in a new terminal tab):
   ```bash
   docker compose exec web python manage.py migrate
   docker compose exec web python manage.py seed_db
   docker compose exec web python manage.py createsuperuser
   ```
   The API will be available at http://localhost:8000/api/ and the React frontend at http://localhost:5173.

### 5. 📖 API Documentation

The backend provides a fully interactive OpenAPI (Swagger) documentation, automatically generated via `drf_spectacular`. 
Once the Docker containers are up and running, you can access the documentation at:
👉 **[http://localhost:8000/api/docs](http://localhost:8000/api/docs)**

## 👨‍💻 Author

**Krystian Bugalski**
* [LinkedIn](https://www.linkedin.com/in/krystian-bugalski)
* [GitHub](https://github.com/bedikryst)

*Designed and developed as a modern solution for choral management.*
