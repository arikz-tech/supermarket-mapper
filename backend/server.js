const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./database');
const { extractData } = require('./ocr');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Ensure directory exists (node 10+ has fs.mkdir recursive, but we assume it exists or create it)
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.send('Receipt Mapper API Running');
});

// Upload & Process
app.post('/api/upload', upload.single('receiptImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imagePath = req.file.path;
  console.log(`Processing file: ${imagePath}`);

  try {
    const data = await extractData(imagePath);
    
    const stmt = db.prepare("INSERT INTO receipts (store_name, date_time, total_price, image_path) VALUES (?, ?, ?, ?)");
    stmt.run(data.store_name, new Date().toISOString(), data.total, req.file.filename, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const receiptId = this.lastID;
      const prodStmt = db.prepare("INSERT INTO products (receipt_id, name, price) VALUES (?, ?, ?)");
      
      data.products.forEach(prod => {
        prodStmt.run(receiptId, prod.name, prod.price);
      });
      prodStmt.finalize();
      
      res.json({ success: true, receiptId, data });
    });
    stmt.finalize();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Get Products Comparison
app.get('/api/products', (req, res) => {
  const query = `
    SELECT p.name, p.price, r.store_name, r.date_time 
    FROM products p 
    JOIN receipts r ON p.receipt_id = r.id 
    ORDER BY p.name
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Grouping
    const comparison = {};
    rows.forEach(row => {
      if (!comparison[row.name]) comparison[row.name] = [];
      comparison[row.name].push({
        store: row.store_name,
        price: row.price,
        date: row.date_time
      });
    });
    
    // Convert to array
    const result = Object.keys(comparison).map(name => ({
      name,
      entries: comparison[name]
    }));
    
    res.json(result);
  });
});

// Get All Receipts
app.get('/api/receipts', (req, res) => {
  db.all("SELECT * FROM receipts ORDER BY date_time DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Delete Receipt
app.delete('/api/receipts/:id', (req, res) => {
  const id = req.params.id;
  
  // First get the image path to delete file
  db.get("SELECT image_path FROM receipts WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Receipt not found" });

    const imagePath = row.image_path;

    // Delete from DB (Manually delete products first since FK cascade isn't always on by default in sqlite node driver without explicit config)
    db.serialize(() => {
      db.run("DELETE FROM products WHERE receipt_id = ?", [id]);
      db.run("DELETE FROM receipts WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Try to delete file
        const fs = require('fs');
        const fullPath = path.join(__dirname, 'uploads', imagePath);
        // Also check if it might be a relative path or sample path
        const possibleSamplePath = path.resolve(__dirname, '../sample_receipts', path.basename(imagePath));

        if (fs.existsSync(fullPath)) {
            fs.unlink(fullPath, () => {});
        } else if (fs.existsSync(possibleSamplePath) && imagePath.includes('mock_image')) {
            // It's a sample image, maybe don't delete? Or delete if copied.
            // For now, let's not delete sample source files to allow re-seeding, 
            // but usually uploads are unique.
        }

        res.json({ success: true, message: "Receipt deleted" });
      });
    });
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
