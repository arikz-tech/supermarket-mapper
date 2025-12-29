const Tesseract = require('tesseract.js');
const fs = require('fs');

async function extractData(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`)
    });
    return parseReceiptText(text);
  } catch (error) {
    console.error("OCR Error:", error);
    return { store_name: "Unknown", products: [], total: 0 };
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

  const priceRegex = /(\d+\.\d{2})\s*$/; // Looks for price at end of line

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const match = line.match(priceRegex);
    if (match) {
      const priceVal = parseFloat(match[1]);
      let name = line.substring(0, match.index).trim();
      
      // Filter out noise
      if (name.length > 2 && !name.toUpperCase().includes("TOTAL")) {
        products.push({ name, price: priceVal });
      } else if (name.toUpperCase().includes("TOTAL")) {
        total = priceVal;
      }
    }
  }

  return { store_name: storeName, products, total };
}

module.exports = { extractData };
