import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper to recenter map
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

const SupermarketMap = ({ products }) => {
  const { t } = useLanguage();
  const [position, setPosition] = useState([32.0853, 34.7818]); // Default Tel Aviv
  const [nearbySupermarkets, setNearbySupermarkets] = useState([]);

  const fetchSupermarkets = async (lat, lng) => {
    try {
      // Query for nodes, ways, and relations tagged as shop=supermarket within 5km (5000m)
      const query = `
        [out:json][timeout:25];
        (
          node["shop"="supermarket"](around:5000,${lat},${lng});
          way["shop"="supermarket"](around:5000,${lat},${lng});
          relation["shop"="supermarket"](around:5000,${lat},${lng});
        );
        out center;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      
      const response = await axios.get(url);
      const elements = response.data.elements;
      
      const realSupermarkets = elements.map(el => ({
        id: el.id,
        name: el.tags.name || "Supermarket",
        nameEn: el.tags['name:en'],
        nameHe: el.tags['name:he'],
        lat: el.lat || el.center.lat,
        lng: el.lon || el.center.lon
      })).filter(el => el.lat && el.lng); // Ensure valid coords

      setNearbySupermarkets(realSupermarkets);
    } catch (error) {
      console.error("Error fetching real supermarkets:", error);
      // Fallback to empty or toast, for now just log
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const userPos = [latitude, longitude];
          setPosition(userPos);
          
          fetchSupermarkets(latitude, longitude);
        },
        (err) => {
          console.error("Error getting location", err);
          // Fallback to default mock data if location fails
           setNearbySupermarkets([
            { id: 1, name: "Super Yuda", nameEn: "Super Yuda", lat: 32.0853, lng: 34.7818 },
            { id: 2, name: "Shufersal Deal", nameEn: "Shufersal", lat: 32.0900, lng: 34.7850 },
            { id: 3, name: "AM:PM", nameEn: "AM:PM", lat: 32.0800, lng: 34.7750 },
            { id: 4, name: "Rami Levy", nameEn: "Rami Levy", lat: 32.0750, lng: 34.7900 },
            { id: 5, name: "Osher Ad", nameEn: "Osher Ad", lat: 32.1000, lng: 34.8000 },
          ]);
        }
      );
    }
  }, []);

  const getReceiptStoreNames = () => {
    if (!products || products.length === 0) return [];
    const names = new Set();
    products.forEach(p => {
      p.entries.forEach(e => {
        if (e.store) names.add(e.store);
      });
    });
    return Array.from(names);
  };

  const receiptStoreNames = getReceiptStoreNames();

  const nameMapping = {
    "rami levy": "רמי לוי",
    "shufersal": "שופרסל",
    "super yuda": "סופר יודה",
    "am:pm": "am:pm",
    "osher ad": "אושר עד",
    "mega": "מגה",
    "yohan": "יוחננוף",
    "yochananof": "יוחננוף",
    "victory": "ויקטורי",
    "tiv taam": "טיב טעם",
    "half free": "חצי חינם",
    "hatzi hinam": "חצי חינם"
  };

  const visibleSupermarkets = nearbySupermarkets.filter(market => {
    if (receiptStoreNames.length === 0) return true;

    // Check against all available names (name, name:en, name:he)
    const marketNames = [market.name, market.nameEn, market.nameHe]
        .filter(Boolean)
        .map(n => n.toLowerCase());

    return receiptStoreNames.some(receiptName => {
      const lowerReceiptName = receiptName.toLowerCase();
      const hebrewName = nameMapping[lowerReceiptName];

      return marketNames.some(mName => 
        mName.includes(lowerReceiptName) || 
        lowerReceiptName.includes(mName) ||
        (hebrewName && mName.includes(hebrewName))
      );
    });
  });

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <h5 className="mb-0">{t('mapTitle')}</h5>
      </div>
      <div className="card-body p-0">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '400px', width: '100%', borderRadius: '0' }}
        >
          <ChangeView center={position} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {/* User Location Marker */}
          <Marker position={position}>
            <Popup>You are here</Popup>
          </Marker>

          {visibleSupermarkets.map(store => (
            <Marker key={store.id} position={[store.lat, store.lng]}>
              <Popup>
                <strong>{store.name}</strong><br />
                Open until 23:00
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="card-footer bg-white small text-muted">
        <strong>Receptions Supermarkets:</strong> {receiptStoreNames.length > 0 ? receiptStoreNames.join(", ") : "All nearby supermarkets"}
      </div>
    </div>
  );
};

export default SupermarketMap;
