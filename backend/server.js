const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./database');
const { extractData } = require('./ocr');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload & Process
app.post('/api/upload', upload.single('receiptImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  console.log(`Processing file: ${filePath}`);

  try {
    const data = await extractData(filePath);
    
    const stmt = db.prepare("INSERT INTO receipts (store_name, date_time, total_price, image_path) VALUES (?, ?, ?, ?)");
    stmt.run(data.store_name, new Date().toISOString(), data.total, req.file.filename, function(err) {
      if (err) {
        console.error('DB_INSERT_ERROR:', err.message);
        return res.status(500).json({ error: 'Failed to save receipt data.' });
      }
      
      const receiptId = this.lastID;
      const prodStmt = db.prepare("INSERT INTO products (receipt_id, name, price) VALUES (?, ?, ?)");
      
      if (data.products && data.products.length > 0) {
        data.products.forEach(prod => {
          prodStmt.run(receiptId, prod.name, prod.price);
        });
      }
      prodStmt.finalize();
      
      res.json({ success: true, receiptId, data });
    });
    stmt.finalize();

  } catch (error) {
    console.error('UPLOAD_PROCESSING_ERROR:', error.message);
    // Send a more specific error message to the client
    if (error.message.includes("PDF conversion failed")) {
      // If Ghostscript is not installed or fails
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to process file.' });
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

// Get Single Receipt with Products
app.get('/api/receipts/:id', (req, res) => {
  const id = req.params.id;
  
  db.get("SELECT * FROM receipts WHERE id = ?", [id], (err, receipt) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!receipt) return res.status(404).json({ error: "Receipt not found" });

    db.all("SELECT * FROM products WHERE receipt_id = ?", [id], (err, products) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...receipt, products });
    });
  });
});

// Update Receipt
app.put('/api/receipts/:id', (req, res) => {
  const id = req.params.id;
  const { store_name, date_time, total_price, products } = req.body;

  db.serialize(() => {
    // 1. Update Receipt Details
    const stmt = db.prepare("UPDATE receipts SET store_name = ?, date_time = ?, total_price = ? WHERE id = ?");
    stmt.run(store_name, date_time, total_price, id, function(err) {
      if (err) {
        console.error("Update Receipt Error:", err);
        return res.status(500).json({ error: err.message });
      }
    });
    stmt.finalize();

    // 2. Replace Products (Delete all old, Insert new)
    // Transaction-like behavior is better, but serialize ensures sequential execution in sqlite3 node driver
    db.run("DELETE FROM products WHERE receipt_id = ?", [id], (err) => {
      if (err) {
        console.error("Delete Products Error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (products && products.length > 0) {
        const prodStmt = db.prepare("INSERT INTO products (receipt_id, name, price) VALUES (?, ?, ?)");
        products.forEach(prod => {
          prodStmt.run(id, prod.name, prod.price);
        });
        prodStmt.finalize();
      }
      
      res.json({ success: true, message: "Receipt updated successfully" });
    });
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
