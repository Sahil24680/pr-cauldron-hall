import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/index.css";

// The model sheet and the game load separately, so neither pulls in the other's scene code.
const App = lazy(() => import("./app/App").then((module) => ({ default: module.App })));
const Inspect = lazy(() => import("./world/inspect/Inspect").then((module) => ({ default: module.Inspect })));

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Suspense fallback={null}>{window.location.hash.startsWith("#inspect") ? <Inspect /> : <App />}</Suspense>
    </StrictMode>,
  );
}
