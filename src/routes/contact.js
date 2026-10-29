import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { contactSchema } from "../schemas/contact.js";

export function contactRouter({ contactRepository }) {
  const router = Router();

  // validate() s'exécute AVANT le handler : une requête invalide n'atteint jamais la base
  router.post("/", validate(contactSchema), async (req, res, next) => {
    try {
      const { name, email, message } = req.body; // données déjà validées
      const saved = await contactRepository.create({ name, email, message });
      res.status(201).json({ id: saved.id, status: "received" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
