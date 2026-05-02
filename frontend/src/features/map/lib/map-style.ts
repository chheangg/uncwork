import type { Map as MapInstance } from "maplibre-gl";

const CUSTOM_BUILDING_LAYER_ID = "uncwork-3d-buildings";
const OPENMAPTILES_SOURCE = "openmaptiles";

const findLabelLayerId = (map: MapInstance): string | undefined => {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find(
    (layer) => layer.type === "symbol" && "layout" in layer && layer.layout?.["text-field"],
  )?.id;
};

export const ensureBuildingLayer = (map: MapInstance) => {
  if (map.getLayer(CUSTOM_BUILDING_LAYER_ID)) return;
  if (!map.getSource(OPENMAPTILES_SOURCE)) return;

  map.addLayer(
    {
      id: CUSTOM_BUILDING_LAYER_ID,
      type: "fill-extrusion",
      source: OPENMAPTILES_SOURCE,
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], ["get", "height"], 0],
          0,
          "#0e1d18",
          20,
          "#163025",
          60,
          "#1f4734",
          120,
          "#2a6149",
        ],
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          0,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 0.9,
      },
    },
    findLabelLayerId(map),
  );
};

export const setBuildingVisibility = (map: MapInstance, visible: boolean) => {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type === "fill-extrusion") {
      map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
    }
  }
};
