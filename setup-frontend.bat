@echo off
echo ========================================
echo Supabase to MySQL Migration Setup
echo ========================================
echo.

echo Step 1: Removing Supabase dependency...
call npm uninstall @supabase/supabase-js
echo.

echo Step 2: Installing Axios...
call npm install axios
echo.

echo Step 3: Setting up environment...
if not exist .env (
    copy .env.example .env
    echo Created .env file from .env.example
    echo Please edit .env and set VITE_API_URL to your API endpoint
) else (
    echo .env file already exists
)
echo.

echo Step 4: Removing Supabase client file...
if exist src\lib\supabase.ts (
    del src\lib\supabase.ts
    echo Deleted src\lib\supabase.ts
) else (
    echo supabase.ts already removed
)
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit .env file and set VITE_API_URL
echo 2. Ensure your MySQL database is set up
echo 3. Ensure your PHP backend is running
echo 4. Run: npm run dev
echo.
pause
