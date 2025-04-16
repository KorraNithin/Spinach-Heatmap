
import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import GeoTIFF from "ol/source/GeoTIFF";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import { get as getProjection } from "ol/proj.js";
import { isEmpty } from "ol/extent";
import Overlay from "ol/Overlay"; // Import Overlay for tooltip
import "./App.css"; // Optional: For styling the map and controls

const App = () => {
  const mapRef = useRef(null);
  const tifLayerRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const baseLayerRef = useRef(null);
  const tooltipRef = useRef(null); // Ref for the tooltip overlay
  const [selectedBaseMap, setSelectedBaseMap] = useState("Google Satellite");
  const [selectedStressMap, setSelectedStressMap] = useState("Stress Map 1");

 // Define EPSG:4326 projection
 const projection4326 = getProjection("EPSG:4326");

 const baseMaps = {
  "Google Satellite": new TileLayer({
    source: new XYZ({
      url: "http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}",
      maxZoom: 23,
      preload: 1,
    }),
    visible: true,
  }),
  None: null,
};

   // Define stress maps
  const stressMaps = {
    "Stress Map 1": "/assets/stress_sample.json",
    "Stress Map 2": "/assets/stress_sample_2.json",
  };

  const createTifLayer = (url) => {
    const source = new GeoTIFF({
      sources: [{ url }],
      transition: 0,
      interpolate: false,
      sourceProjection: "EPSG:32642", // Update as needed
    });

    const stressLayer = new WebGLTileLayer({
      source,
      opacity: 0.5,
      visible: true,
    });

    source.on("change", () => {
      if (source.getState() === "ready") {
        const tileGrid = source.getTileGrid();
        if (tileGrid) {
          const extent = tileGrid.getExtent();
          console.log("GeoTIFF extent:", extent);
          if (
            extent &&
            !isEmpty(extent) &&
            extent[0] >= -180 &&
            extent[2] <= 180 &&
            extent[1] >= -90 &&
            extent[3] <= 90
          ) {
            mapRef.current
              .getView()
              .fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 });
            console.log("Fitted to GeoTIFF extent:", extent);
          } else {
            console.warn("GeoTIFF extent invalid for EPSG:4326");
            mapRef.current.getView().setCenter([144.45695, -37.68685]);
            mapRef.current.getView().setZoom(18);
          }
        } else {
          console.warn("GeoTIFF tileGrid unavailable");
          mapRef.current.getView().setCenter([144.45695, -37.68685]);
          mapRef.current.getView().setZoom(18);
        }
      } else if (source.getState() === "error") {
        console.error("GeoTIFF source failed to load");
        mapRef.current.getView().setCenter([144.45695, -37.68685]);
        mapRef.current.getView().setZoom(18);
      }
    });

    return stressLayer;
  };

   // Function to create heatmap layer
   const createHeatmapLayer = (geojsonData) => {
    try {
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(geojsonData, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:4326",
        }),
      });

      const heatmapLayer = new VectorLayer({
        source: vectorSource,
        style: (feature) => {
          const ndviValue = feature.get("value") || 0;
          let color;
          if (ndviValue <= 0.0) {
            color = [255, 0, 0, 1];
          } else if (ndviValue >= 1.0) {
            color = [0, 255, 0, 1];
          } else {
            const ratio = ndviValue;
            const r = Math.round(255 * (1 - ratio));
            const g = Math.round(255 * ratio);
            color = [r, g, 0, 1];
          }

          return new Style({
            fill: new Fill({ color }),
            stroke: new Stroke({
              color: [0, 0, 0, 0.2],
              width: 1,
            }),
          });
        },
        opacity: 0.7,
        visible: true,
      });

      const extent = vectorSource.getExtent();
      console.log("GeoJSON extent:", extent);
      if (!isEmpty(extent)) {
        mapRef.current
          .getView()
          .fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 });
        console.log("Fitted to GeoJSON extent:", extent);
      } else {
        console.warn("GeoJSON extent is empty or invalid");
      }

      return heatmapLayer;
    } catch (error) {
      console.error("Error creating heatmap layer:", error);
      return null;
    }
  };

  // Function to load stress map
  const loadStressMap = (url) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((geojsonData) => {
        const newHeatmapLayer = createHeatmapLayer(geojsonData);
        if (!newHeatmapLayer) {
          console.warn("Failed to create heatmap layer");
          return;
        }

        if (heatmapLayerRef.current) {
          mapRef.current.removeLayer(heatmapLayerRef.current);
        }

        mapRef.current.addLayer(newHeatmapLayer);
        heatmapLayerRef.current = newHeatmapLayer;
      })
      .catch((error) => {
        console.error("Error loading GeoJSON:", error);
      });
  };

  // Initialize map and tooltip
  useEffect(() => {
    // Create map instance
    const map = new Map({
      target: "map",
      layers: [baseMaps["Google Satellite"]],
      view: new View({
        projection: projection4326,
        center: [0 , 0],
        zoom: 18,
      }),
    });
    mapRef.current = map;
    baseLayerRef.current = baseMaps["Google Satellite"];

    // Create tooltip overlay
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "ol-tooltip";
    tooltipElement.style.position = "absolute";
    tooltipElement.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    tooltipElement.style.color = "white";
    tooltipElement.style.padding = "4px 8px";
    tooltipElement.style.borderRadius = "4px";
    tooltipElement.style.pointerEvents = "none"; // Prevent tooltip from interfering with map events
    tooltipElement.style.display = "none"; // Hidden by default

    const tooltip = new Overlay({
      element: tooltipElement,
      offset: [0, -10], // Offset above the cursor
      positioning: "bottom-center",
    });
    map.addOverlay(tooltip);
    tooltipRef.current = tooltip;

    // Add hover event listener
    map.on("pointermove", (event) => {
      const pixel = map.getEventPixel(event.originalEvent);
      const feature = map.forEachFeatureAtPixel(pixel, (feature) => feature);
      if (feature) {
        const ndviValue = feature.get("value") || "N/A";
        tooltipElement.innerHTML = `NDVI: ${ndviValue}`;
        tooltip.setPosition(event.coordinate);
        tooltipElement.style.display = "block";
      } else {
        tooltipElement.style.display = "none";
      }
    });

    // Load GeoTIFF
    const currentTifUrl = "./assets/sample.tif";
    if (map && currentTifUrl) {
      const newTifLayer = createTifLayer(currentTifUrl);
      map.addLayer(newTifLayer);
      tifLayerRef.current = newTifLayer;
    } else {
      console.error("Map instance or GeoTIFF URL is missing");
    }

    // Load default stress map
    loadStressMap(stressMaps["Stress Map 1"]);
    
    
    // Cleanup on unmount
    return () => {
      map.setTarget(null);
      map.removeOverlay(tooltip);
      mapRef.current = null;
    };
  }, []);

  // Handle base map change
  useEffect(() => {
    if (!mapRef.current) return;

    if (baseLayerRef.current) {
      mapRef.current.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }

    if (selectedBaseMap !== "None") {
      baseLayerRef.current = baseMaps[selectedBaseMap];
      mapRef.current.getLayers().insertAt(0, baseLayerRef.current);
    }

    // Restore view
    if (heatmapLayerRef.current) {
      const extent = heatmapLayerRef.current.getSource().getExtent();
      if (!isEmpty(extent)) {
        mapRef.current
          .getView()
          .fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 });
      } else {
        mapRef.current.getView().setCenter([144.45695, -37.68685]);
        mapRef.current.getView().setZoom(18);
      }
    } else {
      mapRef.current.getView().setCenter([144.45695, -37.68685]);
      mapRef.current.getView().setZoom(18);
    }
  }, [selectedBaseMap]);

  // Handle stress map change
  useEffect(() => {
    if (!mapRef.current) return;

    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (selectedStressMap !== "None") {
      loadStressMap(stressMaps[selectedStressMap]);
    } else {
      mapRef.current.getView().setCenter([144.45695, -37.68685]);
      mapRef.current.getView().setZoom(18);
    }
  }, [selectedStressMap]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div id="map" style={{ width: "100%", height: "100%" }}></div>
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "108px",
          backgroundColor: "black",
          padding: "5px",
          border: "1px solid #ccc",
          zIndex: 1000,
          display: "flex",
          gap: "8px",
        }}
      >
        <div>
          <label htmlFor="baseMapSelect">Base Map: </label>
          <select
            id="baseMapSelect"
            value={selectedBaseMap}
            onChange={(e) => setSelectedBaseMap(e.target.value)}
          >
            {Object.keys(baseMaps).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stressMapSelect">Stress Map: </label>
          <select
            id="stressMapSelect"
            value={selectedStressMap}
            onChange={(e) => setSelectedStressMap(e.target.value)}
          >
            <option value="None">None</option>
            {Object.keys(stressMaps).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <details
          style={{
            color: "white",
            backgroundColor: "#3b3b3b",
            padding: "1px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <summary style={{ fontWeight: "bold", marginBottom: "8px" }}>NDVI Legend</summary>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "start" }}>
            <div
              style={{
                color: "white",
                width: "150px",
                height: "15px",
                background: "linear-gradient(to right, red, yellow, green)",
                border: "1px solid #ccc",
              }}
            ></div>
            <div
              style={{
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                width: "150px",
                fontSize: "12px",
              }}
            >
              <span>0.0</span>
              <span>0.5</span>
              <span>1.0</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default App;