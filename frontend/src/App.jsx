import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import UserLogin from "./pages/UserLogin";
import PublicForm from "./pages/PublicForm";
import { HowItWorks, PrivacyPolicy, TermsOfUse } from "./pages/InfoPages";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";


/* The signed-in pages are loaded only when someone opens them. A respondent
   filling in a published form never downloads the builder or the Design
   section. */

const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));

function PageLoading() {
  return (
    <div className="d-flex justify-content-center py-5" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Published form. Outside Layout: no app nav, no footer. */}
            <Route path="/f/:publicId" element={<PublicForm />} />

            <Route element={<Layout />}>
              {/* public */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<UserLogin />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-use" element={<TermsOfUse />} />

              {/* The gift request pages are gone; old links land on the forms home. */}
              <Route path="/requests" element={<Navigate to="/forms" replace />} />
              <Route path="/requests/new" element={<Navigate to="/forms" replace />} />

              {/* signed-in user */}
              <Route element={<ProtectedRoute role="user" />}>
                <Route path="/forms" element={<Forms />} />
                <Route path="/forms/:id/edit" element={<FormBuilder />} />
              </Route>

            </Route>
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}