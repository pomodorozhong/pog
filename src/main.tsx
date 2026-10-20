import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createSharedStore, isMirrorUrl, SharedProvider } from "./sync/shared";
import "./styles.css";

const shared = createSharedStore(isMirrorUrl(window.location.search));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SharedProvider store={shared}>
      <App />
    </SharedProvider>
  </StrictMode>,
);
