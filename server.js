const timing = require('./lib/timing');



require('dotenv').config();

/*
 * Robuster Logger: Dupliziert alle stdout/stderr-Ausgaben in logs/server.log,
 * während die Konsolenausgabe erhalten bleibt.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const roleHelpers = require('./lib/roleHelpers');
try {
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'server.log');

  // Append-Stream für die Roh-Erfassung von stdout/stderr
  const logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });

  // Originale Funktionen sichern
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  // Schreibe Chunk in Datei und leite dann an Original-Stream weiter
  function writeAndFile(origWrite, chunk, encoding, cb) {
    try {
      if (typeof chunk === 'string' || chunk instanceof String) {
        logStream.write(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        logStream.write(chunk);
      } else {
        logStream.write(String(chunk));
      }
    } catch (e) {
      // Datei-Schreibfehler schlucken, damit stdout nie blockiert wird
    }
    return origWrite(chunk, encoding, cb);
  }

  process.stdout.write = /** @type {typeof process.stdout.write} */((chunk, encoding, cb) => writeAndFile(origStdoutWrite, chunk, encoding, cb));
  process.stderr.write = /** @type {typeof process.stderr.write} */((chunk, encoding, cb) => writeAndFile(origStderrWrite, chunk, encoding, cb));

  // Sicherstellen, dass der Stream beim Beenden geschlossen wird
  const closeLogStream = () => { try { logStream.end(); } catch (e) {} };
  process.on('exit', closeLogStream);
  process.on('SIGINT', () => { closeLogStream(); process.exit(0); });
  process.on('SIGTERM', () => { closeLogStream(); process.exit(0); });

} catch (e) {
  try { console.error('Logger-Initialisierung fehlgeschlagen:', e && e.message ? e.message : e); } catch (_) {}
}

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./config/db.js');
const MariaDBStore = require('./lib/mariadb-session-store');
const { redis, redisSub } = require('./lib/redis');

// Laufzeitumgebung erkennen
const isBun = typeof Bun !== 'undefined' || process.versions.bun;
console.log('🚀 Starte mit', isBun ? 'BUN + MariaDB' : 'Node + MariaDB');

