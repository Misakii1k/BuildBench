import React from "react";
import { createRoot } from "react-dom/client";
import { MainScreen } from "./screens/MainScreen";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MainScreen />
  </React.StrictMode>,
);
