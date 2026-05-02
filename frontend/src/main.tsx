import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "mapbox-gl/dist/mapbox-gl.css";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
