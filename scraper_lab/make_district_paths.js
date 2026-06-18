import * as topojson from 'topojson-client';
import * as d3 from 'd3-geo';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const topoPath = join(__dirname, '../src/data/AndhraPradesh_assembly.json');
const topology = JSON.parse(readFileSync(topoPath, 'utf8'));
const obj = topology.objects[Object.keys(topology.objects)[0]];

const allFeatures = topojson.feature(topology, obj);
const projection = d3.geoMercator().fitExtent([[0, 0], [642.8, 420]], allFeatures);
const pathGen = d3.geoPath().projection(projection);

// constituency → old district lookup (keys uppercased to match mapPaths.json)
const constToDistrict = {};
obj.geometries.forEach(g => {
  const ac = (g.properties.ac_name || '').toUpperCase();
  const dist = (g.properties.district_name || '').toUpperCase();
  if (ac && dist) constToDistrict[ac] = dist;
});
writeFileSync(
  join(__dirname, '../src/data/constituencyDistrict.json'),
  JSON.stringify(constToDistrict, null, 2)
);
console.log(`constituencyDistrict.json written (${Object.keys(constToDistrict).length} constituencies)`);

// old district boundary SVG paths (merged from constituent geometries)
const districtGeomMap = {};
obj.geometries.forEach(g => {
  const dist = (g.properties.district_name || '').toUpperCase();
  if (!dist) return;
  if (!districtGeomMap[dist]) districtGeomMap[dist] = [];
  districtGeomMap[dist].push(g);
});

const districtPaths = {};
for (const [district, geoms] of Object.entries(districtGeomMap)) {
  const merged = topojson.merge(topology, geoms);
  districtPaths[district] = pathGen(merged);
}
writeFileSync(
  join(__dirname, '../src/data/districtPaths.json'),
  JSON.stringify(districtPaths, null, 2)
);
console.log(`districtPaths.json written. Districts: ${Object.keys(districtPaths).sort().join(', ')}`);

// new district boundary SVG paths (grouped via constituencyNewDistrict.json)
const constToNewDistrict = JSON.parse(
  readFileSync(join(__dirname, '../src/data/constituencyNewDistrict.json'), 'utf8')
);

const newDistrictGeomMap = {};
obj.geometries.forEach(g => {
  const ac = (g.properties.ac_name || '').toUpperCase();
  const dist = constToNewDistrict[ac];
  if (!dist) return;
  if (!newDistrictGeomMap[dist]) newDistrictGeomMap[dist] = [];
  newDistrictGeomMap[dist].push(g);
});

const newDistrictPaths = {};
for (const [district, geoms] of Object.entries(newDistrictGeomMap)) {
  const merged = topojson.merge(topology, geoms);
  newDistrictPaths[district] = pathGen(merged);
}
writeFileSync(
  join(__dirname, '../src/data/districtPathsNew.json'),
  JSON.stringify(newDistrictPaths, null, 2)
);
console.log(`districtPathsNew.json written. Districts: ${Object.keys(newDistrictPaths).sort().join(', ')}`);
