const cv = require('opencv-wasm');
const Jimp = require('jimp');

// Helper: Order points for perspective transform
// [top-left, top-right, bottom-right, bottom-left]
function orderPoints(pts) {
  // pts is a Mat of size 4x2 (or vector of points)
  // We need to extract them into a JS array of {x, y}
  const points = [];
  for (let i = 0; i < 4; i++) {
    points.push({ x: pts.floatAt(i, 0), y: pts.floatAt(i, 1) });
  }

  const sorted = new Array(4);

  // Sort by sum (TL is smallest, BR is largest)
  const sums = points.map(p => p.x + p.y);
  // Argmin
  let minSumIndex = sums.indexOf(Math.min(...sums));
  let maxSumIndex = sums.indexOf(Math.max(...sums));
  
  sorted[0] = points[minSumIndex];
  sorted[2] = points[maxSumIndex];

  // Sort by diff (TR is smallest diff, BL is largest diff)
  const diffs = points.map(p => p.y - p.x);
  // We need to exclude the indices we already picked? 
  // A safer way is typical python logic:
  // But let's stick to the standard logic:
  // TL: min(x+y), BR: max(x+y)
  // TR: min(y-x) ?? No, usually diff is y-x or x-y. 
  // Let's implement robustly.
  
  // Re-sort purely based on standard logic:
  points.sort((a, b) => a.x - b.x); // Sort by x
  
  // Left-most two are TL and BL
  const left = points.slice(0, 2).sort((a, b) => a.y - b.y); // Top to bottom
  const tl = left[0];
  const bl = left[1];
  
  // Right-most two are TR and BR
  const right = points.slice(2, 4).sort((a, b) => a.y - b.y);
  const tr = right[0];
  const br = right[1];
  
  return [tl, tr, br, bl];
}

async function scanImage(inputPath, outputPath) {
  try {
    // 1. Load image with Jimp
    const image = await Jimp.read(inputPath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // Convert Jimp image to OpenCV Mat
    // Jimp stores data in RGBA buffer
    const src = cv.matFromImageData(image.bitmap);
    
    // 2. Resize for faster processing (maintain aspect ratio)
    // We'll process on a smaller version but warp the ORIGINAL
    const ratio = height / 800.0;
    const newHeight = 800;
    const newWidth = Math.floor(width / ratio);
    
    let processed = new cv.Mat();
    cv.resize(src, processed, new cv.Size(newWidth, newHeight));

    // 3. Pre-processing: Grayscale -> Blur -> Canny
    cv.cvtColor(processed, processed, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(processed, processed, new cv.Size(5, 5), 0);
    cv.Canny(processed, processed, 50, 150);

    // 4. Find Contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(processed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // 5. Find the receipt contour
    let screenCnt = null;
    let maxArea = 0;

    // Iterate through contours to find the largest 4-sided polygon
    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);
      
      // Filter small noise
      if (area < 1000) continue;

      let peri = cv.arcLength(cnt, true);
      let approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        if (area > maxArea) {
          maxArea = area;
          if (screenCnt) screenCnt.delete();
          screenCnt = approx.clone(); // Clone to save it
        }
      }
      approx.delete();
    }

    // Cleanup processing mats
    processed.delete();
    contours.delete();
    hierarchy.delete();

    if (!screenCnt) {
      console.log("[Scanner] No document found. Using original.");
      // Just copy original to output if we want consistency, or just return false
      // For consistency, we save the original as the "processed" one
      await image.writeAsync(outputPath);
      src.delete();
      return false; 
    }

    // 6. Perspective Transform
    // We found the 4 points on the resized image.
    // Scale them back up to the original image.
    
    // Extract points from the Mat 'screenCnt' (4x1x2 usually for approxPolyDP output)
    // approxPolyDP output is CV_32S usually (integers)
    const pts = [];
    for (let i = 0; i < 4; i++) {
        // approxPolyDP result is (rows=4, cols=1, type=CV_32SC2)
        // data32S accesses the integer data
        // Stride is 2 integers (x, y) per row
        const x = screenCnt.data32S[i * 2];
        const y = screenCnt.data32S[i * 2 + 1];
        pts.push({ x: x * ratio, y: y * ratio });
    }
    screenCnt.delete();

    // Order points: TL, TR, BR, BL
    // Simple sort for now as previously defined logic
    // Sort by X first
    pts.sort((a,b) => a.x - b.x);
    // Lefts
    let lefts = pts.slice(0, 2).sort((a,b) => a.y - b.y);
    let tl = lefts[0];
    let bl = lefts[1];
    // Rights
    let rights = pts.slice(2, 4).sort((a,b) => a.y - b.y);
    let tr = rights[0];
    let br = rights[1];

    // Compute width & height of new image
    const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
    const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
    const maxWidth = Math.max(Math.floor(widthA), Math.floor(widthB));

    const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
    const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
    const maxHeight = Math.max(Math.floor(heightA), Math.floor(heightB));

    // Construct source points and destination points
    // Source points need to be in a Mat for getPerspectiveTransform
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x, tl.y, 
        tr.x, tr.y, 
        br.x, br.y, 
        bl.x, bl.y
    ]);
    
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, 
        maxWidth - 1, 0, 
        maxWidth - 1, maxHeight - 1, 
        0, maxHeight - 1
    ]);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    let dst = new cv.Mat();
    
    // Warp!
    cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    // 7. Save Output
    // Convert Mat back to Jimp compatible buffer
    // OpenCV.js (Wasm) 'dst' is RGBA or BGR? 
    // Jimp usually wants RGBA. src was RGBA. warpPerspective keeps type.
    const newData = new Jimp({ width: maxWidth, height: maxHeight, data: Buffer.from(dst.data) });
    
    // Wait, dst.data is a Uint8Array. Jimp constructor with data expects a bitmap or buffer.
    // Easier way: create blank Jimp, loop pixels? Slow.
    // Jimp accepts a buffer in constructor but requires specific format.
    // Let's manually reconstruct the Jimp object to be safe.
    
    // Ideally: new Jimp(width, height, (err, image) => { image.bitmap.data = dst.data ... })
    const outImage = new Jimp(maxWidth, maxHeight);
    outImage.bitmap.data = Buffer.from(dst.data); // Copy data
    
    await outImage.writeAsync(outputPath);

    // Cleanup
    src.delete();
    dst.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();

    console.log(`[Scanner] Processed image saved to ${outputPath}`);
    return true;

  } catch (err) {
    console.error("[Scanner Error]", err);
    // Ensure cleanup if possible?
    return false;
  }
}

module.exports = { scanImage };
