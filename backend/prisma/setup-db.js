const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const net = require('net');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const envPath = path.join(__dirname, '../../.env');

// Helper to check if a TCP port is open (e.g. Postgres 5432)
function checkPostgresReachable(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isOpened = false;

    socket.setTimeout(timeout);
    
    socket.connect(port, host, () => {
      isOpened = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function run() {
  console.log('--- Vexel DB Setup Assistant ---');
  
  // Parse DATABASE_URL if exists
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vexel';
  console.log(`Configured database string: ${dbUrl}`);

  let usePostgres = false;

  // Attempt to parse host and port
  try {
    const urlMatch = dbUrl.match(/@([^/:]+)(?::(\d+))?/);
    if (urlMatch) {
      const host = urlMatch[1];
      const port = urlMatch[2] ? parseInt(urlMatch[2]) : 5432;
      
      console.log(`Checking connection to database host: ${host} on port: ${port}...`);
      const reachable = await checkPostgresReachable(host, port);
      
      if (reachable) {
        console.log('PostgreSQL database server is active and reachable!');
        usePostgres = true;
      } else {
        console.log('PostgreSQL server is NOT reachable on this port.');
      }
    }
  } catch (err) {
    console.error('Failed to parse database connection parameters:', err.message);
  }

  const prismaDir = __dirname;
  const targetSchema = path.join(prismaDir, 'schema.prisma');

  if (usePostgres) {
    console.log('Proceeding with PostgreSQL configurations...');
    // Ensure the main postgres schema is copied or active
    // We already wrote schema.prisma as PostgreSQL, so it is ready!
  } else {
    console.log('\n[!] FALLBACK TO SQLITE DEV ENVIRONMENT');
    console.log('No active PostgreSQL server detected. Setting up localized SQLite database (dev.db) for zero-config run...');

    // 1. Copy SQLite schema to schema.prisma
    const sqliteSchemaPath = path.join(prismaDir, 'schema.sqlite.prisma');
    if (fs.existsSync(sqliteSchemaPath)) {
      fs.copyFileSync(sqliteSchemaPath, targetSchema);
      console.log('Successfully swapped schema to SQLite format.');
    } else {
      console.error('Error: schema.sqlite.prisma not found. Cannot swap database schemas.');
      process.exit(1);
    }

    // 2. Update .env file to use SQLite file URL
    try {
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        // Replace database URL
        envContent = envContent.replace(/DATABASE_URL=.*/, 'DATABASE_URL="file:./dev.db"');
        fs.writeFileSync(envPath, envContent);
        console.log('Updated .env database connection string to: file:./dev.db');
      } else {
        fs.writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\nJWT_SECRET=vexel-secret-key-12345\n');
        console.log('Created .env with local SQLite database parameters.');
      }
    } catch (err) {
      console.error('Failed to update environmental configuration:', err.message);
    }
  }

  // 3. Generate Prisma client & Push schema structure
  try {
    console.log('\nRunning Prisma schema generation and database migration...');
    
    // Run prisma db push directly (since it works for both SQLite and PG without needing pre-existing migrations)
    execSync('npx prisma db push --schema=prisma/schema.prisma', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('Database structures successfully initialized.');

    // 4. Seed Database
    console.log('\nRunning database seeds...');
    execSync('node prisma/seed.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('Database seeding finished.');

    console.log('\n--- DB Setup Success! ---');
  } catch (err) {
    console.error('\n[X] Database initialization failed:', err.message);
    process.exit(1);
  }
}

run();
