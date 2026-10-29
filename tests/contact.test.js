import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryContactRepository } from "../src/repositories/contactRepository.js";

const valid = { name: "Ada Lovelace", email: "ada@example.com", message: "Bonjour, ceci est un test." };

describe("POST /api/contact", () => {
  let repo;
  let app;
  beforeEach(() => {
    repo = createMemoryContactRepository();
    app = createApp({ contactRepository: repo });
  });

  it("accepte un message valide (201)", async () => {
    const res = await request(app).post("/api/contact").send(valid);
    expect(res.status).toBe(201);
    expect(repo.items).toHaveLength(1);
  });

  it("refuse un email invalide (400 VALIDATION_ERROR)", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, email: "pas-un-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "email" }));
    expect(repo.items).toHaveLength(0);
  });

  it("refuse un champ manquant", async () => {
    const { message, ...sansMessage } = valid;
    const res = await request(app).post("/api/contact").send(sansMessage);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "message" }));
  });

  it("refuse un champ supplémentaire (ex. isAdmin: true)", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body.details)).toContain("isAdmin");
    expect(repo.items).toHaveLength(0);
  });

  it("refuse un type inattendu (message: 42, name: ['a'])", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, message: 42, name: ["a"] });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toContain("message");
    expect(fields).toContain("name");
  });

  it("refuse un JSON mal formé (400 INVALID_JSON)", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send('{"name": "Ada",'); // JSON tronqué
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_JSON" });
  });

  it("refuse un corps de plus de 10 ko (413)", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ ...valid, message: "x".repeat(11 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "PAYLOAD_TOO_LARGE" });
  });

  it("stocke tel quel un nom contenant une tentative d'injection SQL", async () => {
    const injection = "Robert'); DROP TABLE contacts;--";
    const res = await request(app).post("/api/contact").send({ ...valid, name: injection });
    expect(res.status).toBe(201);
    expect(repo.items[0].name).toBe(injection);
  });

  it("ne renvoie jamais de stack trace en cas d'erreur 500", async () => {
    const secret = "connexion refusée : password=SuperSecret sur db-interne:5432";
    const brokenRepo = { create: async () => { throw new Error(secret); } };
    const brokenApp = createApp({ contactRepository: brokenRepo });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {}); // évite le bruit dans la sortie

    const res = await request(brokenApp).post("/api/contact").send(valid);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "INTERNAL_ERROR" });
    expect(res.text).not.toContain("stack");
    expect(res.text).not.toContain(secret);
    expect(spy).toHaveBeenCalled(); // l'erreur est bien journalisée côté serveur
    spy.mockRestore();
  });

  it("ajoute les headers de sécurité Helmet (x-content-type-options, ...)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("ne renvoie pas le header x-powered-by", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("répond 429 après trop de requêtes sur /api/contact", async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post("/api/contact").send(valid);
      expect(ok.status).toBe(201);
    }
    const res = await request(app).post("/api/contact").send(valid);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "TOO_MANY_REQUESTS" });
    expect(res.headers["ratelimit-policy"]).toBeDefined();
  });

  it("répond 404 en JSON sur une route inconnue", async () => {
    const res = await request(app).get("/api/inexistante");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });
});
