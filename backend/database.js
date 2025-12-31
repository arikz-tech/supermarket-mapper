const { Pool } = require('pg');

// Check for the DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Please provide the connection string for your PostgreSQL database.");
}

console.log("DATABASE_URL from environment:", process.env.DATABASE_URL);

// Create a new pool instance.
// The 'pg' library will automatically use the DATABASE_URL environment variable.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If you're deploying to a service that requires SSL/TLS for Postgres,
  // you might need to add this configuration. Render does.
  ssl: {
    rejectUnauthorized: false
  }
});

const initializeDatabase = async () => {
  console.log("Connecting to the database and ensuring tables exist...");
  try {
    // Create receipts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        store_name VARCHAR(255),
        date_time TIMESTAMP WITH TIME ZONE,
        total_price REAL,
        image_path VARCHAR(255)
      );
    `);

    // Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
        name VARCHAR(255),
        price REAL
      );
    `);
    console.log("Database tables are ready.");
  } catch (err) {
    console.error("Error initializing database:", err.stack);
    // Exit the process if we can't connect or create tables, as the app can't run
    process.exit(1);
  }
};

// Export the pool and the initialization function
module.exports = {
  pool,
  initializeDatabase,
  query: (text, params) => pool.query(text, params),
};