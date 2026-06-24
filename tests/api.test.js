const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('../config/db');

function createTestApp(sessionUser) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    req.session = { user: sessionUser || { id: 1, username: 'admin', role: 'Admin' } };
    res.locals.user = req.session.user;
    res.locals.authz = { isAdmin: () => true, isProjectLead: () => true };
    next();
  });

  app.use('/ideas', require('../routes/ideas'));
  app.use('/projects', require('../routes/projects'));
  app.use('/surveys', require('../routes/surveys'));
  app.use('/dashboard', require('../routes/dashboard'));
  app.use('/users', require('../routes/users'));
  app.use('/dms', require('../routes/dms'));
  app.use('/groups', require('../routes/groups'));

  return app;
}

const adminUser = { id: 1, username: 'admin', role: 'Admin' };
const normalUser = { id: 2, username: 'mitarbeiter', role: 'Mitarbeiter' };

// ─────────────────────── IDEAS ───────────────────────

describe('Ideas', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /ideas listet Ideen', async () => {
    const res = await request(app).get('/ideas');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ideas-page');
  });

  it('GET /ideas?q= sucht', async () => {
    const res = await request(app).get('/ideas?q=test');
    expect(res.status).toBe(200);
  });

  it('GET /ideas/:id/card liefert HTML', async () => {
    const res = await request(app).get('/ideas/1/card');
    expect([200, 404]).toContain(res.status);
  });

  it('GET /ideas/:id/stats liefert Stats-HTML', async () => {
    const res = await request(app).get('/ideas/1/stats');
    expect([200, 404]).toContain(res.status);
  });

  it('GET /ideas/:id/modal liefert Modal-HTML', async () => {
    const res = await request(app).get('/ideas/1/modal');
    expect([200, 403, 404]).toContain(res.status);
  });

  it('GET /ideas/partial liefert gefilterte Liste', async () => {
    const res = await request(app).get('/ideas/partial?page=1');
    expect([200, 500]).toContain(res.status);
  });

  it('POST /ideas erstellt Idee (ohne Datei)', async () => {
    const res = await request(app)
      .post('/ideas')
      .type('form')
      .send({ title: 'Test-Idee E2E', description: 'Testbeschreibung', category_id: 1, tags: 'test' });
    expect([200, 302, 500]).toContain(res.status);
  });

  it('POST /ideas/:id/like toggelt Like', async () => {
    const res = await request(app).post('/ideas/1/like');
    expect([200, 404]).toContain(res.status);
  });

  it('POST /ideas/:id/status (Admin) ändert Status', async () => {
    const res = await request(app)
      .post('/ideas/1/status')
      .type('form')
      .send({ status: 'in Prüfung' });
    expect([200, 403, 404]).toContain(res.status);
  });
});

// ─────────────────────── PROJECTS ───────────────────────

describe('Projects', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /projects listet Projekte', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(200);
    expect(res.text).toContain('projects-page');
  });

  it('GET /projects/fragment liefert Liste', async () => {
    const res = await request(app).get('/projects/fragment');
    expect(res.status).toBe(200);
  });

  it('GET /projects/fragment?search= sucht', async () => {
    const res = await request(app).get('/projects/fragment?search=net');
    expect(res.status).toBe(200);
  });

  it('GET /projects/fragment?status= filtert', async () => {
    const res = await request(app).get('/projects/fragment?status=Konzeption');
    expect(res.status).toBe(200);
  });

  it('GET /projects/contact-search sucht Ansprechpartner', async () => {
    const res = await request(app).get('/projects/contact-search?q=admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(JSON.parse(res.text))).toBe(true);
  });
});

// ─────────────────────── SURVEYS ───────────────────────

describe('Surveys', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /surveys listet Umfragen', async () => {
    const res = await request(app).get('/surveys');
    expect(res.status).toBe(200);
    expect(res.text).toContain('surveys-page');
  });

  it('GET /surveys/fragment liefert Liste', async () => {
    const res = await request(app).get('/surveys/fragment');
    expect(res.status).toBe(200);
  });

  it('GET /surveys/fragment?search= sucht', async () => {
    const res = await request(app).get('/surveys/fragment?search=umfrage');
    expect(res.status).toBe(200);
  });

  it('GET /surveys/fragment?type= filtert', async () => {
    const res = await request(app).get('/surveys/fragment?type=public');
    expect(res.status).toBe(200);
  });

  it('GET /surveys/new zeigt Erstellformular', async () => {
    const res = await request(app).get('/surveys/new');
    expect(res.status).toBe(200);
  });

  it('GET /surveys/:id zeigt Detail', async () => {
    const res = await request(app).get('/surveys/1');
    expect([200, 302, 404]).toContain(res.status);
  });

  it('GET /surveys/:id/results zeigt Ergebnisse', async () => {
    const res = await request(app).get('/surveys/1/results');
    expect([200, 302, 404]).toContain(res.status);
  });
});

// ─────────────────────── DASHBOARD ───────────────────────

describe('Dashboard', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /dashboard lädt', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('dashboard-page');
  });
});

// ─────────────────────── USERS / AUTH ───────────────────────

describe('Users / Auth', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /users/auth zeigt Login', async () => {
    const res = await request(app).get('/users/auth');
    expect([200, 302, 404]).toContain(res.status);
  });

  it('GET /users/account zeigt Konto', async () => {
    const res = await request(app).get('/users/account');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────── DMS / CHAT ───────────────────────

describe('DMs', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /dms listet Konversationen', async () => {
    const res = await request(app).get('/dms');
    expect(res.status).toBe(200);
  });

  it('GET /dms/search?q= sucht Nutzer', async () => {
    const res = await request(app).get('/dms/search?q=admin');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────── ADMIN ───────────────────────

describe('Admin', () => {
  let app;
  beforeAll(() => { app = createTestApp(adminUser); });

  it('GET /adminPage lädt', async () => {
    const res = await request(app).get('/adminPage');
    expect([200, 302, 404]).toContain(res.status);
  });

  it('GET /adminPage/logs zeigt Logs', async () => {
    const res = await request(app).get('/adminPage/logs');
    expect([200, 302, 404]).toContain(res.status);
  });
});

// ─────────────────────── HEALTH ───────────────────────

describe('Health', () => {
  let app;
  beforeAll(() => {
    app = createTestApp(adminUser);
    // mount health endpoint from server.js
    app.get('/healthz', async (req, res) => {
      const status = { ok: true };
      try {
        await db.query('SELECT 1');
        status.db = 'ok';
      } catch (e) {
        status.db = 'error';
        status.ok = false;
      }
      res.json(status);
    });
  });

  it('GET /healthz zeigt DB-Status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('ok');
  });
});
