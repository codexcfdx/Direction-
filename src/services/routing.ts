export interface Location {
  lat: number;
  lon: number;
  display_name: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  location: [number, number];
}

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: [number, number][]; // [lat, lon] for Leaflet
  steps: RouteStep[];
}

function formatLocationName(item: any): string {
  if (!item.address) {
    const parts = (item.display_name || '').split(', ');
    if (parts.length > 3) {
      return `${parts[0]}, ${parts[1]}, ${parts[parts.length - 1]}`;
    }
    return item.display_name;
  }
  
  const addr = item.address;
  const parts = [];
  
  const specific = item.name || 
    (addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road) || 
    addr.pedestrian || addr.suburb || addr.neighbourhood;
  if (specific) parts.push(specific);
  
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district;
  if (city && city !== specific) parts.push(city);
  
  const state = addr.state || addr.region || addr.county;
  if (state && state !== city && state !== specific) parts.push(state);
  
  const country = addr.country;
  if (country && country !== state) parts.push(country);
  
  return parts.length > 0 ? parts.join(', ') : item.display_name;
}

export async function geocode(query: string): Promise<Location[]> {
  if (!query) return [];
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=8&addressdetails=1`
    );
    if (!response.ok) throw new Error('Failed to geocode');
    const data = await response.json();
    
    const seen = new Set<string>();
    const results: Location[] = [];
    
    for (const item of data) {
      const cleanName = formatLocationName(item);
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        results.push({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          display_name: cleanName,
        });
      }
      if (results.length >= 5) break;
    }
    
    return results;
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<Location | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
    );
    if (!response.ok) throw new Error('Failed to reverse geocode');
    const data = await response.json();
    return {
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      display_name: formatLocationName(data),
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export async function getRoute(
  start: Location,
  end: Location,
  waypoints: Location[] = []
): Promise<RouteResult | null> {
  try {
    const coordinates = [start, ...waypoints, end]
      .map((loc) => `${loc.lon},${loc.lat}`)
      .join(';');

    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`
    );
    if (!response.ok) throw new Error('Failed to get route');
    const data = await response.json();

    if (data.code !== 'Ok' || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    
    // OSRM returns GeoJSON coordinates as [lon, lat], Leaflet expects [lat, lon]
    const geometry = route.geometry.coordinates.map((coord: [number, number]) => [
      coord[1],
      coord[0],
    ]);

    const steps: RouteStep[] = route.legs.flatMap((leg: any) => 
      leg.steps.map((step: any) => {
        const maneuver = step.maneuver;
        let instruction = maneuver.type;
        if (maneuver.modifier) {
          instruction += ` ${maneuver.modifier}`;
        }
        if (step.name) {
          instruction += ` onto ${step.name}`;
        }
        
        // Capitalize first letter
        instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1);

        return {
          instruction,
          distance: step.distance,
          duration: step.duration,
          location: [maneuver.location[1], maneuver.location[0]],
        };
      })
    );

    return {
      distance: route.distance,
      duration: route.duration,
      geometry,
      steps,
    };
  } catch (error) {
    console.error('Routing error:', error);
    return null;
  }
}
