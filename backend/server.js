const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, initializeDatabase } = require('./database');
const { extractData } = require('./ocr');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File Upload Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });


// --- API Endpoints ---

app.post('/api/upload', upload.single('receiptImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  console.log(`Processing file: ${filePath}`);

  const client = await pool.connect();
  try {
    const data = await extractData(filePath);
    await client.query('BEGIN');

    const receiptQuery = 'INSERT INTO receipts (store_name, date_time, total_price, image_path) VALUES ($1, $2, $3, $4) RETURNING id';
    const receiptResult = await client.query(receiptQuery, [data.store_name, new Date().toISOString(), data.total, req.file.filename]);
    const receiptId = receiptResult.rows[0].id;

    if (data.products && data.products.length > 0) {
      const productQuery = 'INSERT INTO products (receipt_id, name, price) VALUES ($1, $2, $3)';
      for (const prod of data.products) {
        await client.query(productQuery, [receiptId, prod.name, prod.price]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, receiptId, data });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('UPLOAD_PROCESSING_ERROR:', error);
    res.status(500).json({ error: 'Failed to process file.' });
  } finally {
    client.release();
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.name, p.price, r.store_name, r.date_time FROM products p 
      JOIN receipts r ON p.receipt_id = r.id ORDER BY p.name
    `);
    const comparison = {};
    rows.forEach(row => {
      if (!comparison[row.name]) comparison[row.name] = [];
      comparison[row.name].push({ store: row.store_name, price: row.price, date: row.date_time });
    });
    res.json(Object.keys(comparison).map(name => ({ name, entries: comparison[name] })));
  } catch (err) {
    console.error('DB_FETCH_ERROR (products):', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/receipts', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts ORDER BY date_time DESC");
    res.json(rows);
  } catch (err) {
    console.error('DB_FETCH_ERROR (receipts):', err);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

app.get('/api/receipts/:id', async (req, res) => {
  try {
    const receiptRes = await pool.query("SELECT * FROM receipts WHERE id = $1", [req.params.id]);
    if (receiptRes.rows.length === 0) return res.status(404).json({ error: "Receipt not found" });
    
    const productsRes = await pool.query("SELECT * FROM products WHERE receipt_id = $1", [req.params.id]);
    
    res.json({ ...receiptRes.rows[0], products: productsRes.rows });
  } catch (err) {
    console.error(`DB_FETCH_ERROR (receipt/${req.params.id}):`, err);
    res.status(500).json({ error: 'Failed to fetch receipt details' });
  }
});

app.put('/api/receipts/:id', async (req, res) => {
  const { id } = req.params;
  const { store_name, date_time, total_price, products } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE receipts SET store_name = $1, date_time = $2, total_price = $3 WHERE id = $4", [store_name, date_time, total_price, id]);
    await client.query("DELETE FROM products WHERE receipt_id = $1", [id]);
    if (products && products.length > 0) {
      const query = "INSERT INTO products (receipt_id, name, price) VALUES ($1, $2, $3)";
      for (const prod of products) {
        await client.query(query, [id, prod.name, prod.price]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, message: "Receipt updated successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`DB_UPDATE_ERROR (receipt/${id}):`, err);
    res.status(500).json({ error: 'Failed to update receipt' });
  } finally {
    client.release();
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query("SELECT image_path FROM receipts WHERE id = $1", [id]);
    const imagePath = result.rows.length > 0 ? result.rows[0].image_path : null;
    
    await client.query("DELETE FROM receipts WHERE id = $1", [id]);
    await client.query('COMMIT');

    if (imagePath) {
      const fullPath = path.join(__dirname, 'uploads', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => { if (err) console.error("File deletion error:", err); });
      }
    }
    res.json({ success: true, message: "Receipt deleted" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`DB_DELETE_ERROR (receipt/${id}):`, err);
    res.status(500).json({ error: 'Failed to delete receipt' });
  } finally {
    client.release();
  }
});

app.delete('/api/receipts', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get all image paths before deleting records
    const result = await client.query("SELECT image_path FROM receipts");
    const imagePaths = result.rows.map(row => row.image_path).filter(path => path);

    // Delete all receipts (cascades to products due to FK constraints usually, but to be safe/explicit if constraints vary)
    // Assuming standard FK with ON DELETE CASCADE or simply deleting parent. 
    // If no cascade, we'd need DELETE FROM products first. But let's assume cascade or just truncate.
    // TRUNCATE is faster and resets sequences often, but DELETE is safer with specific constraints.
    // Let's use DELETE FROM receipts to be safe with standard setup.
    await client.query("DELETE FROM receipts"); 
    
    await client.query('COMMIT');

    // Clean up files
    imagePaths.forEach(imagePath => {
      const fullPath = path.join(__dirname, 'uploads', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => { 
          if (err) console.error(`Failed to delete file ${fullPath}:`, err); 
        });
      }
    });

    res.json({ success: true, message: "All receipts deleted" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB_DELETE_ALL_ERROR:', err);
    res.status(500).json({ error: 'Failed to delete all receipts' });
  } finally {
    client.release();
  }
});

// --- Serve Frontend ---
const frontendPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// --- Start Server ---
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
