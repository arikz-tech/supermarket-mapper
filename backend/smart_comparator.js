const stringSimilarity = require('string-similarity');

// Noise words to remove (Hebrew and English)
// These words add little value to the core identity of the product
const NOISE_WORDS = [
    // Hebrew
    'מבצע', 'מארז', 'טרי', 'משקל', 'קפוא', 'ארוז', 'יחידה', 'ק"ג', 'גרם', 
    'חדש', 'זוג', 'רביעייה', 'שישייה', 'במבצע', 'חיסכון', 'ליטר', 'מל',
    // English
    'sale', 'pack', 'fresh', 'weight', 'frozen', 'packed', 'unit', 'kg', 'gram', 
    'new', 'pair', 'liter', 'ml', 'pcs', 'discount'
];

// Regex for cleaning (allow Hebrew, English, numbers, spaces)
const SPECIAL_CHARS = /[^a-zA-Z0-9\u0590-\u05FF\s%]/g;
const MULTI_SPACE = /\s+/g;

/**
 * Normalizes product text for better comparison.
 * 1. Lowercase
 * 2. Remove special chars
 * 3. Remove noise words
 * 4. Sort words alphabetically (handles "Milk Tnuva" vs "Tnuva Milk")
 */
function normalizeProductText(text) {
    if (!text) return '';
    
    let normalized = text.toLowerCase();
    
    // Remove special chars but keep % for fat content (Milk 3%)
    normalized = normalized.replace(SPECIAL_CHARS, ' ');
    
    // Split into words
    let words = normalized.split(MULTI_SPACE).filter(w => w.trim().length > 0);
    
    // Filter out noise words and very short words (optional)
    words = words.filter(w => !NOISE_WORDS.includes(w) && w.length > 1);
    
    // Sort words to handle reordering
    words.sort();
    
    return words.join(' ');
}

/**
 * Groups raw product rows into clusters based on similarity.
 * @param {Array} rows - Array of objects { name, price, store_name, date_time }
 * @param {number} threshold - Similarity threshold (0 to 1), default 0.65 (slightly looser for better grouping)
 */
function clusterProducts(rows, threshold = 0.65) {
    const clusters = []; // Array of { masterName: string, entries: [] } 

    for (const row of rows) {
        const normName = normalizeProductText(row.name);
        
        // Skip empty names (or parsed garbage)
        if (!normName || normName.length < 2) continue;

        let bestMatch = null;
        let bestScore = 0;

        // Try to find a matching cluster
        for (const cluster of clusters) {
            // We compare against the cluster's "Master Normalized Name"
            // (The normalized name of the first item in the cluster is usually sufficient)
            const clusterMasterNorm = normalizeProductText(cluster.masterName);
            
            // Compare!
            const score = stringSimilarity.compareTwoStrings(normName, clusterMasterNorm);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = cluster;
            }
        }

        if (bestMatch && bestScore >= threshold) {
            // Add to existing cluster
            bestMatch.entries.push(row);
            
            // Optional: Update master name to the shortest/cleanest one in the group
            // This helps the UI look better (e.g. "Milk" instead of "Milk 3% Fresh Sale")
            if (row.name.length < bestMatch.masterName.length) {
                bestMatch.masterName = row.name;
            }
        } else {
            // Create new cluster
            clusters.push({
                masterName: row.name, // Display name (starts with the first one found)
                entries: [row]
            });
        }
    }

    // Format for Frontend: { name: "Master Name", entries: [...] }
    return clusters.map(c => ({
        name: c.masterName,
        entries: c.entries.map(e => ({
            store: e.store_name,
            price: e.price,
            date: e.date_time
        }))
    }));
}

module.exports = {
    normalizeProductText,
    clusterProducts
};
