const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
let pool;

if (isProduction) {
  // Check for the DATABASE_URL environment variable
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set. Please provide the connection string for your PostgreSQL database.");
  }

  console.log("DATABASE_URL from environment:", process.env.DATABASE_URL);

  // Create a new pool instance.
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log("Using local SQLite database for development.");
  const dbPath = path.resolve(__dirname, 'receipts.db');
  const db = new sqlite3.Database(dbPath);

  // Helper to run sqlite queries with Promise
  const runQuery = (text, params = []) => {
    return new Promise((resolve, reject) => {
      // Normalize SQL: $1, $2 -> ?, ?
      let sql = text.replace(/\$\d+/g, '?');
      
      // Handle RETURNING clause (simplistic check for this app's usage)
      const hasReturning = /RETURNING\s+id/i.test(sql);
      if (hasReturning) {
         sql = sql.replace(/RETURNING\s+id/i, '');
      }

      // Determine if we want rows (SELECT) or just execution (INSERT, UPDATE, DELETE, BEGIN, COMMIT)
      // SQLite 'all' returns rows, 'run' returns metadata
      const isSelect = /^\s*SELECT/i.test(sql);

      if (isSelect) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows });
        });
      } else {
        db.run(sql, params, function(err) {
          if (err) return reject(err);
          // Mimic PG result
          // For INSERT with RETURNING id expectation, we provide lastID
          resolve({ 
            rows: hasReturning ? [{ id: this.lastID }] : [],
            rowCount: this.changes 
          });
        });
      }
    });
  };

  // Mock Pool interface
  pool = {
    connect: async () => ({
      query: runQuery,
      release: () => {}
    }),
    query: runQuery
  };
}

const initializeDatabase = async () => {
  console.log("Connecting to the database and ensuring tables exist...");
  try {
    if (isProduction) {
        // Postgres Initialization
        await pool.query(`
        CREATE TABLE IF NOT EXISTS receipts (
            id SERIAL PRIMARY KEY,
            store_name VARCHAR(255),
            date_time TIMESTAMP WITH TIME ZONE,
            total_price REAL,
            image_path VARCHAR(255)
        );
        `);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
            name VARCHAR(255),
            price REAL
        );
        `);
    } else {
        // SQLite Initialization
        // Use simpler syntax compatible with SQLite
        await pool.query(`
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_name TEXT,
            date_time TEXT,
            total_price REAL,
            image_path TEXT
        );
        `);

        await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id INTEGER,
            name TEXT,
            price REAL,
            FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
        );
        `);
    }
    console.log("Database tables are ready.");
  } catch (err) {
    console.error("Error initializing database:", err.stack || err);
    process.exit(1);
  }
};

module.exports = {
  pool,
  initializeDatabase,
  query: (text, params) => pool.query(text, params),
};
