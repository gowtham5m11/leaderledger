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
// constituencyDistrict.json is maintained manually to support renamed keys
// (e.g. GANNAVARAM1/GANNAVARAM2, PRATHIPADU1/PRATHIPADU2) — do not overwrite here.

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

// For disambiguation (e.g. two "Gannavaram" or "Prathipadu" constituencies in
// different old districts), constituencyNewDistrict.json can carry a composite
// key "AC|OLD_DISTRICT" that takes precedence over the plain "AC" key.
const newDistrictGeomMap = {};
obj.geometries.forEach(g => {
  const ac = (g.properties.ac_name || '').toUpperCase();
  const rawDist = (g.properties.district_name || '').toUpperCase();
  const dist = constToNewDistrict[`${ac}|${rawDist}`] || constToNewDistrict[ac];
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

// 28-district boundary SVG paths (grouped via constituencyDistrict28.json)
const constTo28District = JSON.parse(
  readFileSync(join(__dirname, '../src/data/constituencyDistrict28.json'), 'utf8')
);

const dist28GeomMap = {};
obj.geometries.forEach(g => {
  const ac = (g.properties.ac_name || '').toUpperCase();
  const rawDist = (g.properties.district_name || '').toUpperCase();
  const dist = constTo28District[`${ac}|${rawDist}`] || constTo28District[ac];
  if (!dist) return;
  if (!dist28GeomMap[dist]) dist28GeomMap[dist] = [];
  dist28GeomMap[dist].push(g);
});

const districtPaths28 = {};
for (const [district, geoms] of Object.entries(dist28GeomMap)) {
  const merged = topojson.merge(topology, geoms);
  districtPaths28[district] = pathGen(merged);
}
writeFileSync(
  join(__dirname, '../src/data/districtPaths28.json'),
  JSON.stringify(districtPaths28, null, 2)
);
console.log(`districtPaths28.json written. Districts: ${Object.keys(districtPaths28).sort().join(', ')}`);
