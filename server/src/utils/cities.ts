export interface City { id: string; name: string; state: string; lat: number; lon: number }
export const CITIES: City[] = [
  { id: 'delhi', name: 'Delhi', state: 'Delhi', lat: 28.6139, lon: 77.209 },
  { id: 'new-delhi', name: 'New Delhi', state: 'Delhi', lat: 28.6315, lon: 77.2167 },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lon: 72.8777 },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714 },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  { id: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
  { id: 'gurugram', name: 'Gurugram', state: 'Haryana', lat: 28.4595, lon: 77.0266 },
];
export const getCity = (id?: string) => CITIES.find((c) => c.id === id);
