# PostgreSQL Database Setup Guide

This guide will help you set up a PostgreSQL database for the ShiftStack Aviator application.

## Option 1: Local PostgreSQL (Recommended for Development)

### Prerequisites
- PostgreSQL installed on your machine
- PostgreSQL service running

### Step 1: Install PostgreSQL (if not already installed)

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember the password you set for the `postgres` user

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create the Database

**Windows (Command Prompt):**
```cmd
psql -U postgres -c "CREATE DATABASE aviator;"
```

**macOS/Linux:**
```bash
sudo -u postgres psql -c "CREATE DATABASE aviator;"
```

### Step 3: Create a User (Optional but Recommended)

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create user
CREATE USER aviator_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aviator TO aviator_user;
```

### Step 4: Configure DATABASE_URL

Edit `.env.local` in your project root:

```env
DATABASE_URL="postgresql://aviator_user:your_secure_password@localhost:5432/aviator"

# Or if using the default postgres user:
# DATABASE_URL="postgresql://postgres:your_postgres_password@localhost:5432/aviator"
```

### Step 5: Run Prisma Migrations

```bash
# Push schema to database
npm run prisma:push

# Or if you want to use migrations:
npx prisma migrate dev --name init

# Seed the database
npm run prisma:seed
```

---

## Option 2: Neon (Cloud PostgreSQL - Recommended for Production)

### Step 1: Create Neon Account

1. Go to https://neon.tech
2. Click "Sign Up" (free tier available)
3. Sign up with GitHub, Google, or email

### Step 2: Create a Project

1. After signing up, click "Create a project"
2. Project name: `aviator`
3. Region: Choose the closest region to your users
4. PostgreSQL version: Select the latest (16.x recommended)
5. Click "Create project"

### Step 3: Get Connection String

1. After project creation, you'll see a connection string
2. Copy the connection string (looks like: `postgresql://user:password@ep-xxx.aws.neon.tech/aviator?sslmode=require`)

### Step 4: Configure DATABASE_URL

Edit `.env.local` in your project root:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.aws.neon.tech/aviator?sslmode=require"
```

Replace with your actual connection string from Neon.

### Step 5: Run Prisma Migrations

```bash
# Push schema to database
npm run prisma:push

# Seed the database
npm run prisma:seed
```

---

## Option 3: Docker (Alternative Local Setup)

### Step 1: Create docker-compose.yml

Create `docker-compose.yml` in your project root:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: aviator-postgres
    environment:
      POSTGRES_USER: aviator_user
      POSTGRES_PASSWORD: aviator_password
      POSTGRES_DB: aviator
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### Step 2: Start PostgreSQL

```bash
docker-compose up -d
```

### Step 3: Configure DATABASE_URL

Edit `.env.local`:

```env
DATABASE_URL="postgresql://aviator_user:aviator_password@localhost:5432/aviator"
```

### Step 4: Run Prisma Migrations

```bash
npm run prisma:push
npm run prisma:seed
```

---

## Verification

After setting up the database, verify the connection:

```bash
# Test Prisma connection
npx prisma db pull

# View the database schema
npx prisma studio
```

This will open Prisma Studio in your browser where you can view and edit the database.

---

## JWT Secret Configuration

Add a secure JWT secret to your `.env.local`:

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
```

Generate a secure random secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Troubleshooting

### Connection Refused

**Local PostgreSQL:**
- Ensure PostgreSQL service is running
- Check that the port (5432) is not blocked by firewall
- Verify username and password

**Neon:**
- Ensure your connection string includes `?sslmode=require`
- Check that your Neon project is active (not paused)

### Prisma Errors

**"Driver adapter required":**
- Ensure you're using the Prisma 7 adapter in `src/lib/db.ts`
- Check that `@prisma/adapter-pg` is installed

**"Connection timeout":**
- Check your network connection
- For Neon, ensure you're using the correct region
- For local, ensure PostgreSQL is running

### Authentication Issues

**JWT verification fails:**
- Ensure `JWT_SECRET` is set in `.env.local`
- Make sure the secret is the same across all environments
- Check that tokens aren't expired (default 7 days)

---

## Environment Variables Summary

Your `.env.local` should contain:

```env
# Database
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# PayHero (for payments)
PAYHERO_API_KEY=your_payhero_api_key_here
PAYHERO_API_SECRET=your_payhero_api_secret_here
PAYHERO_CHANNEL_ID=your_channel_id_here

# Firebase (for phone auth)
FIREBASE_PROJECT_ID=shiftstack-aviator
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@shiftstack-aviator.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=""
FIREBASE_SPARK_MODE=true

# Game Constants
MINIMUM_DEPOSIT_KES=49
MINIMUM_STAKE_KES=100
MAX_WEEKLY_PASSWORD_RESETS=2
```

---

## Next Steps

After database setup:

1. Run the development server: `npm run dev`
2. Visit http://localhost:3001
3. Test the authentication flow:
   - Click "Login >" on the game console
   - Sign up with phone number
   - Login with phone number
   - Place bets in Real Mode

The application will now persist user data, bets, and transactions in PostgreSQL.
