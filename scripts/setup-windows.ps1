# PowerShell Setup Script for StageOneInAction Back Office (Non-Docker)
# This script helps set up PostgreSQL and the application on Windows

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "StageOneInAction Back Office Setup" -ForegroundColor Cyan
Write-Host "Non-Docker Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
$pgPath = $null
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\14\bin",
    "$env:ProgramFiles\PostgreSQL\15\bin",
    "$env:ProgramFiles\PostgreSQL\16\bin"
)

foreach ($path in $possiblePaths) {
    if (Test-Path "$path\psql.exe") {
        $pgPath = $path
        break
    }
}

if ($pgPath) {
    Write-Host "[OK] PostgreSQL found at: $pgPath" -ForegroundColor Green
} else {
    Write-Host "[!] PostgreSQL not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL 15 or later:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Run the installer and remember the password you set for 'postgres' user" -ForegroundColor White
    Write-Host "3. Make sure to include 'Command Line Tools' during installation" -ForegroundColor White
    Write-Host "4. Re-run this script after installation" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Check if Node.js is installed
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if ($nodeVersion) {
    Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "[!] Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js 18 or later from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Prompt for postgres password
$pgPassword = Read-Host "Enter your PostgreSQL 'postgres' user password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword)
$pgPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set environment variable for psql
$env:PGPASSWORD = $pgPasswordPlain

# Create user and database
Write-Host "Creating database user 'stageoneinaction'..." -ForegroundColor Yellow

try {
    & "$pgPath\psql.exe" -U postgres -h localhost -c "CREATE USER stageoneinaction WITH PASSWORD 'stageoneinaction_dev_2024';" 2>$null
    Write-Host "[OK] User created" -ForegroundColor Green
} catch {
    Write-Host "[INFO] User may already exist, continuing..." -ForegroundColor Yellow
}

Write-Host "Creating database 'stageoneinaction'..." -ForegroundColor Yellow

try {
    & "$pgPath\psql.exe" -U postgres -h localhost -c "CREATE DATABASE stageoneinaction OWNER stageoneinaction;" 2>$null
    Write-Host "[OK] Database created" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Database may already exist, continuing..." -ForegroundColor Yellow
}

# Grant privileges
& "$pgPath\psql.exe" -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE stageoneinaction TO stageoneinaction;" 2>$null

# Clear password from environment
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Install npm dependencies
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

# Run Prisma migrations
Write-Host "Setting up database schema with Prisma..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Prisma db push failed" -ForegroundColor Red
    Write-Host "Make sure PostgreSQL is running and the .env file has correct DATABASE_URL" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Database schema created" -ForegroundColor Green

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "[OK] Prisma client generated" -ForegroundColor Green

# Seed the database
Write-Host "Seeding database with demo data..." -ForegroundColor Yellow
npx prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Database seeding failed (may already be seeded)" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Database seeded" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the development server, run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "The application will be available at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor Cyan
Write-Host "  Admin: admin@stageoneinaction.com / admin123" -ForegroundColor White
Write-Host "  Coach: coach@stageoneinaction.com / coach123" -ForegroundColor White
Write-Host ""
