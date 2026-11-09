import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Portal } from "./components/Portal";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles/global.css";
import './styles/solor.css';

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento raiz da aplicação não encontrado.");

createRoot(rootElement).render(
  <React.StrictMode>
    {import.meta.env.VITE_OPERADASH_EXTENSION === "1" ? <App /> : <Portal />}
  </React.StrictMode>,
);
