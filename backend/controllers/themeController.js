const { Form, FormLiveTheme, FormTheme, Theme, User } = require("../models");
const { logActivity } = require("./activity");
const { sortRows } = require("./sorting");

/**
 * Themes: the saved looks a form can wear.
 *
 * Like workbenches and forms, they are shared — everyone signed in sees
 * the same list and may edit it. The whole look travels in `config`, so
 * the Design panel can grow new controls without a schema change here.
 */

/**
 * Wraps a handler so a database problem reaches the person as words they
 * can act on — "Table 'themes' doesn't exist" is a far better thing to
 * read than "Something went wrong on our side."
 */
const speak = (what, handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    console.error(`Themes — ${what} failed:`, err);
    if (!err.status) {
      err.status = 500;
      err.expose = true;
      err.message = `${what} failed: ${err.original?.sqlMessage || err.message}`;
    }
    next(err);
  }
};

const withPeople = {
  include: [
    { model: User, as: "createdBy", attributes: ["id", "name", "email"] },
    { model: User, as: "updatedBy", attributes: ["id", "name", "email"] },
  ],
};

function serialise(theme, useCount = 0) {
  return {
    id: theme.id,
    name: theme.name,
    tagline: theme.tagline,
    config: theme.config || {},
    uses: useCount,
    created: theme.createdAt,
    updated: theme.updatedAt,
    createdBy: theme.createdBy
      ? { id: theme.createdBy.id, name: theme.createdBy.name, email: theme.createdBy.email }
      : null,
    updatedBy: theme.updatedBy ? { id: theme.updatedBy.id, name: theme.updatedBy.name } : null,
  };
}

/** A name is required, and two themes may not share one. */
async function assertName(name, ignoreId = null) {
  const clean = String(name || "").trim();
  if (!clean) {
    const err = new Error("Give the theme a name.");
    err.status = 400;
    err.expose = true; // the wording is for the person, not the log
    throw err;
  }
  // Compared in JavaScript rather than in SQL, so "Berry" and "berry"
  // clash whatever the database's collation happens to be.
  const all = await Theme.findAll({ attributes: ["id", "name"] });
  const existing = all.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing && existing.id !== ignoreId) {
    const err = new Error(`A theme called “${clean}” already exists.`);
    err.status = 409;
    err.expose = true;
    throw err;
  }
  return clean;
}

/* ---------------------------- publishing ---------------------------- */

/**
 * Copies the look a form is being built with onto the live link. Called
 * when the form is published, and from the builder's "Update live form".
 *
 * A copy rather than a pointer: once published, editing the theme leaves
 * the live form alone until someone publishes again.
 */
async function publishLive(formId) {
  const link = await FormTheme.findOne({
    where: { formId },
    include: [{ model: Theme, as: "theme" }],
  });

  if (!link || !link.theme) {
    await FormLiveTheme.destroy({ where: { formId } });
    return null;
  }

  const snapshot = {
    themeId: link.theme.id,
    name: link.theme.name,
    config: link.theme.config || {},
  };

  const existing = await FormLiveTheme.findOne({ where: { formId } });
  if (existing) await existing.update(snapshot);
  else await FormLiveTheme.create({ formId, ...snapshot });

  return snapshot;
}

/** True when the form is wearing something the live link has not seen. */
async function liveIsBehind(formId) {
  try {
    const [link, live] = await Promise.all([
      FormTheme.findOne({ where: { formId }, include: [{ model: Theme, as: "theme" }] }),
      FormLiveTheme.findOne({ where: { formId } }),
    ]);

    const editing = link && link.theme ? JSON.stringify(link.theme.config || {}) : null;
    const published = live ? JSON.stringify(live.config || {}) : null;
    return editing !== published;
  } catch (err) {
    // Worth knowing about, but never worth failing the page for.
    console.warn("Could not compare the live design:", err.message);
    return false;
  }
}

/* ---------------------------- reading ---------------------------- */

/** Every theme, newest first, with how many forms wear each one. */
exports.list = speak("Loading the themes", async (req, res, next) => {
  try {
    /* No ORDER BY: a theme's config carries its logo and background as
       data URLs, and asking MySQL to sort rows that wide runs its sort
       buffer out of memory. */
    const rows = await Theme.findAll(withPeople);
    const themes = sortRows(rows, [["createdAt", "ASC"]]);
    const links = await FormTheme.findAll({ attributes: ["themeId"] });

    const counts = links.reduce((acc, link) => {
      acc[link.themeId] = (acc[link.themeId] || 0) + 1;
      return acc;
    }, {});

    return res.json({ themes: themes.map((t) => serialise(t, counts[t.id] || 0)) });
  } catch (err) {
    return next(err);
  }
});

