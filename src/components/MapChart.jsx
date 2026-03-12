import React from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { getDistrictData, partyColors } from '../data/mockData';
import apData from '../data/ap_const_wgs84_fixed.json';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  const projection = geoMercator().fitSize([800, 600], apData);
  const centerMap = projection.invert ? projection.invert([400, 300]) : [80.76, 15.89];

  return (
    <div className="map-container relative" style={{ width: "100%", height: "100%" }}>
      <ComposableMap 
        projection={projection} 
        width={800} 
        height={600}
        style={{ width: "100%", height: "100%", outline: "none" }}
      >
        <ZoomableGroup center={centerMap} zoom={1} minZoom={1} maxZoom={50}>
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
                        fill: partyColors[data.party] ? partyColors[data.party] + "E0" : "#adcfa8",
                        stroke: "#333",
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
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default MapChart;
