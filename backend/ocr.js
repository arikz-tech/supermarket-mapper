const vision = require('@google-cloud/vision');

// --- Google Cloud Authentication ---

// This function robustly initializes the Google Vision client.
// 1. It first checks for the GOOGLE_APPLICATION_CREDENTIALS environment variable.
// 2. If the variable contains JSON, it parses it directly. This is best for cloud (Render, Railway, Vercel).
// 3. If it's not JSON, it assumes it's a file path. This is best for local development.
function initializeVisionClient() {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentials) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
    );
  }

  try {
    // Try to parse the variable as JSON content
    const parsedCredentials = JSON.parse(credentials);
    console.log('[OCR] Initializing Vision client from JSON credentials in environment variable.');
    return new vision.ImageAnnotatorClient({
      credentials: parsedCredentials
    });
  } catch (e) {
    // If parsing fails, assume it's a file path
    console.log('[OCR] Initializing Vision client from file path in environment variable.');
    return new vision.ImageAnnotatorClient({
      keyFilename: credentials
    });
  }
}

const client = initializeVisionClient();


// --- Main OCR Function ---

async function extractData(filePath) {
  try {
    console.log(`[OCR] Processing ${filePath} with Google Cloud Vision...`);
    
    const [result] = await client.textDetection(filePath);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0 || !detections[0].description) {
      console.log('[OCR] No text detected.');
      return { store_name: "Unknown", products: [], total: 0 };
    }

    const fullText = detections[0].description;
    console.log('[OCR] Full text detected.');

    return parseReceiptText(fullText);

  } catch (error) {
    console.error("GOOGLE_VISION_ERROR:", error);
    throw new Error("Failed to process the receipt with Google Cloud Vision.");
  }
}

// --- Text Parser ---

function parseReceiptText(text) {
  const lines = text.split('\n');
  const products = [];
  let total = 0.0;
  let storeName = "Unknown Store";

  if (lines.length > 0 && lines[0].trim().length > 1) {
    storeName = lines[0].trim();
  }

  const priceRegex = /(?:₪\s*)?(\d+\.\d{2})\s*$/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const match = trimmedLine.match(priceRegex);
    
    if (match) {
      const priceVal = parseFloat(match[1]);
      let name = trimmedLine.substring(0, match.index).trim();
      
      const isTotalLine = /סה"כ|סך הכל|סהכ|total|סופי|לתשלום/i.test(name);
      
      if (name.length > 1 && !isTotalLine) {
        name = name.replace(/[0-9]/g, '').trim(); 
        if (name) {
          products.push({ name, price: priceVal });
        }
      }
    }
  }

  // Calculate total as the sum of all identified products
  total = products.reduce((sum, p) => sum + p.price, 0);
  
  console.log(`[Parser] Store: ${storeName}, Total: ${total}, Products Found: ${products.length}`);
  return { store_name: storeName, products, total };
}

module.exports = { extractData };