import type { FilterSpecification, Map as MapInstance } from "mapbox-gl";

const CUSTOM_BUILDING_LAYER_ID = "uncwork-3d-buildings";

const findLabelLayerId = (map: MapInstance): string | undefined => {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find(
    (layer) =>
      layer.type === "symbol" &&
      "layout" in layer &&
      Boolean(layer.layout?.["text-field"]),
  )?.id;
};

const hasNativeExtrudedBuildings = (map: MapInstance): boolean => {
  const layers = map.getStyle()?.layers ?? [];
  return layers.some(
    (layer) =>
      layer.type === "fill-extrusion" &&
      layer.id !== CUSTOM_BUILDING_LAYER_ID &&
      layer["source-layer"] === "building",
  );
};

type SourceShape = {
  source: string;
  sourceLayer: string;
  heightProp: string;
  baseProp: string;
  filter?: FilterSpecification;
};

const detectSource = (map: MapInstance): SourceShape | undefined => {
  if (map.getSource("composite")) {
    return {
      source: "composite",
      sourceLayer: "building",
      heightProp: "height",
      baseProp: "min_height",
      filter: ["==", ["get", "extrude"], "true"],
    };
  }
  if (map.getSource("openmaptiles")) {
    return {
      source: "openmaptiles",
      sourceLayer: "building",
      heightProp: "render_height",
      baseProp: "render_min_height",
    };
  }
  return undefined;
};

export const ensureBuildingLayer = (map: MapInstance) => {
  if (hasNativeExtrudedBuildings(map)) return;
  if (map.getLayer(CUSTOM_BUILDING_LAYER_ID)) return;

  const shape = detectSource(map);
  if (!shape) return;

  map.addLayer(
    {
      id: CUSTOM_BUILDING_LAYER_ID,
      type: "fill-extrusion",
      source: shape.source,
      "source-layer": shape.sourceLayer,
      ...(shape.filter ? { filter: shape.filter } : {}),
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", shape.heightProp], 0],
          0,
          "#1a0608",
          20,
          "#2a0a0d",
          60,
          "#400e14",
          120,
          "#5a141c",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.5,
          ["coalesce", ["get", shape.heightProp], 0],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.5,
          ["coalesce", ["get", shape.baseProp], 0],
        ],
        "fill-extrusion-opacity": 0.92,
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
