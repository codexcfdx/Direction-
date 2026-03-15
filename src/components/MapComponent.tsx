import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, AttributionControl, CircleMarker, ZoomControl, LayersControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location, RouteResult } from '../services/routing';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  start: Location | null;
  end: Location | null;
  waypoints?: (Location | null)[];
  route: RouteResult | null;
  activeStep?: number | null;
  searchedLocation?: Location | null;
  simulationPosition?: [number, number] | null;
  isSimulating?: boolean;
  is3DMode?: boolean;
  userLocation?: [number, number] | null;
  centerOnUser?: boolean;
}

const simulationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapUpdater({ start, end, waypoints, route, activeStep, searchedLocation, simulationPosition, isSimulating, is3DMode, userLocation, centerOnUser }: MapComponentProps) {
  const map = useMap();
  const isSimulatingRef = useRef(false);

  useEffect(() => {
    if (is3DMode !== undefined) {
      setTimeout(() => {
        map.invalidateSize();
      }, 1000); // Wait for CSS transition
    }
  }, [is3DMode, map]);

  useEffect(() => {
    if (centerOnUser && userLocation) {
      map.setView(userLocation, 16, { animate: true });
    }
  }, [centerOnUser, userLocation, map]);

  useEffect(() => {
    if (simulationPosition) {
      const isJustStarting = !isSimulatingRef.current;
      isSimulatingRef.current = true;
      const targetZoom = isJustStarting ? Math.max(map.getZoom(), 17) : map.getZoom();
      map.setView(simulationPosition, targetZoom, { animate: false });
    } else if (searchedLocation) {
      map.setView([searchedLocation.lat, searchedLocation.lon], 14, { animate: true });
    } else if (activeStep !== undefined && activeStep !== null && route && route.steps[activeStep]) {
      if (!isSimulatingRef.current) {
        const loc = route.steps[activeStep].location;
        map.setView(loc, 16, { animate: true });
      }
    } else if (route && route.geometry.length > 0) {
      isSimulatingRef.current = false;
      const bounds = L.latLngBounds(route.geometry);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (start && end) {
      isSimulatingRef.current = false;
      const validWaypoints = waypoints?.filter((wp): wp is Location => wp !== null) || [];
      const bounds = L.latLngBounds([
        [start.lat, start.lon],
        ...validWaypoints.map(wp => [wp.lat, wp.lon] as [number, number]),
        [end.lat, end.lon],
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (start) {
      isSimulatingRef.current = false;
      map.setView([start.lat, start.lon], 13);
    } else if (end) {
      isSimulatingRef.current = false;
      map.setView([end.lat, end.lon], 13);
    }
  }, [start, end, route, activeStep, searchedLocation, simulationPosition, map]);

  return null;
}

export function MapComponent({ start, end, waypoints, route, activeStep, searchedLocation, simulationPosition, isSimulating, is3DMode, userLocation, centerOnUser }: MapComponentProps) {
  const defaultCenter: [number, number] = [39.8283, -98.5795]; // Center of US

  return (
    <div className={`w-full h-full overflow-hidden relative ${is3DMode ? 'map-3d-mode' : ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
      <ZoomControl position="bottomright" />
      
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="Standard Map">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Hybrid (Satellite + Roads)">
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Terrain (Elevation + Roads)">
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Real-time Traffic">
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      
      {start && (
        <Marker position={[start.lat, start.lon]}>
          <Popup>Start: {start.display_name}</Popup>
        </Marker>
      )}
      
      {end && (
        <Marker position={[end.lat, end.lon]}>
          <Popup>End: {end.display_name}</Popup>
        </Marker>
      )}

      {waypoints?.filter((wp): wp is Location => wp !== null).map((wp, idx) => (
        <Marker key={`wp-${idx}`} position={[wp.lat, wp.lon]}>
          <Popup>Stop {idx + 1}: {wp.display_name}</Popup>
        </Marker>
      ))}

      {route && (
        <Polyline
          positions={route.geometry}
          color="#4f46e5"
          weight={5}
          opacity={0.7}
        />
      )}

      {route && route.steps.map((step, idx) => (
        <CircleMarker
          key={idx}
          center={step.location}
          radius={activeStep === idx ? 8 : 5}
          pathOptions={{
            color: activeStep === idx ? '#ef4444' : '#4f46e5',
            fillColor: activeStep === idx ? '#ef4444' : '#ffffff',
            fillOpacity: 1,
            weight: 2
          }}
        >
          <Popup>{step.instruction}</Popup>
        </CircleMarker>
      ))}

      {searchedLocation && (
        <Marker position={[searchedLocation.lat, searchedLocation.lon]}>
          <Popup>{searchedLocation.display_name}</Popup>
        </Marker>
      )}

      {simulationPosition && (
        <Marker position={simulationPosition} icon={simulationIcon} zIndexOffset={1000}>
          <Tooltip permanent direction="top" offset={[0, -40]} className="font-semibold text-indigo-900 bg-white/90 backdrop-blur-sm border-0 shadow-md px-3 py-2 rounded-lg">
            {activeStep !== undefined && activeStep !== null && route && route.steps[activeStep] 
              ? route.steps[activeStep].instruction 
              : "Starting Journey..."}
          </Tooltip>
        </Marker>
      )}

      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={8}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            weight: 3
          }}
          zIndexOffset={2000}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      <MapUpdater 
        start={start} 
        end={end} 
        waypoints={waypoints} 
        route={route} 
        activeStep={activeStep} 
        searchedLocation={searchedLocation} 
        simulationPosition={simulationPosition} 
        isSimulating={isSimulating} 
        is3DMode={is3DMode} 
        userLocation={userLocation}
        centerOnUser={centerOnUser}
      />
    </MapContainer>
    </div>
  );
}
