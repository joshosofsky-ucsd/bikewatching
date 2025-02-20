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

let timeFilter = -1; // Initialize timeFilter to -1 (no filtering)

// Select the slider and display elements
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// Helper function to format time
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Function to update the UI when the slider moves
function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);  // Get slider value

  if (timeFilter === -1) {
    selectedTime.textContent = '';  // Clear time display
    anyTimeLabel.style.display = 'block';  // Show "(any time)"
  } else {
    selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
    anyTimeLabel.style.display = 'none';  // Hide "(any time)"
  }

  if (typeof trips !== 'undefined' && typeof stations !== 'undefined') {
    filterTripsByTime(); // Trigger filtering logic only if trips and stations are defined
  }
}

// Bind the slider’s input event to the update function
timeSlider.addEventListener('input', updateTimeDisplay);

// Set the initial display state
updateTimeDisplay();

// Function to calculate minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Initialize filtered data structures
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
let radiusScale; // Define radiusScale globally
let circles; // Define circles globally
let getCoords; // Define getCoords globally
let svg; // Define svg globally
let updatePositions; // Define updatePositions globally

// Define the quantize scale for station flow
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Define a color scale as a fallback
let colorScale = d3.scaleLinear()
  .domain([0, 0.5, 1])
  .range(['steelblue', 'purple', 'darkorange']);

// Function to filter trips by time
function filterTripsByTime() {
  filteredTrips = timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });

  // Update arrivals and departures based on filtered trips
  filteredArrivals = d3.rollup(
    filteredTrips,
    (v) => v.length,
    (d) => d.end_station_id,
  );

  filteredDepartures = d3.rollup(
    filteredTrips,
    (v) => v.length,
    (d) => d.start_station_id,
  );

  // Update stations based on filtered arrivals and departures
  filteredStations = stations.map((station) => {
    station = { ...station }; // Clone the station object
    let id = station.short_name;
    station.arrivals = filteredArrivals.get(id) ?? 0;
    station.departures = filteredDepartures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });

  // Update the circle radius scale based on the filter
  radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(filteredStations, d => d.totalTraffic)])
    .range(timeFilter === -1 ? [0, 25] : [3, 50]);

  // Re-bind filtered data to circles using a key function for proper matching
  circles = svg.selectAll('circle')
    .data(filteredStations, d => d.short_name)
    .join(
      enter => enter.append('circle')
        .attr('fill', d => colorScale(stationFlow(d.departures / d.totalTraffic))) // Use colorScale for fill color
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .call(enter => enter.append('title')),
      update => update
        .attr('fill', d => colorScale(stationFlow(d.departures / d.totalTraffic))), // Update fill color
      exit => exit.remove()
    )
    .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

  // Transition update: adjust radius and tooltip text
  circles.transition().duration(200)
    .attr('r', d => radiusScale(d.totalTraffic))
    .each(function(d) {
      d3.select(this).select('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  // Update positions so that the circles align correctly on the map
  updatePositions();
}

map.on('load', () => {
  // Add a source for the Boston bike lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  // Add a layer to visualize the Boston bike lanes
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',  // A bright green using hex code
      'line-width': 5,          // Thicker lines
      'line-opacity': 0.6       // Slightly less transparent
    }
  });

  // Add a source for the Cambridge bike lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: './RECREATION_BikeFacilities.geojson' // Relative path to the local GeoJSON file
  });

  // Add a layer to visualize the Cambridge bike lanes
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',  // A bright green using hex code
      'line-width': 5,          // Thicker lines
      'line-opacity': 0.6       // Slightly less transparent
    }
  });

  // Load the nested JSON file
  const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  d3.json(jsonurl).then(jsonData => {
    console.log('Loaded JSON Data:', jsonData);  // Log to verify structure

    // Define stations globally
    window.stations = jsonData.data.stations;
    console.log('Stations Array:', stations);

    // Load the traffic data from CSV
    const csvurl = 'bluebikes-traffic-2024-03.csv'; // Replace with the actual URL
    d3.csv(csvurl).then(tripsData => {
      console.log('Loaded CSV Data:', tripsData);  // Log to verify structure

      // Convert date strings to Date objects
      for (let trip of tripsData) {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
      }

      // Store trips globally for filtering
      window.trips = tripsData;

      // Initialize the circles
      svg = d3.select('#map').append('svg');

      // Define getCoords function globally
      getCoords = function(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point);  // Project to pixel coordinates
        return { cx: x, cy: y };  // Return as object for use in SVG attributes
      }

      // Append circles to the SVG for each station
      circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale ? radiusScale(d.totalTraffic) : 0)  // Radius based on traffic
        .attr('fill', d => colorScale(stationFlow(d.departures / d.totalTraffic))) // Use colorScale for fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8)       // Circle opacity
        .each(function(d) {
          // Add <title> for browser tooltips
          d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        })
        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

      // Function to update circle positions when the map moves/zooms
      updatePositions = function() {
        circles
          .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
          .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
      }

      // Initial position update when map loads
      updatePositions();

      // Reposition markers on map interactions
      map.on('move', updatePositions);     // Update during map movement
      map.on('zoom', updatePositions);     // Update during zooming
      map.on('resize', updatePositions);   // Update on window resize
      map.on('moveend', updatePositions);  // Final adjustment after movement ends

      // Trigger initial filtering
      filterTripsByTime();

    }).catch(error => {
      console.error('Error loading CSV:', error);  // Handle errors if CSV loading fails
    });

  }).catch(error => {
    console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
  });
});
