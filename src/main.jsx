import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./App.jsx";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<Dashboard />);
