const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "cs_token";

/**
 * The token lives in sessionStorage, not localStorage.
 *
 * sessionStorage is wiped when the tab or browser closes, so reopening the
 * app always asks for a login again. Refreshing the page keeps you signed in,
 * because a reload does not end the session.
 */
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  // Clears any token left behind by the old localStorage version.
  localStorage.removeItem(TOKEN_KEY);
};

// Drop a stale localStorage token on first load, so an old session cannot
// survive a browser restart.
localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Check that it is running.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    /* The server turned a signed-in request away: the session ran out, or
       the account was switched off. Drop the dead token and go back to the
       login page rather than leaving a screen that looks signed in but can
       no longer save anything. */
    if (response.status === 401 && token) {
      clearToken();
      if (window.location.pathname.startsWith("/forms")) window.location.assign("/login");
    }
    if (response.status === 429 && !data.message) {
      data.message = "Too many requests. Wait a minute and try again.";
    }

    const error = new Error(data.message || "Something went wrong. Try again.");
    // Carried through so a caller can tell one refusal from another — the
    // validation gate shows a different page for "not on the list" than
    // for "already filled in".
    error.reason = data.reason || "";
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Sends a file as it is (not as JSON) to a signed-in endpoint. Used for the
 * customer list uploaded as an Excel sheet.
 */
async function upload(path, file) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
  } catch {
    throw new Error("Cannot reach the server. Check that it is running.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 413) throw new Error("That file is too large. The limit is 5 MB.");
    throw new Error(data.message || "The upload failed. Try again.");
  }
  return data;
}

/**
 * Full URL for an API path, for links that leave the app (the Excel feed).
 * VITE_API_URL may be absolute (production) or "/api" (dev, via Vite's proxy).
 */
export const apiUrl = (path) => {
  const base = BASE_URL.startsWith("http") ? BASE_URL : `${window.location.origin}${BASE_URL}`;
  return `${base.replace(/\/$/, "")}${path}`;
};

/** Downloads a file from a signed-in endpoint and hands it to the browser. */
async function download(path, fallbackName) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error("Cannot reach the server. Check that it is running.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "The download failed. Try again.");
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const name = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  // ---- auth ----
  userLogin: (email, password) =>
    request("/auth/user/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),

  // ---- workbenches ----
  listWorkbenches: () => request("/workbenches"),
  createWorkbench: (name) =>
    request("/workbenches", { method: "POST", body: { name } }),
  renameWorkbench: (id, name) =>
    request(`/workbenches/${id}`, { method: "PATCH", body: { name } }),
  deleteWorkbench: (id) => request(`/workbenches/${id}`, { method: "DELETE" }),

  // ---- forms ----
  listForms: ({ workbenchId, sort } = {}) => {
    const q = new URLSearchParams();
    if (workbenchId) q.set("workbenchId", workbenchId);
    if (sort) q.set("sort", sort);
    const qs = q.toString();
    return request(`/forms${qs ? `?${qs}` : ""}`);
  },
  createForm: (workbenchId, name) =>
    request("/forms", { method: "POST", body: { workbenchId, name } }),
  getForm: (id) => request(`/forms/${id}`),
  updateForm: (id, payload) =>
    request(`/forms/${id}`, { method: "PATCH", body: payload }),
  moveForm: (id, workbenchId) =>
    request(`/forms/${id}/move`, { method: "PATCH", body: { workbenchId } }),
  deleteForm: (id) => request(`/forms/${id}`, { method: "DELETE" }),
  formResponses: (id) => request(`/forms/${id}/responses`),
  formQuestions: (id) => request(`/forms/${id}/questions`),

  // ---- themes: the saved looks from the Design section ----
  listThemes: () => request("/themes"),
  createTheme: (body) => request("/themes", { method: "POST", body }),
  updateTheme: (id, body) => request(`/themes/${id}`, { method: "PATCH", body }),
  deleteTheme: (id) => request(`/themes/${id}`, { method: "DELETE" }),
  formTheme: (formId) => request(`/themes/form/${formId}`),
  applyTheme: (formId, themeId) =>
    request(`/themes/form/${formId}`, { method: "PUT", body: { themeId } }),
  publishThemeToLive: (formId) => request(`/themes/form/${formId}/publish`, { method: "PUT" }),

  // ---- form validation: who may fill a form in ----
  formValidation: (id) => request(`/forms/${id}/validation`),
  setFormValidation: (id, body) =>
    request(`/forms/${id}/validation`, { method: "PATCH", body }),
  // The customer list, read from column A of an uploaded .xlsx file.
  importValidationSheet: (id, file) => upload(`/forms/${id}/validation/import`, file),
  addValidationEmails: (id, body) =>
    request(`/forms/${id}/validation/entries`, { method: "POST", body }),
  removeValidationEmail: (id, entryId) =>
    request(`/forms/${id}/validation/entries/${entryId}`, { method: "DELETE" }),
  resetValidationEmail: (id, entryId) =>
    request(`/forms/${id}/validation/entries/${entryId}/reset`, { method: "POST" }),
  clearValidationList: (id) =>
    request(`/forms/${id}/validation/entries`, { method: "DELETE" }),

  // ---- Excel ----
  integrations: (id) => request(`/forms/${id}/integrations`),
  enableExcel: (id) => request(`/forms/${id}/integrations/excel`, { method: "POST" }),
  disableExcel: (id) => request(`/forms/${id}/integrations/excel`, { method: "DELETE" }),
  downloadXlsx: (id) => download(`/forms/${id}/export.xlsx`, "responses.xlsx"),
  downloadCsv: (id) => download(`/forms/${id}/export.csv`, "responses.csv"),

  // ---- workflow: logic jumps between pages ----
  formWorkflow: (id) => request(`/forms/${id}/workflow`),
  saveWorkflow: (id, workflow) =>
    request(`/forms/${id}/workflow`, { method: "PUT", body: { workflow } }),
  // Webhook and email after a submission.
  formAutomations: (id) => request(`/forms/${id}/workflow/automations`),
  saveAutomations: (id, automation) =>
    request(`/forms/${id}/workflow/automations`, { method: "PUT", body: { automation } }),
  newWebhookSecret: (id) => request(`/forms/${id}/workflow/automations/secret`, { method: "POST" }),
  testAutomation: (id, channel) =>
    request(`/forms/${id}/workflow/automations/test`, { method: "POST", body: { channel } }),

  // ---- Google Sheets: a sheet kept in step with the form, both ways ----
  formSheet: (id) => request(`/forms/${id}/sheet`),
  connectSheet: (id, url) => request(`/forms/${id}/sheet`, { method: "PUT", body: { url } }),
  syncSheet: (id) => request(`/forms/${id}/sheet/sync`, { method: "POST" }),
  disconnectSheet: (id) => request(`/forms/${id}/sheet`, { method: "DELETE" }),

  // ---- public form, no token needed ----
  getPublicForm: (publicId) => request(`/forms/public/${publicId}`),
  // Asks the gate to let an address in. Resolves with a ticket, or throws
  // with .reason set to "not_listed" / "already_done" / "already_open".
  signInToForm: (publicId, email) =>
    request(`/forms/public/${publicId}/sign-in`, { method: "POST", body: { email } }),
  // `hidden` holds the values the Workflow tab reads from the link.
  // Resolves with { message, ending } — the ending the server chose.
  submitPublicForm: (publicId, answers, ticket = null, hidden = {}) =>
    request(`/forms/public/${publicId}`, {
      method: "POST",
      body: { answers, completed: true, ticket, hidden },
    }),

};