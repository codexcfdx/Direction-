import React, { useState, useEffect, useRef } from 'react';
import { MapComponent } from './components/MapComponent';
import { LocationSearch } from './components/LocationSearch';
import { Location, RouteResult, getRoute, reverseGeocode } from './services/routing';
import { Navigation, MapPin, Search, ArrowRight, Clock, Route as RouteIcon, LocateFixed, Plus, X, Save, Bookmark, Trash2, Play, Square, Layers, Share2 } from 'lucide-react';

interface SavedRoute {
  id: string;
  name: string;
  start: Location;
  end: Location;
  waypoints: Location[];
  timestamp: number;
}

export default function App() {
  const [start, setStart] = useState<Location | null>(null);
  const [end, setEnd] = useState<Location | null>(null);
  const [waypoints, setWaypoints] = useState<(Location | null)[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<Location | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [centerOnUser, setCenterOnUser] = useState(false);
  const [simulationPosition, setSimulationPosition] = useState<[number, number] | null>(null);
  const simulationRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('savedRoutes');
    if (saved) {
      try {
        setSavedRoutes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved routes');
      }
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (err) => console.error("Error watching position:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleShareLocation = async () => {
    if (!userLocation) {
      alert("Current location not available yet. Please ensure location services are enabled.");
      return;
    }
    const url = `https://www.google.com/maps?q=${userLocation[0]},${userLocation[1]}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Current Location',
          text: 'Here is my current location:',
          url: url
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Location link copied to clipboard!");
    }
  };

  const handleCenterOnUser = () => {
    if (userLocation) {
      setCenterOnUser(true);
      setTimeout(() => setCenterOnUser(false), 500); // Reset trigger
    } else {
      alert("Current location not available yet.");
    }
  };

  const handleSaveRoute = () => {
    if (!start || !end) return;
    
    const defaultName = `${start.display_name.split(',')[0]} to ${end.display_name.split(',')[0]}`;
    const name = prompt('Enter a name for this route:', defaultName);
    if (!name) return;
    
    const newRoute: SavedRoute = {
      id: Date.now().toString(),
      name,
      start,
      end,
      waypoints: waypoints.filter((wp): wp is Location => wp !== null),
      timestamp: Date.now()
    };
    
    const updated = [newRoute, ...savedRoutes];
    setSavedRoutes(updated);
    localStorage.setItem('savedRoutes', JSON.stringify(updated));
  };

  const handleLoadRoute = (savedRoute: SavedRoute) => {
    setStart(savedRoute.start);
    setEnd(savedRoute.end);
    setWaypoints(savedRoute.waypoints);
    setRoute(null);
    setActiveStep(null);
    setShowSavedRoutes(false);
  };

  const handleDeleteRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedRoutes.filter(r => r.id !== id);
    setSavedRoutes(updated);
    localStorage.setItem('savedRoutes', JSON.stringify(updated));
  };

  const startSimulation = () => {
    if (!route || route.geometry.length === 0) return;
    setIsSimulating(true);
    setIs3DMode(true);
    setActiveStep(0);
    setSimulationPosition(route.geometry[0]);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setIs3DMode(false);
    setSimulationPosition(null);
    if (simulationRef.current) {
      cancelAnimationFrame(simulationRef.current);
      simulationRef.current = null;
    }
  };

  useEffect(() => {
    let startTime: number | null = null;
    const duration = 15000; // 15 seconds for the simulation

    if (isSimulating && route && route.geometry.length > 0) {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        const totalPoints = route.geometry.length;
        const floatIndex = progress * (totalPoints - 1);
        const index = Math.floor(floatIndex);
        const nextIndex = Math.min(index + 1, totalPoints - 1);
        const fraction = floatIndex - index;

        const p1 = route.geometry[index];
        const p2 = route.geometry[nextIndex];

        const lat = p1[0] + (p2[0] - p1[0]) * fraction;
        const lon = p1[1] + (p2[1] - p1[1]) * fraction;

        setSimulationPosition([lat, lon]);

        // Find active step
        setActiveStep((prevStep) => {
          const current = prevStep !== null ? prevStep : 0;
          let minDistance = Infinity;
          let bestStep = current;
          
          for (let i = current; i < Math.min(current + 3, route.steps.length); i++) {
            const step = route.steps[i];
            const dist = Math.pow(step.location[0] - lat, 2) + Math.pow(step.location[1] - lon, 2);
            if (dist < minDistance) {
              minDistance = dist;
              bestStep = i;
            }
          }
          return bestStep;
        });

        if (progress < 1) {
          simulationRef.current = requestAnimationFrame(animate);
        } else {
          setIsSimulating(false);
          setSimulationPosition(null);
        }
      };
      
      simulationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (simulationRef.current) {
        cancelAnimationFrame(simulationRef.current);
      }
    };
  }, [isSimulating, route]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const location = await reverseGeocode(latitude, longitude);
          if (location) {
            setStart(location);
            setRoute(null);
            setActiveStep(null);
          } else {
            // Fallback if reverse geocoding fails
            setStart({
              lat: latitude,
              lon: longitude,
              display_name: "Current Location"
            });
            setRoute(null);
            setActiveStep(null);
          }
        } catch (err) {
          setError("Failed to get address for current location.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please allow location access in your browser.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information is unavailable.");
            break;
          case err.TIMEOUT:
            setError("The request to get user location timed out.");
            break;
          default:
            setError("An unknown error occurred getting location.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGetDirections = async () => {
    if (!start || !end) return;
    setIsLoading(true);
    setError(null);
    setActiveStep(null);
    setSearchedLocation(null);
    try {
      const validWaypoints = waypoints.filter((wp): wp is Location => wp !== null);
      const result = await getRoute(start, end, validWaypoints);
      if (result) {
        setRoute(result);
      } else {
        setError("Could not find a route between these locations.");
      }
    } catch (err) {
      setError("An error occurred while fetching the route.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters > 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds > 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return `${hours} hr ${mins} min`;
    }
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-96 bg-white shadow-xl z-10 flex flex-col h-1/2 md:h-full order-2 md:order-1">
        {showSavedRoutes ? (
          <div className="flex flex-col h-full">
            <div className="p-4 md:p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Bookmark className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold text-slate-900">Saved Routes</h1>
              </div>
              <button 
                onClick={() => setShowSavedRoutes(false)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Back
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
              {savedRoutes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Bookmark className="h-10 w-10 opacity-20" />
                  <p className="text-sm text-center">No saved routes yet.</p>
                </div>
              ) : (
                savedRoutes.map(sr => (
                  <div 
                    key={sr.id} 
                    onClick={() => handleLoadRoute(sr)}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 truncate pr-2">{sr.name}</h3>
                      <button 
                        onClick={(e) => handleDeleteRoute(sr.id, e)}
                        className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete route"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mr-2 flex-shrink-0" />
                        <span className="truncate">{sr.start.display_name}</span>
                      </div>
                      {sr.waypoints.length > 0 && (
                        <div className="flex items-center pl-0.5">
                          <div className="h-4 border-l border-dashed border-slate-300 mr-2" />
                          <span>{sr.waypoints.length} stop{sr.waypoints.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <MapPin className="h-2.5 w-2.5 text-red-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{sr.end.display_name}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : !route ? (
          <div className="p-4 md:p-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Navigation className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold text-slate-900">Directions</h1>
              </div>
              <button 
                onClick={() => setShowSavedRoutes(true)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center"
              >
                <Bookmark className="h-4 w-4 mr-1" />
                Saved
              </button>
            </div>

            <div className="space-y-3 md:space-y-4 relative">
              {/* Connecting line between inputs */}
              <div className="absolute left-[1.125rem] top-8 bottom-8 w-0.5 bg-slate-200 z-0"></div>

              <div className="relative z-10">
                <LocationSearch
                  label="Starting point"
                  placeholder="Choose starting point..."
                  value={start ? start.display_name : ''}
                  onSelect={(loc) => {
                    setStart(loc);
                    setRoute(null);
                    setActiveStep(null);
                    setSearchedLocation(null);
                  }}
                  onCurrentLocation={handleGetCurrentLocation}
                  isLocating={isLocating}
                  icon={<div className="h-3 w-3 rounded-full border-2 border-indigo-600 bg-white" />}
                />
              </div>

              {waypoints.map((wp, index) => (
                <div key={index} className="relative z-10 flex items-end gap-2">
                  <div className="flex-1">
                    <LocationSearch
                      label={`Stop ${index + 1}`}
                      placeholder="Choose a stop..."
                      value={wp ? wp.display_name : ''}
                      onSelect={(loc) => {
                        const newWaypoints = [...waypoints];
                        newWaypoints[index] = loc;
                        setWaypoints(newWaypoints);
                        setRoute(null);
                        setActiveStep(null);
                        setSearchedLocation(null);
                      }}
                      icon={<div className="h-3 w-3 rounded-full border-2 border-slate-400 bg-white" />}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newWaypoints = [...waypoints];
                      newWaypoints.splice(index, 1);
                      setWaypoints(newWaypoints);
                      setRoute(null);
                    }}
                    className="mb-1 p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove stop"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}

              <div className="relative z-10">
                <LocationSearch
                  label="Destination"
                  placeholder="Choose destination..."
                  value={end ? end.display_name : ''}
                  onSelect={(loc) => {
                    setEnd(loc);
                    setRoute(null);
                    setActiveStep(null);
                    setSearchedLocation(null);
                  }}
                  icon={<MapPin className="h-4 w-4 text-red-500" />}
                />
              </div>
              
              <div className="relative z-10 pt-1">
                <button
                  onClick={() => setWaypoints([...waypoints, null])}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Stop
                </button>
              </div>
            </div>

            <button
              onClick={handleGetDirections}
              disabled={!start || !end || isLoading}
              className="mt-4 md:mt-6 w-full flex items-center justify-center py-2.5 md:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  Get Directions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>

            {error && (
              <div className="mt-3 md:mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 md:p-6 border-b border-indigo-700 shrink-0 bg-indigo-600 text-white shadow-md z-20">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-semibold">Route Details</h1>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={isSimulating ? stopSimulation : startSimulation}
                  className={`text-sm font-medium transition-colors px-2 py-1.5 rounded-md flex items-center ${isSimulating ? 'bg-red-500 text-white hover:bg-red-600' : 'text-indigo-100 hover:text-white hover:bg-indigo-500'}`}
                  title={isSimulating ? "Stop Simulation" : "Simulate Route"}
                >
                  {isSimulating ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current animate-pulse" />}
                </button>
                <button 
                  onClick={handleSaveRoute}
                  className="text-sm font-medium text-indigo-100 hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-indigo-500 flex items-center"
                  title="Save Route"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => { setRoute(null); setActiveStep(null); stopSimulation(); }}
                  className="text-sm font-medium text-indigo-100 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-indigo-500"
                >
                  Edit Route
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm text-indigo-50">
              <div className="flex items-center">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-white bg-transparent mr-3 flex-shrink-0" />
                <span className="truncate">{start?.display_name}</span>
              </div>
              {waypoints.filter(wp => wp !== null).map((wp, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-slate-300 bg-transparent mr-3 flex-shrink-0" />
                  <span className="truncate">{wp?.display_name}</span>
                </div>
              ))}
              <div className="flex items-center">
                <MapPin className="h-3.5 w-3.5 text-red-300 mr-2.5 flex-shrink-0" />
                <span className="truncate">{end?.display_name}</span>
              </div>
            </div>
          </div>
        )}

        {/* Route Details */}
        {!showSavedRoutes && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {route ? (
              <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between p-3 md:p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center space-x-2 md:space-x-3 text-indigo-900">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
                  <span className="font-semibold text-base md:text-lg">{formatDuration(route.duration)}</span>
                </div>
                <div className="flex items-center space-x-1 md:space-x-2 text-indigo-700">
                  <RouteIcon className="h-4 w-4" />
                  <span className="font-medium text-sm md:text-base">{formatDistance(route.distance)}</span>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 uppercase tracking-wider">Turn-by-turn</h3>
                <div className="relative border-l-2 border-slate-200 ml-2 md:ml-3 space-y-2 md:space-y-3">
                  {route.steps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={`relative pl-5 md:pl-6 py-2 pr-2 cursor-pointer transition-colors rounded-r-lg ${activeStep === idx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                      onClick={() => setActiveStep(idx)}
                    >
                      <div className={`absolute -left-[9px] top-3 h-3 w-3 md:h-4 md:w-4 rounded-full border-2 border-white ${activeStep === idx ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                      <p className={`text-sm md:text-base font-medium ${activeStep === idx ? 'text-indigo-900' : 'text-slate-800'}`}>{step.instruction}</p>
                      {step.distance > 0 && (
                        <p className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">{formatDistance(step.distance)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 md:space-y-4 py-8 md:py-0">
                <MapPin className="h-10 w-10 md:h-12 md:w-12 opacity-20" />
                <p className="text-xs md:text-sm text-center">Enter a starting point and destination to get directions.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="w-full h-1/2 md:flex-1 md:h-full relative bg-slate-200 order-1 md:order-2 z-0">
        {/* Floating Search Bar */}
        <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-96 z-[1000] flex items-center space-x-2">
          <div className="flex-1">
            <LocationSearch
              placeholder="Search map..."
              value={searchedLocation ? searchedLocation.display_name : ''}
              onSelect={(loc) => setSearchedLocation(loc ? { ...loc } : null)}
              icon={<Search className="h-5 w-5 text-slate-400" />}
              className="bg-white rounded-lg shadow-lg"
            />
          </div>
          <button
            onClick={handleCenterOnUser}
            className="p-3 bg-white text-slate-700 hover:bg-slate-50 rounded-lg shadow-lg transition-all flex-shrink-0"
            title="Show My Location"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
          <button
            onClick={handleShareLocation}
            className="p-3 bg-white text-slate-700 hover:bg-slate-50 rounded-lg shadow-lg transition-all flex-shrink-0"
            title="Share My Location"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        
        {/* 3D Toggle Button */}
        <div className="absolute bottom-6 left-4 z-[1000]">
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`flex items-center justify-center p-3 rounded-full shadow-lg transition-all ${
              is3DMode 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title={is3DMode ? "Switch to 2D View" : "Switch to 3D View"}
          >
            <Layers className="h-5 w-5" />
          </button>
        </div>

        <MapComponent 
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
      </div>
    </div>
  );
}
