import { z } from "zod";

// Schéma strict du formulaire de contact
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    message: z.string().trim().min(10).max(2000),
  })
  .strict(); // refuse tout champ en plus (ex. isAdmin) -> OWASP API3
