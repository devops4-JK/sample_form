/**
 * Sorting that happens in Node, not in MySQL.
 *
 * Several of our tables carry a wide JSON column — a form's schema, a
 * question's settings, a theme's config, a response's answers. Pictures
 * chosen in the builder live inside those as data URLs, so a single row
 * can run to megabytes.
 *
 * MySQL sorts by copying whole rows into its sort buffer, and
 * `sort_buffer_size` is a few hundred kilobytes by default. One ORDER BY
 * over a table like that and the server answers:
 *
 *   ER_OUT_OF_SORTMEMORY — Out of sort memory, consider increasing
 *   server sort buffer size
 *
 * which fails the request and, from the app's side, looks like every form
 * and theme has vanished.
 *
 * These lists are small — tens of rows, not millions — so ordering them
 * here costs nothing and removes the problem for good, whatever is stored
 * in them and whatever the database is tuned to.
 */

const value = (row, key) => {
  const v = typeof row.get === "function" ? row.get(key) : row[key];
  if (v instanceof Date) return v.getTime();
  if (v === null || v === undefined) return "";
  return v;
};

/**
 * sortRows(rows, [["createdAt", "DESC"]])
 * sortRows(rows, [["pageNumber", "ASC"], ["position", "ASC"]])
 */
function sortRows(rows, by) {
  const keys = Array.isArray(by[0]) ? by : [by];

  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const av = value(a, key);
      const bv = value(b, key);
      if (av === bv) continue;
      const order = av > bv ? 1 : -1;
      return String(dir).toUpperCase() === "DESC" ? -order : order;
    }
    return 0;
  });
}

module.exports = { sortRows };