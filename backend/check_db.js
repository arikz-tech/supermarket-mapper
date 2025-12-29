const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'receipts.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT * FROM receipts", (err, rows) => {
        if (err) console.error(err);
        else {
            console.log(`Found ${rows.length} receipts.`);
            rows.forEach(r => console.log(r));
        }
    });
});

db.close();
