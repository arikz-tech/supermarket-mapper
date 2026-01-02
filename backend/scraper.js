const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scraper Logic
 * 
 * To add a new store:
 * 1. Create a parser object in the `parsers` array.
 * 2. `canParse(url)`: Returns true if this parser should handle the URL.
 * 3. `parse($, url)`: Extracts { store_name, date_time, products: [{name, price}], total }.
 */

const parsers = [
  {
    name: 'Weezmo (Dabah, etc.)',
    canParse: (url) => url.includes('weezmo.com'),
    parse: async ($, url) => {
      try {
        const urlObj = new URL(url);
        const q = urlObj.searchParams.get('q');
        
        if (!q) throw new Error('Missing q parameter in Weezmo URL');

        const apiUrl = `https://receipts.weezmo.com/api/receipts/${q}`;
        console.log(`[Scraper] Fetching Weezmo API: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': url
          }
        });

        const rawData = Array.isArray(response.data) ? response.data[0] : response.data;
        if (!rawData) throw new Error('No data received from Weezmo API');

        const storeName = (rawData.tBusiness?.businessName || 'Unknown Store') + ' ' + (rawData.tBranch?.branchName || '');
        
        const products = (rawData.items || [])
          .filter(item => item.price > 0 && !/קיזוז|offset/i.test(item.name)) // Filter out discounts and tare weights for clean list
          .map(item => ({
            name: item.name,
            price: item.price
          }));

        return {
          store_name: storeName.trim(),
          date_time: rawData.createdDate || rawData.uploadedDate,
          total: rawData.total,
          products: products
        };

      } catch (err) {
        console.error('[Weezmo Parser] Error:', err.message);
        throw err;
      }
    }
  },
  {
    name: 'Pairzon (Rami Levy, etc.)',
    canParse: (url) => url.includes('pairzon.com'),
    parse: async ($, url) => { // Note: We ignore $ here as we fetch API directly
      try {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('id');
        const p = urlObj.searchParams.get('p');
        
        if (!id || !p) throw new Error('Missing id or p parameter in Pairzon URL');

        const apiUrl = `https://${urlObj.hostname}/v1.0/documents/${id}?p=${p}`;
        console.log(`[Scraper] Fetching Pairzon API: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': url
          }
        });

        const data = response.data;
        const store_name = (data.store?.business?.name || 'Unknown') + ' ' + (data.store?.name || '');
        
        // Map items
        const products = (data.items || []).map(item => {
          // Calculate final price for the line item including discounts if easily available
          // For now, we use the 'total' field which usually represents the line total.
          // Note: Pairzon 'total' in items[] is often Quantity * UnitPrice. 
          // Discounts are in additionalInfo or separate. 
          // For simplicity in this version, we take the gross line total. 
          return {
            name: item.name,
            price: item.total
          };
        });

        return {
          store_name: store_name.trim(),
          date_time: data.createdDate,
          total: data.total, // The final total from the receipt root
          products: products
        };

      } catch (err) {
        console.error('[Pairzon Parser] Error:', err.message);
        throw err;
      }
    }
  }
];

const defaultParser = {
  name: 'Generic Fallback',
  parse: async ($, url) => { // Changed to async to match signature
    // ... existing generic logic (synchronous part wrapped) ...
    return new Promise(resolve => {
        // Attempt to guess store name from Title or Domain
        let store_name = $('title').text().trim() || new URL(url).hostname;
        
        const products = [];
        const priceRegex = /[₪$€]\s*(\d+(\.\d{2})?)|(\d+(\.\d{2})?)\s*[₪$€]/;
        
        $('tr, li, div.row, div.item').each((i, el) => {
           const text = $(el).text().replace(/\s+/g, ' ').trim();
           if (!text) return;
           
           const match = text.match(/([^\d]+)\s+(\d+\.\d{2})/); 
           if (match) {
             const name = match[1].trim();
             const price = parseFloat(match[2]);
             
             if (name.length < 50 && name.length > 2 && !/total|sum|tax|vat/i.test(name)) {
                products.push({ name, price });
             }
           }
        });
    
        const total = products.reduce((acc, p) => acc + p.price, 0);
        resolve({ store_name, products, total });
    });
  }
};

async function scrapeReceipt(url) {
  try {
    console.log(`[Scraper] Processing URL: ${url}`);
    
    // Check for specific parsers first that might skip the HTML fetch
    const specialParser = parsers.find(p => p.canParse(url));
    if (specialParser) {
        console.log(`[Scraper] Using specialized parser: ${specialParser.name}`);
        // Pass null for $ as these parsers likely fetch their own data
        return await specialParser.parse(null, url);
    }

    // Fallback to generic HTML scraping
    console.log(`[Scraper] Fetching HTML for generic parser...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const data = await defaultParser.parse($, url);
    
    // Ensure defaults
    if (!data.date_time) data.date_time = new Date().toISOString();
    
    console.log(`[Scraper] Extracted ${data.products.length} products from ${data.store_name}`);
    return data;

  } catch (error) {
    console.error(`[Scraper] Error scraping ${url}:`, error.message);
    throw new Error(`Failed to scrape URL: ${error.message}`);
  }
}

module.exports = { scrapeReceipt };
