import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { getDistrictData, partyColors } from '../data/mockData';

const geoUrl = '/src/data/ap_const_simple.geojson';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  return (
    <div className="map-container relative" style={{ width: "100%", height: "100%", minHeight: "600px" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 3500,
          center: [80, 16.5] // center map on AP roughly
        }}
        width={800}
        height={600}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const districtName = geo.properties.AC_NAME || geo.properties.ac_name || geo.properties.district_name || geo.properties.NEW_DIST || geo.properties.dtname || "Unknown";
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
