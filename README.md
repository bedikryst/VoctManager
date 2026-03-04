# VoctManager Enterprise 🎵

**🚀 Live Demo:** [test.voctensemble.com](https://voctensemble.com/test) *(Staging Environment)*

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

VoctManager is a comprehensive, full-stack ERP (Enterprise Resource Planning) designed specifically for the professional vocal ensemble **VoctEnsemble**. 

It elegantly combines a high-end, cinematic public landing page with a secure, role-based administrative dashboard for HR, payroll, and digital repertoire management.

## ✨ Key Features

### 🏢 Internal System (Admin & Artists Dashboard)
* **Role-Based Access Control (RBAC):** JWT-based authentication separating Superusers (Board) from standard Artists.
* **Automated Payroll & Contracting:** Dynamic generation of PDF contracts using `WeasyPrint`. The system generates binary files entirely in-memory (`io.BytesIO`) and allows batch-downloading via dynamically constructed `.zip` archives.
* **Repertoire Archive:** A digital library supporting `.pdf` sheet music and isolated `.mp3`/`.mid` voice-part tracks, integrated with Django's `FileField`.
* **Cast Management:** Complex Many-To-Many relationships handling concert casting, global fee assignments, and attendance statuses.

### 🌍 Public Facing UI
* **Scrollytelling & Parallax:** Implements advanced `framer-motion` hooks (`useScroll`, `useTransform`) for a deeply immersive, editorial design.
* **Glassmorphism & Brutalism:** High-contrast typography paired with modern glass UI elements (Floating Pill Navbar).

## 🛠️ Technology Stack

**Frontend:**
* React (Vite)
* Tailwind CSS (Utility-first styling)
* Framer Motion (Advanced physics-based animations)
* React Router DOM

**Backend:**
* Python / Django 6.x
* Django REST Framework (DRF)
* SimpleJWT (Authentication)
* PostgreSQL (Relational Database)
* WeasyPrint (HTML to PDF rendering)

**DevOps:**
* Docker & Docker Compose (Containerization)

## 📸 Screens

<details>
  <summary><b>Click here to see!</b></summary>
  <br>

  **Login Panel (RBAC)**
  <img width="475" alt="login_panel" src="https://github.com/user-attachments/assets/14ee42a0-81f9-46dd-9644-a594fee825de" />
  
  <hr>

  **Media Panel (Digital Archive)**
  <img width="939" alt="media_panel" src="https://github.com/user-attachments/assets/2c74c1d9-0007-4acc-a6c0-9bb18a66e470" />

  <hr>

  **Project Details (Casting & Sheet Music)**
  <img width="946" alt="project_details" src="https://github.com/user-attachments/assets/201ce1d3-3bb0-4feb-9826-8c1fd00a6b49" />

</details>

---

## 🚀 Local Setup & Installation

## ⚠️ Note on Media Assets & Intellectual Property

Please note that the original photography, video materials, and audio recordings featured on the production website (`voctensemble.com`) are the exclusive intellectual property of the VoctEnsemble. 

To respect copyright and privacy regulations, these binary media files (`*.jpg`, `*.mp4`) have been explicitly excluded from this public repository via `.gitignore` to prevent unauthorized distribution and repository bloat.

**If you are running this project locally for review:**
The application will run perfectly, but image placeholders will return a `404 Not Found` in the console. To experience the full visual layout locally, simply drop any placeholder images into the `frontend/public/` directory and rename them to match the asset paths defined in the React components (e.g., `flor.jpg`, `portret.jpg`).


To run this project locally using Docker, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/bedikryst/voctmanager.git
cd voctmanager
```

### 2. Environment Variables
Create a `.env` file in the root backend directory (use the template below):
```env
SECRET_KEY=your_secret_key_here
DEBUG=True
DB_NAME=voct_db
DB_USER=voct_user
DB_PASSWORD=your_password
DEFAULT_ARTIST_PASSWORD=default_pass
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Create a `.env` file in the frontend directory:
```env
VITE_API_URL=http://localhost:8000
```

### 3. Run with Docker Compose
Spin up the PostgreSQL database and Django backend:
```bash
docker-compose up --build -d
```

### 4. Run database migrations & create Superuser
```bash
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

### 5. Start the React Frontend
Open a new terminal, navigate to your frontend folder (e.g., `cd frontend`), and run:
```bash
npm install
npm run dev
```

## 👨‍💻 Author

**Krystian Bugalski**
* [LinkedIn](https://www.linkedin.com/in/krystian-bugalski)
* [GitHub](https://github.com/bedikryst)

*Designed and developed as a modern solution for choral management.*
