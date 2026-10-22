import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { listenForInstallPrompt, registerServiceWorker } from "./lib/install";
import "./styles.css";

listenForInstallPrompt();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
