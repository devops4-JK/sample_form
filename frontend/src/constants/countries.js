/**
 * Dial codes for the phone question.
 *
 * A phone answer stays one plain string — "+91 98765 43210" — so nothing
 * downstream has to learn a new shape: the Excel export, the responses
 * table and every saved answer keep working exactly as before. The picker
 * only swaps the code at the front.
 */

export const COUNTRIES = [
  { code: "+91", iso: "IN", name: "India" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+971", iso: "AE", name: "United Arab Emirates" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+66", iso: "TH", name: "Thailand" },
  { code: "+84", iso: "VN", name: "Vietnam" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+82", iso: "KR", name: "South Korea" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+977", iso: "NP", name: "Nepal" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+45", iso: "DK", name: "Denmark" },
  { code: "+358", iso: "FI", name: "Finland" },
  { code: "+353", iso: "IE", name: "Ireland" },
  { code: "+351", iso: "PT", name: "Portugal" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+972", iso: "IL", name: "Israel" },
  { code: "+20", iso: "EG", name: "Egypt" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+56", iso: "CL", name: "Chile" },
];

export const DEFAULT_COUNTRY = "IN";

export const countryOf = (iso) =>
  COUNTRIES.find((c) => c.iso === iso) || COUNTRIES[0];

/**
 * Pulls a saved answer apart into the code at the front and the rest.
 * Longest code first, so "+1" never swallows "+91".
 */
export function splitPhone(value, fallbackIso = DEFAULT_COUNTRY) {
  const text = String(value ?? "").trim();
  if (text.startsWith("+")) {
    const match = [...COUNTRIES]
      .sort((a, b) => b.code.length - a.code.length)
      .find((c) => text.startsWith(c.code));
    if (match) {
      return { iso: match.iso, code: match.code, number: text.slice(match.code.length).trim() };
    }
  }
  const fallback = countryOf(fallbackIso);
  return { iso: fallback.iso, code: fallback.code, number: text };
}

/** Puts them back together the way the answer is stored. */
export const joinPhone = (code, number) =>
  String(number ?? "").trim() ? `${code} ${String(number).trim()}` : "";





