const vision = require('@google-cloud/vision');
const fs = require('fs');
const path = require('path');

// Verify credentials exist
const credentialsPath = path.join(__dirname, 'google-credentials.json');
if (!fs.existsSync(credentialsPath)) {
  throw new Error("Google Cloud credentials file not found at 'backend/google-credentials.json'. Please follow the setup instructions.");
}

// Creates a client
const client = new vision.ImageAnnotatorClient({
  keyFilename: credentialsPath
});

async function extractData(filePath) {
  try {
    console.log(`[OCR] Processing ${filePath} with Google Cloud Vision...`);
    
    // Performs text detection on the local file
    const [result] = await client.textDetection(filePath);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      console.log('[OCR] No text detected.');
      return { store_name: "Unknown", products: [], total: 0 };
    }

    // The first annotation is the full text
    const fullText = detections[0].description;
    console.log('[OCR] Full text detected.');

    return parseReceiptText(fullText);

  } catch (error) {
    console.error("GOOGLE_VISION_ERROR:", error);
    throw new Error("Failed to process the receipt with Google Cloud Vision.");
  }
}

function parseReceiptText(text) {
  const lines = text.split('\n');
  const products = [];
  let total = 0.0;
  let storeName = "Unknown Store";

  // Heuristic: First non-empty line might be store name
  for (let line of lines) {
    if (line.trim().length > 3) {
      storeName = line.trim();
      break;
    }
  }

  // Regex to find prices, potentially with shekel sign (₪)
  const priceRegex = /(?:₪\s*)?(\d+\.\d{2})\s*$/;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const match = line.match(priceRegex);
    
    if (match) {
      const priceVal = parseFloat(match[1]);
      let name = line.substring(0, match.index).trim();
      
      // Basic filtering for common total-like keywords in Hebrew/English
      const isTotalLine = /סה"כ|סך הכל|סהכ|total|סופי/i.test(name);
      
      if (name.length > 1 && !isTotalLine) {
        // Simple cleanup
        name = name.replace(/[0-9]/g, '').trim(); 
        if (name) {
          products.push({ name, price: priceVal });
        }
      } else if (isTotalLine) {
        total = priceVal;
      }
    }
  }

  // If total wasn't found attached to a keyword, assume the last found price is the total
  if (total === 0 && products.length > 0) {
    const lastProduct = products[products.length - 1];
    if (/total|סה"כ|סך הכל/i.test(lastProduct.name)) {
        total = lastProduct.price;
        products.pop(); // Remove it from products list
    }
  }
  
  console.log(`[Parser] Store: ${storeName}, Total: ${total}, Products Found: ${products.length}`);
  return { store_name: storeName, products, total };
}

module.exports = { extractData };
