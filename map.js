// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zaG9zb2Zza3kiLCJhIjoiY203Y2pkZnB6MHA1aTJpcTZxd2VwbzRkMCJ9.uj_afbQPSLJQcAwvyDSkdA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});