# Testing Guide - Full-Stack React & Node Environment

## Pre-Testing Checklist

Before testing, ensure:
- ✅ **Axios** is installed in the frontend (`npm list axios`).
- ✅ **React Frontend** is configured correctly via `.env` (`VITE_API_URL=http://localhost:5000/api`).
- ✅ **Node.js Express Server** is installed via `cd server && npm install`.
- ✅ **Server Environment** is configured properly in `server/.env` (DB_NAME, DB_USER, DB_PASSWORD).
- ✅ **MySQL database** is up and running your existing schema locally.

## Start the Full Stack

From the root project directory:
```bash
npm run dev:all
```
*Note: This command spins up both your Vite frontend and your Express backend concurrently!*

## Test Plan

### 1. Backend REST API Tests

Test backend endpoints using curl or Postman targeting **port 5000**.

#### Health Check
```bash
curl http://localhost:5000/api/health
```
**Expected:** `{"success": true, "message": "Node Server is Running"}`

#### Register User
*(Handled through the existing logic by creating a user payload referencing your MySQL)*
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```
**Expected:** Returns User details and the `token` generated securely via JWT.

#### Fetch Products (Generic CRUD format)
```bash
curl http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
**Expected:** An array wrapping all your MySQL products nicely.

---

### 2. Frontend Sanity Validation

#### Test 1: Application Connects
1. Run `npm run dev:all`
2. Open browser to `http://localhost:5173`
3. App loads cleanly and the console isn't generating Supabase errors.

#### Test 2: Standard Authentication
1. Go to Login.
2. Enter valid database `users` credentials. 
3. Observe token drop into `localStorage` dynamically routing you into the main CRM.

#### Test 3: API CRUD
1. Hit products/customers and verify data mapping from the `mysql` node connector to the frontend table schemas smoothly.

## Common Issues & Troubleshooting

### Issue: Database Connection Rejected
**Solution:** Check `server/.env` fields for typos. Confirm the MySQL service is actually active via task manager or standard cli (`mysql -u root -p`). Verify your schemas were not dropped during previous tests.

### Issue: JWT Verification Failed (401)
**Solution:** Make sure your `server/.env` features a valid `JWT_SECRET` key, and the frontend user hasn't cached an old PHP-based token. Logout inside React to flush localStorage and fetch a fresh node.js token.

### Issue: Network Failure on React End
**Solution:** If XHR requests hit a wall, guarantee your `.env` frontend value matches `http://localhost:5000/api`. By default, Vite defaults might clash if not specifically overridden correctly.
