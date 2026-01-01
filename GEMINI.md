# Supermarket Receptions Mapper - Project Context

## Project Overview
A full-stack web application designed to help users track their supermarket expenses and compare prices between different stores. Users can upload receipts (via image file or camera capture), which are processed using OCR to extract product and price information. The app then analyzes this data to find common products, compare prices, and recommend the most cost-effective supermarket in the user's vicinity.

## Technology Stack

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** PostgreSQL (`pg` library)
*   **OCR:** Google Cloud Vision API (`@google-cloud/vision`)
*   **File Handling:** Multer (image uploads)
*   **Deployment:** Configured for Vercel (API rewrites via `vercel.json`)

### Frontend
*   **Framework:** React (Vite)
*   **Styling:** Bootstrap 5, Custom CSS (`theme.css`)
*   **Routing:** React Router
*   **HTTP Client:** Axios
*   **Maps:** Google Maps API (`@react-google-maps/api`)
*   **Geospatial Data:** Overpass API (to find nearby supermarkets)
*   **Localization:** Custom Context API (`LanguageContext`) supporting English and Hebrew.

## Project Structure

### Root Directory
*   `GEMINI.md`: Context file for the AI assistant.
*   `vercel.json`: Configuration for Vercel deployment (rewrites for API and SPA).
*   `start_app.bat` / `start_dev.bat`: Scripts to run the application locally.

### Backend (`/backend`)
*   `server.js`: Main entry point. Handles API endpoints (`/api/upload`, `/api/receipts`, `/api/products`), static file serving for the frontend build, and error handling.
*   `database.js`: Manages the PostgreSQL connection pool and initializes the database schema (`receipts` and `products` tables).
*   `ocr.js`: Contains logic to interact with Google Cloud Vision and a custom parser (`parseReceiptText`) to extract store names and product lists.
    *   *Note:* The parser calculates the total price by summing extracted product prices.
*   `uploads/`: Directory for storing uploaded receipt images.

### Frontend (`/frontend`)
*   `src/main.jsx`: Application entry point.
*   `src/App.jsx`: Main layout and routing setup.
*   `src/context/LanguageContext.jsx`: Manages application-wide language state.
*   `src/components/`:
    *   `Upload.jsx`: Handles file selection and camera capture.
    *   `ReceiptManager.jsx`: Allows users to view, edit, and delete uploaded receipts.
    *   `ResultsTable.jsx`: Displays a comparison table of products found in multiple stores.
    *   `BestSupermarket.jsx`: Logic to determine the cheapest basket and display nearby stores on a map.
    *   `Sidebar.jsx`: Navigation menu.
    *   `Settings.jsx`: Application settings (language, danger zone).

## Key Features & Logic
1.  **Receipt Processing:**
    *   Images are uploaded to the server and passed to Google Vision.
    *   Text is parsed to identify the store name (first line) and products (lines ending with a price).
    *   **Total Calculation:** The total receipt price is calculated as the sum of all identified product prices.

2.  **Product Comparison:**
    *   The app identifies "Unique Stores" from the uploaded receipts.
    *   It filters for "Common Products" that appear in *all* identified stores to ensure a fair comparison.

3.  **Best Store Recommendation:**
    *   Calculates the total cost of the "Common Products" basket for each store.
    *   Identifies the store with the lowest basket total.
    *   Fetches nearby supermarkets using the Overpass API based on the user's geolocation.
    *   Matches receipt store names with real-world locations and displays them on a Google Map, highlighting the "Best Store".

4.  **Localization:**
    *   Full support for Hebrew (RTL) and English (LTR).

## Recent Updates
*   **OCR Logic:** Updated to calculate the total price based on the sum of products, removing reliance on explicit "Total" lines which can be unreliable.
*   **Deployment:** Added `vercel.json` to handle client-side routing (rewriting all non-API routes to `index.html`) and API path mapping.
*   **UI:** Improved the layout of the "Common Products" alert in `ResultsTable` for better readability.
*   **Security:** Added `google-credentials.json` to `.gitignore`.