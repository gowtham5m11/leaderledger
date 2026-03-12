import { geoMercator } from 'd3-geo';
import fs from 'fs';

const apData = JSON.parse(fs.readFileSync('./src/data/ap_const_wgs84_fixed.json', 'utf8'));
const projection = geoMercator().fitSize([800, 600], apData);
console.log("Scale:", projection.scale());
console.log("Translate:", projection.translate());
console.log("Center (invert 400,300):", projection.invert([400, 300]));
