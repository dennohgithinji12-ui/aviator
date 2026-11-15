const { Client } = require('pg');

async function createDatabase() {
  // Try common Laragon PostgreSQL credentials
  const credentials = [
    { user: 'postgres', password: '', host: 'localhost', port: 5432 },
    { user: 'postgres', password: 'postgres', host: 'localhost', port: 5432 },
    { user: 'root', password: '', host: 'localhost', port: 5432 },
    { user: 'root', password: 'root', host: 'localhost', port: 5432 },
  ];

  for (const cred of credentials) {
    try {
      console.log(`Trying to connect with user: ${cred.user}, password: ${cred.password ? '***' : '(empty)'}`);
      
      const client = new Client({
        ...cred,
        database: 'postgres' // Connect to default postgres database first
      });

      await client.connect();
      console.log('✅ Connected to PostgreSQL!');

      // Check if database already exists
      const checkResult = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = 'aviator'"
      );

      if (checkResult.rows.length > 0) {
        console.log('✅ Database "aviator" already exists');
      } else {
        // Create the database
        await client.query('CREATE DATABASE aviator');
        console.log('✅ Database "aviator" created successfully');
      }

      await client.end();
      
      console.log('\n📋 Connection Details:');
      console.log(`DATABASE_URL="postgresql://${cred.user}:${cred.password}@localhost:5432/aviator"`);
      
      return cred;
    } catch (error) {
      console.log(`❌ Failed with these credentials: ${error.message}`);
    }
  }

  console.log('\n❌ Could not connect with any common credentials.');
  console.log('Please check your Laragon PostgreSQL settings or provide the correct credentials.');
  process.exit(1);
}

createDatabase();
