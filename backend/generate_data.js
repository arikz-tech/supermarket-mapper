const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Jimp = require('jimp');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'receipts.db');
const db = new sqlite3.Database(dbPath);

// Sample Data
const SAMPLE_RECEIPTS = [
  {
    store: "FreshMart",
    total: 15.50,
    items: [
      { name: "Milk 1L", price: 2.50 },
      { name: "Bread", price: 3.00 },
      { name: "Eggs 12pk", price: 5.00 },
      { name: "Apples 1kg", price: 5.00 }
    ]
  },
  {
    store: "SuperSave",
    total: 14.00,
    items: [
      { name: "Milk 1L", price: 2.20 },
      { name: "Bread", price: 2.80 },
      { name: "Eggs 12pk", price: 4.50 },
      { name: "Apples 1kg", price: 4.50 }
    ]
  },
  {
    store: "OrganicGrocer",
    total: 22.00,
    items: [
      { name: "Milk 1L", price: 4.00 },
      { name: "Bread", price: 6.00 },
      { name: "Eggs 12pk", price: 7.00 },
      { name: "Apples 1kg", price: 5.00 }
    ]
  },
  {
    store: "Rami Levy",
    total: 14.00,
    items: [
      { name: "Milk 1L", price: 2.30 },
      { name: "Bread", price: 2.90 },
      { name: "Eggs 12pk", price: 4.80 },
      { name: "Apples 1kg", price: 4.00 }
    ]
  },
  {
    store: "Shufersal",
    total: 21.00,
    items: [
      { name: "Milk 1L", price: 3.50 },
      { name: "Bread", price: 5.00 },
      { name: "Eggs 12pk", price: 6.50 },
      { name: "Apples 1kg", price: 6.00 }
    ]
  }
];

async function generateImage(receipt, filename) {
  try {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const image = new Jimp(400, 600, 0xFFFFFFFF); // White background

    let y = 20;
    
    image.print(font, 20, y, receipt.store);
    y += 40;

    receipt.items.forEach(item => {
      // Pad to ensure space between name and price for easier OCR
      image.print(font, 20, y, `${item.name}          ${item.price.toFixed(2)}`);
      y += 30;
    });

    y += 20;
    image.print(font, 20, y, `TOTAL          ${receipt.total.toFixed(2)}`);

    await image.writeAsync(filename);
    console.log(`Generated image: ${filename}`);
  } catch (err) {
    console.error("Error generating image:", err);
  }
}

function insertReceipt(receipt, idx) {
    return new Promise((resolve, reject) => {
        const imagePath = `mock_image_${idx}.png`;
        db.run("INSERT INTO receipts (store_name, date_time, total_price, image_path) VALUES (?, ?, ?, ?)", 
            [receipt.store, new Date().toISOString(), receipt.total, imagePath], 
            function(err) {
                if (err) return reject(err);
                const receiptId = this.lastID;
                
                let completed = 0;
                if (receipt.items.length === 0) resolve();

                receipt.items.forEach(item => {
                    db.run("INSERT INTO products (receipt_id, name, price) VALUES (?, ?, ?)", 
                        [receiptId, item.name, item.price], 
                        (err) => {
                            if (err) return reject(err);
                            completed++;
                            if (completed === receipt.items.length) resolve();
                        }
                    );
                });
            }
        );
    });
}

async function seedDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("DELETE FROM products");
            db.run("DELETE FROM receipts", async (err) => {
                if (err) return reject(err);
                
                try {
                    for (let i = 0; i < SAMPLE_RECEIPTS.length; i++) {
                        await insertReceipt(SAMPLE_RECEIPTS[i], i);
                    }
                    console.log("Database seeded.");
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

async function run() {
  await seedDatabase();
  
  const outputDir = path.resolve(__dirname, '../sample_receipts');
  
  for (let i = 0; i < SAMPLE_RECEIPTS.length; i++) {
    const filename = path.join(outputDir, `receipt_${i + 1}.png`);
    await generateImage(SAMPLE_RECEIPTS[i], filename);
  }
  
  db.close();
}

run().catch(console.error);