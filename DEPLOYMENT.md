# Deployment Guide - Professional Business Management System

This document outlines the professional deployment workflow for the system, covering the database, backend (API), and frontend (Web App).

---

## 1. Database Setup (MySQL)

Ensure you have a MySQL server running (Version 8.0+ recommended).

1.  **Create Database**: Create a database named `business_management` (or your preferred name).
    ```sql
    CREATE DATABASE business_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```
2.  **User Permissions**: Ensure your database user has sufficient privileges.

---

## 2. Backend Deployment (Node.js/Express)

The backend is located in the `/server` directory.

### Environment Configuration
1.  Navigate to the `server` directory.
2.  Create a `.env` file based on `.env.example`:
    ```env
    PORT=5000
    DB_HOST=your_db_host
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=business_management
    JWT_SECRET=your_super_secret_key
    FRONTEND_URL=https://your-frontend-domain.com
    ```

### Install Dependencies & Build
```bash
cd server
npm install
```

### Run Database Migrations
We use a professional migration runner to ensure your schema is always up to date.
```bash
npm run migrate
```
*This will create a `_migrations` table and apply all pending SQL files from `../database/migrations`.*

### Process Management (Production)
Use **PM2** to keep the server running in the background.
```bash
# Install PM2 globally if not already
npm install -g pm2

# Start the server
pm2 start index.ts --name "tam-api" --interpreter npx --interpreter-args "tsx"
# OR if compiled to JS:
# pm2 start index.js --name "tam-api"

# Save the process list
pm2 save
```

---

## 3. Frontend Deployment (Vite/React)

The frontend is a Vite-based React application.

### Environment Configuration
Create a `.env.production` in the root directory:
```env
VITE_API_URL=https://api.your-domain.com/api
```

### Build the Application
```bash
npm install
npm run build
```
This will generate a `dist/` folder.

### Hosting the Frontend
- **Static Hosting**: Upload the contents of the `dist/` folder to any static host (Netlify, Vercel, S3/CloudFront, or a VPS with Nginx).
- **Nginx Configuration**: If using a VPS, use Nginx to serve the `dist` folder and handle client-side routing:
    ```nginx
    location / {
        root /var/www/tam/dist;
        try_files $uri $uri/ /index.html;
    }
    ```

---

## 4. Professional Checklist

- [ ] **SSL Certificates**: Ensure both frontend and API use HTTPS (use Let's Encrypt / Certbot).
- [ ] **CORS Settings**: In `server/index.ts`, ensure `cors()` is configured with your production frontend URL.
- [ ] **Backups**: Set up automated backups for your MySQL database.
- [ ] **Error Logging**: Check PM2 logs (`pm2 logs tam-api`) regularly.
- [ ] **Security**: Ensure `JWT_SECRET` is long and random.

---

## 5. Maintenance & Updates

To update the system to a new version:
1.  Pull the latest code: `git pull origin main`
2.  Update dependencies: `npm install` (in both root and server)
3.  Run migrations: `cd server && npm run migrate`
4.  Rebuild frontend: `npm run build`
5.  Restart API: `pm2 restart tam-api`
