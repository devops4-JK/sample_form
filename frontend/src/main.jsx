import React from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import App from "./App";
// The app's one stylesheet. It must come AFTER `import App`: App brings in
// the component styles (validation, themed form, page media …) and several
// rules in builder.css are meant to win over them, as they always have.
import "./styles/builder.css";
// The editing and application look. Scoped to the signed-in app by the
// data-ui="app" flag Layout sets, so the published form is never touched.
import "./styles/app-ui.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);