/** The theme a particular form is wearing, if any. */
exports.forForm = speak("Reading this form's theme", async (req, res, next) => {
  try {
    const link = await FormTheme.findOne({
      where: { formId: req.params.formId },
      include: [{ model: Theme, as: "theme", ...withPeople }],
    });

    const behind = await liveIsBehind(req.params.formId);

    if (!link || !link.theme) return res.json({ themeId: null, theme: null, liveIsBehind: behind });
    return res.json({ themeId: link.themeId, theme: serialise(link.theme), liveIsBehind: behind });
  } catch (err) {
    return next(err);
  }
});

/* ---------------------------- writing ---------------------------- */

exports.create = speak("Saving a new theme", async (req, res, next) => {
  try {
    const name = await assertName(req.body.name);

    const theme = await Theme.create({
      name,
      tagline: req.body.tagline ? String(req.body.tagline).slice(0, 160) : null,
      config: req.body.config || {},
      createdById: req.user.id,
      updatedById: req.user.id,
    });

    await logActivity(req, {
      entityType: "theme",
      entityId: theme.id,
      entityName: theme.name,
      action: "created",
    });

    const full = await Theme.findByPk(theme.id, withPeople);
    return res.status(201).json({ theme: serialise(full) });
  } catch (err) {
    return next(err);
  }
});

/** Renames a theme, replaces its look, or both. */
exports.update = speak("Saving the theme", async (req, res, next) => {
  try {
    const theme = await Theme.findByPk(req.params.id);
    if (!theme) return res.status(404).json({ message: "Theme not found." });

    const patch = { updatedById: req.user.id };
    let action = "edited";
    let detail = null;

    if (req.body.name !== undefined) {
      const name = await assertName(req.body.name, theme.id);
      if (name !== theme.name) {
        action = "renamed";
        detail = `Renamed from “${theme.name}”`;
        patch.name = name;
      }
    }

    if (req.body.tagline !== undefined) {
      patch.tagline = req.body.tagline ? String(req.body.tagline).slice(0, 160) : null;
    }

    if (req.body.config !== undefined) patch.config = req.body.config || {};

    await theme.update(patch);

    await logActivity(req, {
      entityType: "theme",
      entityId: theme.id,
      entityName: theme.name,
      action,
      detail,
    });

    const full = await Theme.findByPk(theme.id, withPeople);
    const uses = await FormTheme.count({ where: { themeId: theme.id } });
    return res.json({ theme: serialise(full, uses) });
  } catch (err) {
    return next(err);
  }
});

/** Deleting a theme frees every form wearing it; the forms are untouched. */
exports.remove = speak("Deleting the theme", async (req, res, next) => {
  try {
    const theme = await Theme.findByPk(req.params.id);
    if (!theme) return res.status(404).json({ message: "Theme not found." });

    const uses = await FormTheme.count({ where: { themeId: theme.id } });
    const name = theme.name;

    await FormTheme.destroy({ where: { themeId: theme.id } });
    await theme.destroy();

    await logActivity(req, {
      entityType: "theme",
      entityId: req.params.id,
      entityName: name,
      action: "deleted",
      detail: uses ? `Was on ${uses} form${uses === 1 ? "" : "s"}` : null,
    });

    return res.json({ message: `“${name}” was deleted.` });
  } catch (err) {
    return next(err);
  }
});

/* ---------------------------- applying ---------------------------- */

/**
 * Puts a theme on a form, or takes it off again when themeId is null.
 * One form wears one theme, so the row is replaced rather than added to.
 */
exports.applyToForm = speak("Putting the theme on the form", async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.formId);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const { themeId } = req.body;

    if (themeId === null || themeId === undefined || themeId === "") {
      await FormTheme.destroy({ where: { formId: form.id } });
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: "Theme removed",
      });
      return res.json({ themeId: null, theme: null });
    }

    const theme = await Theme.findByPk(themeId, withPeople);
    if (!theme) return res.status(404).json({ message: "Theme not found." });

    const existing = await FormTheme.findOne({ where: { formId: form.id } });
    if (existing) await existing.update({ themeId: theme.id });
    else await FormTheme.create({ formId: form.id, themeId: theme.id });

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "edited",
      detail: `Theme set to “${theme.name}”`,
    });

    return res.json({ themeId: theme.id, theme: serialise(theme), liveIsBehind: true });
  } catch (err) {
    return next(err);
  }
});

/** PUT /api/themes/form/:formId/publish — put the look on the live link. */
exports.publishForForm = speak("Publishing the design", async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.formId);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const snapshot = await publishLive(form.id);

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "published",
      detail: snapshot ? `Live design set to “${snapshot.name}”` : "Live design removed",
    });

    return res.json({ live: snapshot, liveIsBehind: false });
  } catch (err) {
    return next(err);
  }
});

module.exports.serialise = serialise;
module.exports.publishLive = publishLive;
module.exports.liveIsBehind = liveIsBehind;