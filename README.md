# VoctManager 🎼

Enterprise-grade management system designed specifically for a cappella vocal ensembles and professional choirs. 
It streamlines HR logistics, contract generation, repertoire archiving, and rehearsal planning.

## 🚀 Project Overview

Managing a professional vocal octet requires handling complex logistics, from tracking individual artist contracts to managing precise voice divisions (divisi) per musical piece. **VoctManager** replaces spreadsheets with a scalable, automated system.

### Key Features
* **Role-Based Data Isolation:** Secure JWT authentication. Board members see financial data; artists only see their own contracts and assigned repertoire.
* **Automated PDF Generation:** Uses `WeasyPrint` and `Celery` to asynchronously generate and zip dozens of personalized legal contracts in seconds without blocking the server thread.
* **Advanced Repertoire Archive:** Tracks composers, arrangers, specific vocal castings (e.g., Soprano 1, Vocal Percussion), and provides reference audio tracks.
* **Smart Conductor Dashboard:** Dynamic setlist building, rehearsal attendance tracking with absentee notes, and vocal profile management.

## 🛠️ Tech Stack

**Backend (API-First Architecture):**
* Python 3.12 / Django 6.x
* Django Rest Framework (DRF) + SimpleJWT
* PostgreSQL (Database)
* Redis & Celery (Asynchronous Task Queue)
* WeasyPrint (Headless PDF Rendering)

**Frontend (SPA):**
* React 18 / Vite
* Tailwind CSS (Styling)
* Framer Motion (Animations)
* Axios (API Client)

**Infrastructure:**
* Docker & Docker Compose (Containerization)
* Nginx (Reverse Proxy & Static File Serving)

## ⚙️ Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/voctmanager.git](https://github.com/your-username/voctmanager.git)
   cd voctmanager
   ```

### 2. Set up environment variables:
   Create .env files in both the backend/ and frontend/ directories based on the provided .env.example files.

### 3. Spin up the Docker containers:
   ```bash
   docker-compose up --build -d
   ```

### 4. Initialize the Database:
   ```bash
   docker compose exec web python manage.py makemigrations
   docker compose exec web python manage.py migrate
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
