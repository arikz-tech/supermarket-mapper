const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const uploadsDir = path.join(__dirname, 'uploads'); // Define uploads directory

async function extractData(imagePath) {
  const fileExtension = path.extname(imagePath).toLowerCase();
  let ocrImagePath = imagePath;
  let tempPngCreated = false;

  try {
    if (fileExtension === '.pdf') {
      const tempFileName = `temp_page_1_${Date.now()}.png`;
      const tempImagePath = path.join(uploadsDir, tempFileName);
      
      // Ghostscript command to convert PDF to PNG
      // -dNOPAUSE -dBATCH: Standard flags for non-interactive Ghostscript
      // -sDEVICE=png16m: Output device for 24-bit PNG
      // -r300: Resolution (300 DPI)
      // -dFirstPage=1 -dLastPage=1: Process only the first page
      // -sOutputFile: Output file path (Ghostscript adds %01d for page number, but we only have one)
      const gsCommand = `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 -dFirstPage=1 -dLastPage=1 -sOutputFile=${tempImagePath} ${imagePath}`;
      
      console.log(`[OCR] Converting PDF to PNG with Ghostscript: ${gsCommand}`);

      await new Promise((resolve, reject) => {
        exec(gsCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`[OCR] Ghostscript PDF conversion error: ${error.message}`);
            console.error(`[OCR] Ghostscript stderr: ${stderr}`);
            return reject(new Error(`PDF conversion failed. Is Ghostscript installed and in PATH? Error: ${stderr || error.message}`));
          }
          console.log(`[OCR] Ghostscript stdout: ${stdout}`);
          console.log(`[OCR] PDF converted to ${tempImagePath}`);
          resolve();
        });
      });

      ocrImagePath = tempImagePath;
      tempPngCreated = true;
    }

    const { data: { text } } = await Tesseract.recognize(ocrImagePath, 'heb', {
      logger: m => console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`)
    });
    return parseReceiptText(text);

  } catch (error) {
    console.error("OCR Error:", error);
    // Differentiate error messages for better client feedback
    if (error.message.includes("PDF conversion failed")) {
      throw error; // Re-throw specific PDF conversion error
    }
    throw new Error("Failed to process the receipt. Please ensure it's a clear, valid image or PDF.");
  } finally {
    // Clean up temporary PNG file if it was created
    if (tempPngCreated && fs.existsSync(ocrImagePath)) {
      try {
        fs.unlinkSync(ocrImagePath);
        console.log(`[OCR] Cleaned up temporary file: ${ocrImagePath}`);
      } catch (cleanupError) {
        console.error(`[OCR] Error cleaning up temporary PNG: ${cleanupError.message}`);
      }
    }
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
    if (!line || line.includes("קיזוז משקל אריזה")) continue;

    const match = line.match(priceRegex);
    if (match) {
      const priceVal = parseFloat(match[1]);
      let name = line.substring(0, match.index).trim();
      
      // Filter out noise
      if (name.length > 2 && !name.toUpperCase().includes("TOTAL")) {
        name = name.replace(/[0-9]/g, '').trim();
        products.push({ name, price: priceVal });
      } else if (name.toUpperCase().includes("TOTAL")) {
        total = priceVal;
      }
    }
  }

  // If total is still 0, try a more generic "Total" keyword search
  if (total === 0) {
    const totalRegex = /Total\s*(\d+\.\d{2})/i;
    for (let line of lines) {
      const match = line.match(totalRegex);
      if (match) {
        total = parseFloat(match[1]);
        break; // Stop after finding the first total
      }
    }
  }

  return { store_name: storeName, products, total };
}

module.exports = { extractData };