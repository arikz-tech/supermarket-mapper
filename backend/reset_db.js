const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'receipts.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("Clearing all data...");
  
  db.run("DELETE FROM products", (err) => {
    if (err) console.error("Error clearing products:", err.message);
    else console.log("Products cleared.");
  });
  
  db.run("DELETE FROM receipts", (err) => {
    if (err) console.error("Error clearing receipts:", err.message);
    else console.log("Receipts cleared.");
  });

  // Optional: Reset auto-increment counters
  db.run("DELETE FROM sqlite_sequence WHERE name='products' OR name='receipts'", () => {
     console.log("Counters reset.");
  });
});

db.close(() => {
    console.log("Database reset complete.");
});
