@echo off
echo 🎨 ArtFreak Deployment Script
echo ==============================

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install git first.
    pause
    exit /b 1
)

REM Check if node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed!

REM Build frontend
echo 🔨 Building frontend...
cd wb-frontend
call npm install
call npm run build
cd ..

echo ✅ Frontend built successfully!

REM Check if .env exists in backend
if not exist "wb-backend\.env" (
    echo ⚠️  No .env file found in backend. Creating one...
    (
        echo PORT=1234
        echo HOST=0.0.0.0
        echo ENVIRONMENT=production
    ) > wb-backend\.env
    echo ✅ Created .env file with default values
)

echo.
echo 🚀 Ready to deploy!
echo.
echo Next steps:
echo 1. Push your code to GitHub:
echo    git add .
echo    git commit -m "Rebrand to ArtFreak"
echo    git push origin main
echo.
echo 2. Deploy backend to Railway/Render:
echo    - Go to railway.app or render.com
echo    - Connect your GitHub repo
echo    - Deploy the wb-backend folder
echo.
echo 3. Deploy frontend to Vercel/Netlify:
echo    - Go to vercel.com or netlify.com
echo    - Connect your GitHub repo
echo    - Deploy the wb-frontend folder
echo.
echo 4. Update API URLs in your code with your backend URL
echo.
echo 📖 See DEPLOYMENT.md for detailed instructions!
echo.
echo Good luck! 🎨✨
pause
