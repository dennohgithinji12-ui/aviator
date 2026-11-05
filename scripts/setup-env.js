const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '..', '.env.local');

const envContent = `# PostgreSQL Database (Local Laragon)
DATABASE_URL="postgresql://postgres:@localhost:5432/aviator"

# JWT Authentication
JWT_SECRET=8f8315a4a451a6fe3d357aefa42e91ec237929d667ec348ca341b38bb7255738

# PayHero API Credentials (Add your actual keys)
PAYHERO_API_KEY=your_payhero_api_key_here
PAYHERO_API_SECRET=your_payhero_api_secret_here
PAYHERO_CHANNEL_ID=your_channel_id_here

# Firebase Configuration
FIREBASE_PROJECT_ID=shiftstack-aviator
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@shiftstack-aviator.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=""
FIREBASE_SPARK_MODE=true

# Game Constants
MINIMUM_DEPOSIT_KES=49
MINIMUM_STAKE_KES=100
MAX_WEEKLY_PASSWORD_RESETS=2
`;

// Write to .env.local
fs.writeFileSync(envLocalPath, envContent);

console.log('✅ .env.local file created with database connection');
console.log('📋 DATABASE_URL: postgresql://postgres:@localhost:5432/aviator');
console.log('📋 JWT_SECRET configured');
console.log('\n⚠️  Please add your PayHero API credentials to .env.local');
