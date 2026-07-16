import React from "react";
import { bootstrapApplication } from "./bootstrap";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root is missing.");
}

void bootstrapApplication(rootElement);
