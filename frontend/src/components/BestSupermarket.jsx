import React, { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import axios from 'axios';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

// ... existing nameMapping ...
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

const BestSupermarket = ({ products }) => {
  const { t } = useLanguage();
  const [nearbyStores, setNearbyStores] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [closestBestStoreId, setClosestBestStoreId] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "AIzaSyCEE5XrvFJOPq4ZtbxkEcHnCuNnVCMQprw"
  });

  // ... bestStore ...
  const bestStore = useMemo(() => {
    if (!products || products.length === 0) return null;

    // 1. Identify Unique Stores
    const allStores = new Set();
    products.forEach(p => p.entries.forEach(e => allStores.add(e.store)));
    const uniqueStores = Array.from(allStores);

    // 2. Find Common Products (Intersection)
    const commonProducts = products.filter(p => {
      const pStores = new Set(p.entries.map(e => e.store));
      return uniqueStores.every(s => pStores.has(s));
    });

    // 3. Basket Calculation (Preferred)
    if (commonProducts.length > 0 && uniqueStores.length > 1) {
       const basketTotals = {};
       uniqueStores.forEach(store => basketTotals[store] = 0);

       commonProducts.forEach(p => {
         p.entries.forEach(e => {
            if (basketTotals[e.store] !== undefined) {
               basketTotals[e.store] += e.price;
            }
         });
       });

       let minTotal = Infinity;
       let winner = null;
       Object.entries(basketTotals).forEach(([store, total]) => {
         if (total < minTotal) {
           minTotal = total;
           winner = store;
         }
       });

       // Calculate comparisons
       const comparisons = [];
       Object.entries(basketTotals).forEach(([store, total]) => {
         if (store !== winner) {
           comparisons.push({ name: store, total, diff: total - minTotal });
         }
       });
       comparisons.sort((a, b) => b.diff - a.diff);

       return winner ? { name: winner, total: minTotal, count: commonProducts.length, isBasket: true, comparisons } : null;
    }

    // 4. Fallback: Count of Cheapest Items
    const scores = {};

    products.forEach(item => {
      if (!item.entries || item.entries.length === 0) return;
      
      let minPrice = Infinity;
      item.entries.forEach(e => {
        if (e.price < minPrice) minPrice = e.price;
      });

      item.entries.forEach(e => {
        if (e.price === minPrice) {
          scores[e.store] = (scores[e.store] || 0) + 1;
        }
      });
    });

    let maxScore = -1;
    let winner = null;
    Object.entries(scores).forEach(([store, score]) => {
      if (score > maxScore) {
        maxScore = score;
        winner = store;
      }
    });

    return winner ? { name: winner, count: maxScore, isBasket: false } : null;
  }, [products]);

  const receiptStoreNames = useMemo(() => {
     if (!products) return [];
     const set = new Set();
     products.forEach(p => p.entries.forEach(e => {
        if(e.store) set.add(e.store);
     }));
     return Array.from(set);
  }, [products]);


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPosition([latitude, longitude]);

        try {
          // Fetch supermarkets within 10km (Overpass)
          const query = `
            [out:json][timeout:25];
            (
              node["shop"="supermarket"](around:10000,${latitude},${longitude});
              way["shop"="supermarket"](around:10000,${latitude},${longitude});
              relation["shop"="supermarket"](around:10000,${latitude},${longitude});
            );
            out center;
          `;
          const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
          
          const response = await axios.get(url);
          const elements = response.data.elements.map(el => ({
             id: el.id,
             lat: el.lat || el.center.lat,
             lng: el.lon || el.center.lon,
             name: el.tags.name || "Supermarket",
             nameEn: el.tags['name:en'],
             nameHe: el.tags['name:he']
          })).filter(el => el.lat && el.lng);

          const filteredElements = elements.filter(el => {
            const elNameLower = (el.name || "").toLowerCase();
            const elNameEnLower = (el.nameEn || "").toLowerCase();
            const elNameHeLower = (el.nameHe || "").toLowerCase();

            return receiptStoreNames.some(receiptName => {
              const receiptNameLower = receiptName.toLowerCase();
              const mappedReceiptName = nameMapping[receiptNameLower] ? nameMapping[receiptNameLower].toLowerCase() : null;

              return elNameLower.includes(receiptNameLower) || receiptNameLower.includes(elNameLower) ||
                     (elNameEnLower && (elNameEnLower.includes(receiptNameLower) || receiptNameLower.includes(elNameEnLower))) ||
                     (elNameHeLower && (elNameHeLower.includes(receiptNameLower) || receiptNameLower.includes(elNameHeLower))) ||
                     (mappedReceiptName && (elNameLower.includes(mappedReceiptName) || mappedReceiptName.includes(elNameLower)));
            });
          });
          
          setNearbyStores(filteredElements);

          // Find closest best store
          if (bestStore) {
             const bestNameLower = bestStore.name.toLowerCase();
             const bestNameHebrew = nameMapping[bestNameLower];
             
             const matches = elements.filter(el => {
                 const n = (el.name || "").toLowerCase();
                 const nEn = (el.nameEn || "").toLowerCase();
                 const nHe = (el.nameHe || "").toLowerCase();
                 
                 return n.includes(bestNameLower) || bestNameLower.includes(n) ||
                        nEn.includes(bestNameLower) || bestNameLower.includes(nEn) ||
                        (bestNameHebrew && (n.includes(bestNameHebrew) || nHe.includes(bestNameHebrew)));
             });
             
             if (matches.length > 0) {
                 const getDist = (lat1, lon1, lat2, lon2) => {
                    const R = 6371; 
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                              Math.sin(dLon/2) * Math.sin(dLon/2); 
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
                    return R * c; 
                 };

                 let closest = matches[0];
                 let minDist = Infinity;
                 
                 matches.forEach(m => {
                     const d = getDist(latitude, longitude, m.lat, m.lng);
                     if (d < minDist) {
                         minDist = d;
                         closest = m;
                     }
                 });
                 setClosestBestStoreId(closest.id);
             }
          }

        } catch (e) {
          console.error("Error finding stores", e);
        }
      });
    }
  }, [bestStore, receiptStoreNames]); // Re-run if bestStore or receiptStoreNames changes

  // ... (isStoreInReceipts logic) ...

  const visibleStores = useMemo(() => {
    if (!userPosition) return [];

    const getDist = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c; 
   };

    const storeGroups = {};
    nearbyStores.forEach(store => {
      const name = (store.name || "Supermarket").toLowerCase();
      const nameEn = (store.nameEn || "").toLowerCase();
      
      let groupName = name;
      for (const [key, val] of Object.entries(nameMapping)) {
        if (name.includes(key) || nameEn.includes(key) || name.includes(val)) {
          groupName = val; 
          break;
        }
      }

      if (!storeGroups[groupName]) {
        storeGroups[groupName] = [];
      }
      storeGroups[groupName].push(store);
    });

    const closestStores = [];
    for (const groupName in storeGroups) {
      let closest = null;
      let minDist = Infinity;
      storeGroups[groupName].forEach(store => {
        const d = getDist(userPosition[0], userPosition[1], store.lat, store.lng);
        if (d < minDist) {
          minDist = d;
          closest = store;
        }
      });
      if (closest) {
        closestStores.push(closest);
      }
    }
    
    return closestStores;
  }, [nearbyStores, userPosition]);

  const isBestStore = (market) => {
      return market.id === closestBestStoreId;
  };

  return (
    <div className="card shadow-sm mx-auto mb-3" style={{ maxWidth: '500px', width: '100%' }}>
      <div className="card-body">
         <h5 className="card-title text-dark fw-bold mb-3 text-center">
            <i className="bi bi-award-fill me-2 text-warning"></i>
            {t('bestSupermarket.title')}
         </h5>
         
         {bestStore ? (
           <div className="text-center py-3">
              <h2 className="display-6 fw-bold text-success mb-2">{bestStore.name}</h2>
              <p className="lead text-muted mb-0">{t('bestSupermarket.recommended')}</p>
              <hr className="my-3 w-50 mx-auto" />
              
              {bestStore.isBasket ? (
                 <>
                   <div className="fs-4 fw-bold text-dark mb-2">
                      ₪{bestStore.total.toFixed(2)}
                   </div>
                   
                   {bestStore.comparisons && bestStore.comparisons.length > 0 && (
                     <div className="mb-3">
                        {bestStore.comparisons.map((comp, idx) => (
                           <div key={idx} className="text-success small fw-medium">
                              <i className="bi bi-arrow-down-circle-fill me-1"></i>
                              {t('bestSupermarket.saveVs')
                                .replace('{amount}', comp.diff.toFixed(2))
                                .replace('{store}', comp.name)}
                           </div>
                        ))}
                     </div>
                   )}

                   <div className="small text-muted border-top pt-2">
                      {t('bestSupermarket.basketCount').replace('{count}', bestStore.count)}
                   </div>
                 </>
              ) : (
                 <div className="small text-muted mb-1">
                    {bestStore.count} {t('bestSupermarket.cheapestCount')}
                 </div>
              )}

              <div className="small text-muted fst-italic mt-1 mb-4">
                 {t('bestSupermarket.basedOn')}
              </div>

              {/* Google Map */}
              <div className="mx-auto border rounded overflow-hidden shadow-sm" style={{ height: '350px' }}>
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={userPosition ? { lat: userPosition[0], lng: userPosition[1] } : { lat: 32.0853, lng: 34.7818 }}
                    zoom={13}
                  >
                     {/* User Location */}
                     {userPosition && (
                        <Marker 
                           position={{ lat: userPosition[0], lng: userPosition[1] }}
                           icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                           title="You are here"
                        />
                     )}

                     {/* Stores */}
                     {visibleStores.map(store => {
                        const isBest = isBestStore(store);
                        return (
                           <React.Fragment key={store.id}>
                               <Marker
                                  position={{ lat: store.lat, lng: store.lng }}
                                  icon={{
                                    path: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
                                    fillColor: isBest ? "green" : "blue",
                                    fillOpacity: 1,
                                    strokeColor: "white",
                                    strokeWeight: 1,
                                    scale: 1.2,
                                    anchor: { x: 12, y: 12 }
                                  }}
                                  zIndex={isBest ? 1000 : 1}
                               />
                               <InfoWindow
                                  position={{ lat: store.lat, lng: store.lng }}
                                  options={{ disableAutoPan: true, closeBoxURL: "", enableEventPropagation: true }}
                               >
                                  <div style={{
                                      fontSize: isBest ? '14px' : '10px',
                                      fontWeight: isBest ? 'bold' : 'normal',
                                      color: isBest ? '#006400' : '#333',
                                      padding: isBest ? '2px' : '0px',
                                      textAlign: 'center',
                                      maxWidth: '100px'
                                  }}>
                                      {store.name}
                                      {isBest && <div style={{fontSize: '10px', color: 'green'}}>Best Price!</div>}
                                  </div>
                               </InfoWindow>
                           </React.Fragment>
                        );
                     })}
                  </GoogleMap>
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 bg-light">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading Map...</span>
                    </div>
                  </div>
                )}
              </div>
           </div>
         ) : (
           <div className="text-center py-3 text-muted">
             {t('bestSupermarket.noData')}
           </div>
         )}
      </div>
    </div>
  );
};

export default BestSupermarket;