const app = express();
const PORT = process.env.PORT || 3000;
// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/*
 * Request-Logger: Stellt sicher, dass jede HTTP-Anfrage protokolliert wird
 * (Methode, URL, Status, Dauer)
 */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const duration = Date.now() - start;
      console.log(`[req] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    } catch (e) {}
  });
  next();
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/*
 * Fehler-Logging-Middleware: Protokolliert unbehandelte Routen-Fehler
 */
app.use((err, req, res, next) => {
  try { console.error('[route-error] ', err && err.stack ? err.stack : err); } catch (e) {}
  next(err);
});

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: Die Umgebungsvariable SESSION_SECRET wird benötigt. Bitte in der Datei .env setzen.');
  process.exit(1);
}

const keyManager = require('./lib/keyManager');
const { pageCache } = require('./lib/cacheHelper');

/*
 * Wenn hinter einem Proxy (ngrok, Reverse Proxy), vertrauen wir dem ersten Proxy
 * für sichere Cookies
 */
if (process.env.TRUST_PROXIES === '1') app.set('trust proxy', 1);

const sessionStore = new MariaDBStore();

/*
 * Bestimmung des Secure-Cookie-Verhaltens:
 * - Im Entwicklungsmodus (localhost) niemals `secure: true` setzen,
 *   außer bei explizitem lokalen TLS-Test (Caddy).
 * - Many browsers blockieren SameSite=None ohne Secure.
 * - Secure=true nur bei aktivem TRUST_PROXIES (Proxy handhabt TLS).
 */
const isSecure = (process.env.TRUST_PROXIES === '1');

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Hinter Proxy (Caddy/Cloudflare) → SameSite=None + Secure
    // Lokal (direkter Zugriff) → Lax und Secure=false
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
  }
}));

console.log('SESSION COOKIE CONFIG:', {
  sameSite: isSecure ? 'none' : 'lax',
  secure: isSecure
});

/*
 * Optionales Session-Debug-Logging (aktivieren mit DEBUG_SESSIONS=1)
 */
if (process.env.DEBUG_SESSIONS === '1') {
  app.use((req, res, next) => {
    try { console.log('SESSION DEBUG:', { id: req.sessionID, cookie: req.session && req.session.cookie }); } catch (e) {}
    next();
  });
}

// Locals für Templates
app.use((req, res, next) => {
  res.locals.user = roleHelpers.normalizeUser(req.session.user);
  res.locals.authz = roleHelpers;
  res.locals.isBun = isBun;
  next();
});

// Health-Endpoint für Readiness/Liveness-Checks
app.get('/healthz', async (req, res) => {
  const status = { ok: true };
  try {
    status.redis = redis ? redis.status : 'missing';
  } catch (e) {
    status.redis = 'error';
  }
  try {
    // schneller DB-Ping
    await db.execute('SELECT 1');
    status.db = 'ok';
  } catch (e) {
    status.db = 'error';
    status.ok = false;
  }
  res.json(status);
});

/*
 * Einfache öffentliche Gate-Middleware:
 * Erfordert ein einmaliges Passwort für Startseite und Login-Seite.
 * Konfiguriere das Passwort über `PUBLIC_GATE_PASSWORD`.
 * Wenn nicht gesetzt → Gate deaktiviert.
 */
function gateMiddleware(req, res, next) {
  // Gate deaktiviert, wenn kein Passwort konfiguriert
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return next();

  // Bereits bestanden → weiter
  if (req.session && req.session.gatePassed) return next();

  // Nur GET-Anfragen für Root oder Auth-Seiten abfangen
  if (req.method === 'GET' && (req.path === '/' || req.path === '/users/auth' || req.path === '/users')) {
    return res.redirect(`/gate?back=${encodeURIComponent(req.originalUrl)}`);
  }

  return next();
}

// /gate-Routen vor den eigentlichen Anwendungs-Routen exponieren
app.get('/gate', (req, res) => {
  // Gate deaktiviert → direkt weiterleiten
  const backStr = /** @type {string} */(req.query.back) || '/';
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return res.redirect(backStr);
  res.render('gate', { title: 'Zugangscode erforderlich', back: backStr, error: null });
});

app.post('/gate', (req, res) => {
  const pw = (req.body && req.body.password) ? String(req.body.password) : '';
  const back = req.query.back || req.body.back || '/';
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return res.redirect(back);
  if (pw === process.env.PUBLIC_GATE_PASSWORD) {
    req.session.gatePassed = true;
    console.log('GATE: password ok; calling session.save (exists=', typeof req.session.save === 'function', ')');
    // Session explizit speichern vor Redirect (vermeidet Redirect-Loops bei asynchronen Stores)
    if (typeof req.session.save === 'function') {
      return req.session.save((err) => {
        console.log('GATE: session.save callback start');
        if (err) console.error('Session save error after gate pass:', err);
        // Kleines HTML mit client-seitigem Redirect senden (sichert Set-Cookie-Verarbeitung)
        const safeUrl = String(back).replace(/</g, '%3C').replace(/"/g, '%22');
        res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Weiterleitung</title></head><body><script>try{setTimeout(function(){window.location = decodeURIComponent("${encodeURIComponent(safeUrl)}")},150)}catch(e){window.location = "${safeUrl}"}</script><noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript></body></html>`);
      });
    } else {
      // Kein session.save verfügbar → trotzdem client-seitigen Redirect
      const safeUrl = String(back).replace(/</g, '%3C').replace(/"/g, '%22');
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Weiterleitung</title></head><body><script>try{setTimeout(function(){window.location = decodeURIComponent("${encodeURIComponent(safeUrl)}")},150)}catch(e){window.location = "${safeUrl}"}</script><noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript></body></html>`);
    }
  }
  // Falsches Passwort → mit Fehlermeldung neu rendern
  res.status(401).render('gate', { title: 'Zugangscode erforderlich', back: back, error: 'Falsches Passwort' });
});

// Gate-Middleware auf relevante Anfragen anwenden
app.use(gateMiddleware);


// Timing-Middleware wird selektiv auf performancerelevante Routen angewendet.
// `timing` wurde bereits früher required, um doppelte Deklarationen zu vermeiden.
const usersRoute = require('./routes/users');

// Routen — statische Seiten mit Cache (1 Stunde)
app.get("/", pageCache(30, { skip: r => r.session?.user?.id }), (req, res) => res.render("index", { title: "Ideenboard" }));
app.get("/impressum", pageCache(3600), (req, res) => res.render("legal/impressum"));
app.get("/datenschutz", pageCache(3600), (req, res) => res.render("legal/datenschutz"));
app.get("/agb", pageCache(3600), (req, res) => res.render("legal/agb"));
app.get("/kontakt", pageCache(3600), (req, res) => res.render("legal/kontakt"));
app.get("/dokumentation", pageCache(3600), (req, res) => res.render("dokumentation"));
app.get("/doku", pageCache(3600), (req, res) => res.render("doku"));

// Systemmeldung
app.get('/message', (req, res) => {
  const message = /** @type {string} */(req.query.msg) || 'Unbekannter Fehler';
  const backUrl = /** @type {string} */(req.query.back) || '/';
  const status = req.query.status ? parseInt(/** @type {string} */(req.query.status)) : 200;
  
  if (status >= 400) res.status(status);
  res.render('message', { 
    title: 'Systemmeldung', 
    message: decodeURIComponent(message), 
    backUrl: decodeURIComponent(backUrl) 
  });
});

// Ausgewählte Routen mit Timing-Middleware mounten
app.use('/ideas', /** @type {import('express').RequestHandler} */(timing('ideas')), require('./routes/ideas'));

/*
 * Debug-only öffentlicher Such-Endpoint (keine Auth) zur Diagnose der Such-Interna
 */
app.get('/search-debug', async (req, res) => {
  try {
    const ideasService = require('./lib/services/ideasService');
    const userId = 0;
    const result = await ideasService.fetchIdeas(userId, req.query || {});
    // DebugInfo loggen falls vorhanden
    try { console.log('[search-debug] /search-debug called', { q: req.query.q, debug_search: req.query.debug_search }); } catch (e) {}
    if (result && result.search && result.search.debugInfo) {
      try { console.log('[search-debug] debugInfo:', JSON.stringify(result.search.debugInfo)); } catch (e) {}
    }
    res.json({ ok: true, search: result.search || null, ideasCount: (result.ideas || []).length });
  } catch (e) {
    console.error('/search-debug error', e && e.message ? e.message : e);
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// Öffentliche Load-Test-Routen für Benchmarking ohne Auth (kein Timing)
app.use('/load-test', require('./routes/load_test'));

app.use('/projects', pageCache(15), /** @type {import('express').RequestHandler} */(timing('projects')), require('./routes/projects'));
app.use('/users', /** @type {import('express').RequestHandler} */(timing('users')), usersRoute);
app.use('/dashboard', pageCache(15), /** @type {import('express').RequestHandler} */(timing('dashboard')), require('./routes/dashboard.js'));
app.use('/adminPage', /** @type {import('express').RequestHandler} */(timing('adminPage')), require('./routes/adminPage.js'));
app.use('/dms', /** @type {import('express').RequestHandler} */(timing('dms')), require('./routes/dms.js'));
app.use('/surveys', pageCache(15), /** @type {import('express').RequestHandler} */(timing('surveys')), require('./routes/surveys.js'));
app.use('/groups', /** @type {import('express').RequestHandler} */(timing('groups')), require('./routes/groups.js'));


// 404-Seite
app.use((req, res) => res.status(404).render('404')); 

async function startServer() {
  if (process.env.WARMUP_ON_START === '1' || process.env.WARMUP_ON_START === 'true') {
    try {
      console.log('🔁 WARMUP_ON_START aktiviert — Index-Warmup wird ausgeführt');
      const warmup = /** @type {{ main?: () => Promise<void> }} */(require('./scripts/warmup_indexes'));
      if (warmup && warmup.main) await warmup.main();
    } catch (e) {
      console.warn('Warmup fehlgeschlagen, Starte trotzdem weiter:', e && e.message ? e.message : e);
    }
  }

  /*
   * Standard-Admin sicherstellen vor dem Akzeptieren von Verbindungen.
   * Gibt ein generiertes Einmal-Passwort aus, wenn `DEFAULT_ADMIN_PASSWORD` leer ist.
   */
  try {
    const usersWithAdmin = /** @type {import('express').Router & { ensureDefaultAdmin?: () => Promise<void> }} */(usersRoute);
    if (usersWithAdmin && typeof usersWithAdmin.ensureDefaultAdmin === 'function') {
      await usersWithAdmin.ensureDefaultAdmin();
    }
  } catch (e) {
    console.warn('Konnte Standard-Admin beim Start nicht sicherstellen:', e && e.message ? e.message : e);
  }

  // DB-Erreichbarkeit vor dem Start prüfen
  try {
    await db.execute('SELECT 1');
    console.log('DB: ping ok');
  } catch (e) {
    console.warn('DB ping failed — continuing start but sessions may be unstable:', e && e.message ? e.message : e);
  }

  // Server starten und Referenz für graceful shutdown behalten
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 ${isBun ? 'BUN' : 'Node'} + mariadb läuft auf http://0.0.0.0:${PORT}`);
    // Signal an Process-Manager (z.B. PM2) senden
    if (typeof process.send === 'function') {
      try { process.send('ready'); } catch (e) { /* ignore */ }
    }
  });

  // Für Bun: reusePort ermöglicht mehreren Prozessen denselben Port
  if (isBun) {
    console.log('🔧 Bun: Alle Prozesse teilen sich Port', PORT);
  }

  // Graceful Shutdown Helfer
  async function shutdown(signal) {
    console.log('Shutdown signal received:', signal);
    try {
      server.close(() => console.log('HTTP server closed'));
      if (sessionStore && typeof sessionStore.close === 'function') sessionStore.close();
      try {
        if (redis && typeof redis.quit === 'function') await redis.quit();
        else if (redis && typeof redis.disconnect === 'function') redis.disconnect();
      } catch (e) { console.warn('Error quitting redis:', e && e.message ? e.message : e); }
      try {
        if (redisSub && typeof redisSub.quit === 'function') await redisSub.quit();
        else if (redisSub && typeof redisSub.disconnect === 'function') redisSub.disconnect();
      } catch (e) { console.warn('Error quitting redisSub:', e && e.message ? e.message : e); }
      setTimeout(() => process.exit(0), 300);
    } catch (e) {
      console.error('Error during shutdown:', e && e.message ? e.message : e);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/*
 * Upload-Master-Key (verschlüsselt auf Platte) vor Server-Start initialisieren
 */
(async () => {
  try {
    await keyManager.init();
    await startServer();
  } catch (e) {
    console.error('Server konnte nicht gestartet werden:', e);
    process.exit(1);
  }
})();

// Hinweis: Event Scheduler wird nicht automatisch aktiviert. Bitte prüfen und ggf. manuell aktivieren.
// Prüfen: `SELECT @@event_scheduler;`
// Falls deaktiviert: `SET GLOBAL event_scheduler = ON;` (erfordert passende DB-Rechte)
console.log('Hinweis: Event Scheduler wird nicht automatisch aktiviert. Bitte prüfen Sie mit "SELECT @@event_scheduler;" und aktivieren Sie ihn ggf. manuell mit "SET GLOBAL event_scheduler = ON;".');