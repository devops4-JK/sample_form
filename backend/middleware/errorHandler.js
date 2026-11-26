/* eslint-disable no-unused-vars */
function notFound(req, res) {
  res.status(404).json({ message: "Not found." });
}

/**
 * The one place an error becomes a response. Only messages written for the
 * person using the app ever leave the server; everything else is logged
 * here and answered with a plain "something went wrong", so a stack trace,
 * a file path or a line of SQL can never reach a browser.
 */
function errorHandler(err, req, res, next) {
  // A request that is too big, or is not valid JSON, is the sender's mistake.
  if (err.type === "entity.too.large") {
    return res
      .status(413)
      .json({ message: "That is too large to save. Use smaller pictures and try again." });
  }
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ message: "The request could not be read." });
  }

  /* A refusal with a message written for the user (a 400 from a check) is
     routine and not worth a stack trace in the log. Everything else is. */
  const expected = err.expose && err.status && err.status < 500;
  if (!expected) console.error(err);

  if (err.name === "SequelizeUniqueConstraintError") {
    return res
      .status(409)
      .json({ message: "That email address is already registered." });
  }

  res.status(err.status || 500).json({
    message: err.expose ? err.message : "Something went wrong on our side.",
  });
}

module.exports = { notFound, errorHandler };