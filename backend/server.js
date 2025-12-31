const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, initializeDatabase } = require('./database');
const { extractData } = require('./ocr');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Setup
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

// --- API Endpoints ---

// Upload & Process Receipt
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

    // Insert receipt and get the new ID
    const receiptInsertQuery = 'INSERT INTO receipts (store_name, date_time, total_price, image_path) VALUES ($1, $2, $3, $4) RETURNING id';
    const receiptValues = [data.store_name, new Date().toISOString(), data.total, req.file.filename];
    const receiptResult = await client.query(receiptInsertQuery, receiptValues);
    const receiptId = receiptResult.rows[0].id;

    // Insert products
    if (data.products && data.products.length > 0) {
      const productInsertQuery = 'INSERT INTO products (receipt_id, name, price) VALUES ($1, $2, $3)';
      for (const prod of data.products) {
        await client.query(productInsertQuery, [receiptId, prod.name, prod.price]);
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

// Get Products Comparison
app.get('/api/products', async (req, res) => {
  const query = `
    SELECT p.name, p.price, r.store_name, r.date_time 
    FROM products p 
    JOIN receipts r ON p.receipt_id = r.id 
    ORDER BY p.name
  `;
  try {
    const { rows } = await pool.query(query);
    const comparison = {};
    rows.forEach(row => {
      if (!comparison[row.name]) comparison[row.name] = [];
      comparison[row.name].push({
        store: row.store_name,
        price: row.price,
        date: row.date_time
      });
    });
    const result = Object.keys(comparison).map(name => ({
      name,
      entries: comparison[name]
    }));
    res.json(result);
  } catch (err) {
    console.error('DB_FETCH_ERROR (products):', err);
    res.status(500).json({ error: err.message });
  }
});

// Get All Receipts
app.get('/api/receipts', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM receipts ORDER BY date_time DESC");
    res.json(rows);
  } catch (err) {
    console.error('DB_FETCH_ERROR (receipts):', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Single Receipt with Products
app.get('/api/receipts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const receiptRes = await pool.query("SELECT * FROM receipts WHERE id = $1", [id]);
    if (receiptRes.rows.length === 0) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    const receipt = receiptRes.rows[0];

    const productsRes = await pool.query("SELECT * FROM products WHERE receipt_id = $1", [id]);
    receipt.products = productsRes.rows;
    
    res.json(receipt);
  } catch (err) {
    console.error(`DB_FETCH_ERROR (receipt/${id}):`, err);
    res.status(500).json({ error: err.message });
  }
});

// Update Receipt
app.put('/api/receipts/:id', async (req, res) => {
  const { id } = req.params;
  const { store_name, date_time, total_price, products } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update Receipt Details
    const updateReceiptQuery = "UPDATE receipts SET store_name = $1, date_time = $2, total_price = $3 WHERE id = $4";
    await client.query(updateReceiptQuery, [store_name, date_time, total_price, id]);

    // 2. Delete all old products for this receipt
    await client.query("DELETE FROM products WHERE receipt_id = $1", [id]);

    // 3. Insert new products
    if (products && products.length > 0) {
      const insertProductQuery = "INSERT INTO products (receipt_id, name, price) VALUES ($1, $2, $3)";
      for (const prod of products) {
        await client.query(insertProductQuery, [id, prod.name, prod.price]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Receipt updated successfully" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`DB_UPDATE_ERROR (receipt/${id}):`, err);
    res.status(500).json({ error: 'Failed to update receipt.' });
  } finally {
    client.release();
  }
});

// Delete Receipt
app.delete('/api/receipts/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the image path to delete the file later
    const result = await client.query("SELECT image_path FROM receipts WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    const imagePath = result.rows[0].image_path;

    // Delete from DB. ON DELETE CASCADE will handle products.
    await client.query("DELETE FROM receipts WHERE id = $1", [id]);

    await client.query('COMMIT');

    // Try to delete file after commit
    if (imagePath) {
        const fullPath = path.join(__dirname, 'uploads', imagePath);
        if (fs.existsSync(fullPath)) {
            fs.unlink(fullPath, (err) => {
                if (err) console.error("Error deleting file:", fullPath, err);
            });
        }
    }

    res.json({ success: true, message: "Receipt deleted" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`DB_DELETE_ERROR (receipt/${id}):`, err);
    res.status(500).json({ error: 'Failed to delete receipt.' });
  } finally {
    client.release();
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});