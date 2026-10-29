/**
 * Middleware générique de validation avec Zod.
 * Échec -> 400 { error: "VALIDATION_ERROR", details: [{ field, message }] }
 * Succès -> req.body est remplacé par les données validées et nettoyées.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || (issue.keys ? issue.keys.join(",") : "body"),
      message: issue.message,
    }));
    return res.status(400).json({ error: "VALIDATION_ERROR", details });
  }

  req.body = result.data;
  next();
};
