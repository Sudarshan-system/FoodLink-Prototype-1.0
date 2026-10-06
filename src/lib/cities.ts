export interface CityInfo {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  zoom: number;
  hubs: string[];
  partnerCount: number;
}

export const INDIAN_CITIES: CityInfo[] = [
  {
    id: 'all',
    name: 'All Metro Cities',
    state: 'National Network',
    lat: 20.5937,
    lng: 78.9629,
    zoom: 5,
    hubs: ['Mumbai', 'Bengaluru', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata'],
    partnerCount: 420,
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    lat: 19.0760,
    lng: 72.8777,
    zoom: 12,
    hubs: ['Bandra Kurla Complex', 'Andheri West', 'Lower Parel', 'Dadar', 'Navi Mumbai', 'Powai'],
    partnerCount: 88,
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    zoom: 12,
    hubs: ['Indiranagar', 'Koramangala', 'Whitefield', 'Electronic City', 'HSR Layout', 'MG Road'],
    partnerCount: 76,
  },
  {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'National Capital Region',
    lat: 28.6139,
    lng: 77.2090,
    zoom: 11,
    hubs: ['Connaught Place', 'Gurugram Cyber Hub', 'Noida Sector 62', 'South Extension', 'Dwarka'],
    partnerCount: 94,
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    lat: 17.3850,
    lng: 78.4867,
    zoom: 12,
    hubs: ['HITEC City', 'Banjara Hills', 'Gachibowli', 'Secunderabad', 'Jubilee Hills'],
    partnerCount: 52,
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    zoom: 12,
    hubs: ['Kalyani Nagar', 'Kothrud', 'Hinjewadi IT Park', 'Viman Nagar', 'Baner'],
    partnerCount: 44,
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    zoom: 12,
    hubs: ['T. Nagar', 'Adyar', 'Velachery', 'Anna Nagar', 'OMR IT Corridor'],
    partnerCount: 38,
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    zoom: 12,
    hubs: ['Park Street', 'Salt Lake Sector V', 'New Town', 'Ballygunge', 'Howrah'],
    partnerCount: 28,
  },
];

export function getCityById(id: string): CityInfo {
  return INDIAN_CITIES.find((c) => c.id === id) || INDIAN_CITIES[0];
}

export function matchesCity(locationStr: string | undefined, cityId: string): boolean {
  if (!cityId || cityId === 'all') return true;
  if (!locationStr) return false;
  const targetCity = INDIAN_CITIES.find((c) => c.id === cityId);
  if (!targetCity) return true;

  const loc = locationStr.toLowerCase();
  const cityName = targetCity.name.toLowerCase();
  
  if (loc.includes(cityName)) return true;
  if (cityId === 'delhi' && (loc.includes('gurgaon') || loc.includes('noida') || loc.includes('delhi'))) return true;

  return targetCity.hubs.some((hub) => loc.includes(hub.toLowerCase()));
}
