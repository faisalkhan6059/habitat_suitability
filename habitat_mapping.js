// Define your Area of Interest (replace with your AOI)
Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'red'}, 'AOI');

//----------------------------------------
// 1. DEM (SRTM)
//----------------------------------------
var dem = ee.Image("USGS/SRTMGL1_003").clip(aoi);
Map.addLayer(dem, {min: 0, max: 3000, palette: ['blue', 'green', 'brown']}, 'DEM');


//----------------------------------------
// 2. ESA Land Cover
//----------------------------------------
var esa = ee.ImageCollection('ESA/WorldCover/v200').first().clip(aoi);
Map.addLayer(esa, {}, 'ESA Landcover');

// Filter only built-up areas (class 50)
var builtup = esa.updateMask(esa.eq(50));

// Display built-up areas on the map
Map.addLayer(builtup, {min: 50, max: 50, palette: ['red']}, 'Built-Up (Class 50)');
//----------------------------------------
// 3 & 4. Landsat 8: NDVI & Corrected LST
//----------------------------------------

// Function to apply scale factors for Landsat 8
function applyScaleFactors(image) {
  var optical = image.select('SR_B.*').multiply(0.0000275).add(-0.2);
  var thermal = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(optical, null, true).addBands(thermal, null, true);
}

// Function to add NDVI
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// Function to calculate LST (in ºC)
function calculateLST(image) {
  var ndvi = image.select('NDVI');
  var pv = ndvi.expression(
    '((NDVI - NDVImin) / (NDVImax - NDVImin)) ** 2',
    {
      'NDVI': ndvi,
      'NDVImin': 0.2,
      'NDVImax': 0.86
    }
  );
  var emissivity = pv.multiply(0.004).add(0.986);
  var tb = image.select('ST_B10');
  var lst = tb.expression(
    '(TB / (1 + (0.00115 * (TB / 1.438)) * log(EPSILON))) - 273.15',
    {
      'TB': tb,
      'EPSILON': emissivity
    }
  ).rename('LST');
  return image.addBands(lst);
}

// Load and process Landsat 8
var landsat = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterDate('2023-01-01', '2024-12-31')
  .filterBounds(aoi)
  .filter(ee.Filter.lt('CLOUD_COVER', 1))
  .map(applyScaleFactors)
  .map(addNDVI)
  .map(calculateLST);

// Take median of all processed images
var processed = landsat.mean().clip(aoi);

var ndvi = processed.select('NDVI');
Map.addLayer(ndvi, {min: 0, max: 1, palette: ['white', 'green']}, 'NDVI');

var lst = processed.select('LST');


Map.addLayer(lst, {
  min: 25, max: 45,
  palette: ['3288bd','66c2a5','abdda4','e6f598','fee08b','fdae61','f46d43','d53e4f']
}, 'LST (ºC)');

//----------------------------------------
// EXPORTS (30 m resolution)
//----------------------------------------

Export.image.toDrive({
  image: dem,
  description: 'DEM_30m',
  folder: 'GEE_Habitat',
  region: aoi,
  scale: 30,
  crs: 'EPSG:28351',
  maxPixels: 1e13
});


Export.image.toDrive({
  image: esa,
  description: 'ESA_Landcover_10m',
  folder: 'GEE_Habitat',
  region: aoi,
  scale: 30,
  crs: 'EPSG:28351',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ndvi,
  description: 'NDVI_Landsat8_30m',
  folder: 'GEE_Habitat',
  region: aoi,
  scale: 30,
  crs: 'EPSG:28351',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: lst,
  description: 'LST_Landsat8_30m',
  folder: 'GEE_Habitat',
  region: aoi,
  scale: 30,
  crs: 'EPSG:28351',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: builtup,
  description: 'builtup_30m',
  folder: 'GEE_Habitat',
  region: aoi,
  scale: 30,
  crs: 'EPSG:28351',
  maxPixels: 1e13
});
