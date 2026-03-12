import React from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { getDistrictData, partyColors } from '../data/mockData';
import apData from '../data/ap_const_wgs84_fixed.json';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  // We use d3-geo to compute a projection that perfectly fits the AP geojson boundary into our viewbox.
  const projection = geoMercator().fitSize([800, 600], apData);

  return (
    <div className="map-container relative" style={{ width: "100%", height: "100%", minHeight: "600px" }}>
      <ComposableMap
        projection={projection}
        width={800}
        height={600}
      >
        <Geographies geography={apData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const districtName = geo.properties.name || "Unknown";
              const data = getDistrictData(districtName);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => onDistrictClick(data)}
                  onMouseEnter={() => {
                    setTooltipContent({ name: districtName, ...data });
                  }}
                  onMouseLeave={() => {
                    setTooltipContent(null);
                  }}
                  style={{
                    default: {
                      fill: "#FFF",
                      stroke: "#555",
                      strokeWidth: 0.5,
                      outline: "none",
                      transition: "all 250ms"
                    },
                    hover: {
                      fill: partyColors[data.party] || "#adcfa8",
                      stroke: "#000",
                      strokeWidth: 1.5,
                      outline: "none",
                      cursor: "pointer",
                      transition: "all 250ms"
                    },
                    pressed: {
                      fill: "#e6e6e6",
                      outline: "none",
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
};

export default MapChart;
