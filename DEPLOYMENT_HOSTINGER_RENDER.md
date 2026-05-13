# Deployment Guide: Hostinger (Frontend/DB) + Render (Backend)

This guide covers deploying your system with the **Frontend and MySQL Database on Hostinger** and the **Node.js API on Render**.

---

## 1. Database Setup (Hostinger)

### Create the Database
1.  Log in to your **Hostinger hPanel**.
2.  Go to **Databases > MySQL Databases**.
3.  Create a new database (e.g., `u123456789_tam`) and a user. **Save these credentials.**

### ⚠️ IMPORTANT: Enable Remote MySQL
By default, Hostinger blocks external connections. Since your backend is on Render, you must allow it:
1.  In Hostinger hPanel, go to **Databases > Remote MySQL**.
2.  In the "IP (Any host, use %)" field, enter `%` (this allows connections from any IP, which is necessary as Render's IPs change).
3.  Choose your database and click **Create**.

---

## 2. Backend Deployment (Render)

### Create a Web Service
1.  Log in to [Render.com](https://render.com).
2.  Click **New + > Web Service**.
3.  Connect your GitHub/GitLab repository.
4.  **Settings**:
    - **Name**: `tam-api`
    - **Environment**: `Node`
    - **Build Command**: `cd server && npm install`
    - **Start Command**: `cd server && npx tsx index.ts` (or `node index.js` if you compile to JS)

### Environment Variables
In the Render dashboard, go to **Environment** and add:
- `PORT`: `10000` (Render's default)
- `DB_HOST`: Your Hostinger Server IP (found in Hostinger MySQL details)
- `DB_USER`: Your Hostinger MySQL username
- `DB_PASSWORD`: Your Hostinger MySQL password
- `DB_NAME`: Your Hostinger MySQL database name
- `JWT_SECRET`: A long random string
- `FRONTEND_URL`: `https://your-hostinger-domain.com`

### Run Migrations
On Render, go to the **Shell** tab of your service and run:
```bash
cd server && npm run migrate
```
*Note: The `database` folder must be inside the `server` directory for this to work on Render (which I have already moved for you).*

---

## 3. Frontend Deployment (Hostinger)

### Prepare the Build
1.  On your local machine, create or update `.env.production` in the root folder:
    ```env
    VITE_API_URL=https://tam-api.onrender.com/api
    ```
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This creates a `dist` folder.

### Upload to Hostinger
1.  In Hostinger hPanel, go to **Files > File Manager**.
2.  Navigate to `public_html`.
3.  Upload all files **inside** your local `dist` folder to `public_html`.

### Handle React Routing (.htaccess)
To ensure your React routes work (e.g., `/login`, `/dashboard`), create a file named `.htaccess` in `public_html` with this content:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 4. Integration Verification

1.  **CORS**: Ensure the `FRONTEND_URL` on Render exactly matches your Hostinger domain (including `https://`).
2.  **Health Check**: Visit `https://tam-api.onrender.com/api/health`. You should see `{"success": true, "message": "Node Server is Running"}`.
3.  **Database Connection**: Check Render logs to ensure it connected to Hostinger MySQL successfully.

---

## Summary of URLs
- **Frontend URL**: `https://your-domain.com`
- **Backend URL**: `https://your-app.onrender.com`
- **Database Host**: `sql123.hostinger.com` (or an IP address)
