import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app.js";
import { createPgContactRepository } from "../../src/repositories/contactRepository.js";

// Prérequis : docker compose up -d --wait && npm run migrate (variables PG* exportées).
describe("Intégration API ↔ PostgreSQL", () => {
  let pool;
  let app;

  beforeAll(() => {
    pool = new pg.Pool();
    app = createApp({ contactRepository: createPgContactRepository(pool) });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enregistre un contact dans PostgreSQL", async () => {
    const contact = {
      name: "Grace Hopper",
      email: `grace.${Date.now()}@example.com`,
      message: "Test d'intégration avec une vraie base.",
    };
    const res = await request(app).post("/api/contact").send(contact);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("received");

    const { rows } = await pool.query(
      "SELECT name, email, message FROM contacts WHERE id = $1",
      [res.body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(contact);
  });

  it("résiste à une tentative d'injection SQL", async () => {
    const injection = "Robert'); DROP TABLE contacts;--";
    const res = await request(app)
      .post("/api/contact")
      .send({ name: injection, email: "bobby@example.com", message: "Little Bobby Tables" });
    expect(res.status).toBe(201);

    const table = await pool.query("SELECT to_regclass('public.contacts') AS t");
    expect(table.rows[0].t).toBe("contacts");

    const { rows } = await pool.query("SELECT name FROM contacts WHERE id = $1", [res.body.id]);
    expect(rows[0].name).toBe(injection);
  });

  it("a bien appliqué la migration 002 (index sur email)", async () => {
    const { rows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'contacts' AND indexname = 'contacts_email_idx'"
    );
    expect(rows).toHaveLength(1);
  });
});
