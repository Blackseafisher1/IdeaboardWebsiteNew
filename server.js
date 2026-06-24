const timing = require('./lib/timing');


// server.js - PERFECT Hybrid (Bun + Node + mariadb 44ms - NO CRASH!)
require('dotenv').config();

// Robust logger: duplicate all stdout/stderr to logs/server.log while keeping console output
const fs = require('fs');
const path = require('path');
const os = require('os');
const roleHelpers = require('./lib/roleHelpers');
try {
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'server.log');

  // Append stream for raw stdout/stderr capture
  const logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });

  // Preserve originals
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  // Write chunk to file then forward to original stream
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
      // Swallow file write errors so stdout is never blocked
    }
    return origWrite(chunk, encoding, cb);
  }

  process.stdout.write = (chunk, encoding, cb) => writeAndFile(origStdoutWrite, chunk, encoding, cb);
  process.stderr.write = (chunk, encoding, cb) => writeAndFile(origStderrWrite, chunk, encoding, cb);

  // Ensure the stream is closed on exit
  const closeLogStream = () => { try { logStream.end(); } catch (e) {} };
  process.on('exit', closeLogStream);
  process.on('SIGINT', () => { closeLogStream(); process.exit(0); });
  process.on('SIGTERM', () => { closeLogStream(); process.exit(0); });

} catch (e) {
  try { console.error('Logger init failed:', e && e.message ? e.message : e); } catch (_) {}
}

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./config/db.js');
const MariaDBStore = require('./lib/mariadb-session-store');
const { redis, redisSub } = require('./lib/redis');

// Detect runtime
const isBun = typeof Bun !== 'undefined' || process.versions.bun;
console.log('🚀 Starte mit', isBun ? 'BUN + MariaDB' : 'Node + MariaDB');

const app = express();
const PORT = process.env.PORT || 3000;
// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Mount timing and request-logging early so static files and all routes are measured

//app.use(timing('global'));
// Request logger: ensures every HTTP request is logged (method, url, status, duration)
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

// Error logging middleware: log uncaught route errors
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


// If behind a proxy (ngrok, reverse proxy), trust first proxy for secure cookies
if (process.env.TRUST_PROXIES === '1') app.set('trust proxy', 1);

const sessionStore = new MariaDBStore();

// Determine secure cookie behavior
// Fixed: In development mode (localhost), cookies should never be 'secure: true' 
// unless we are specifically testing with local TLS (Caddy).
// However, many browsers block SameSite=None without Secure.
// We only use Secure=true if TRUST_PROXIES is active, which implies a proxy handles TLS.
const isSecure = (process.env.TRUST_PROXIES === '1');

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // If we are behind a proxy (Caddy/Cloudflare), we use SameSite=None + Secure.
    // Locally (direct access), we use Lax and Secure=false.
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

console.log('SESSION COOKIE CONFIG:', {
  sameSite: isSecure ? 'none' : 'lax',
  secure: isSecure
});

// Optional session debug logging (enable with DEBUG_SESSIONS=1)
if (process.env.DEBUG_SESSIONS === '1') {
  app.use((req, res, next) => {
    try { console.log('SESSION DEBUG:', { id: req.sessionID, cookie: req.session && req.session.cookie }); } catch (e) {}
    next();
  });
}

// Locals
app.use((req, res, next) => {
  res.locals.user = roleHelpers.normalizeUser(req.session.user);
  res.locals.authz = roleHelpers;
  res.locals.isBun = isBun;
  next();
});

// Health endpoint for readiness/liveness checks
app.get('/healthz', async (req, res) => {
  const status = { ok: true };
  try {
    status.redis = redis ? redis.status : 'missing';
  } catch (e) {
    status.redis = 'error';
  }
    try {
    // quick DB ping
    await db.execute('SELECT 1');
    status.db = 'ok';
  } catch (e) {
    status.db = 'error';
    status.ok = false;
  }
  res.json(status);
});

// Simple public gate middleware: require a one-time password for homepage and login page
// Configure the gate password with env `PUBLIC_GATE_PASSWORD`. If not set, gate is disabled.
function gateMiddleware(req, res, next) {
  // Gate disabled if no password configured
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return next();

  // Allow when session already passed the gate
  if (req.session && req.session.gatePassed) return next();

  // Only intercept GET requests for root or the auth page
  if (req.method === 'GET' && (req.path === '/' || req.path === '/users/auth' || req.path === '/users')) {
    return res.redirect(`/gate?back=${encodeURIComponent(req.originalUrl)}`);
  }

  return next();
}

// Expose /gate routes before mounting application routes
app.get('/gate', (req, res) => {
  // If gate disabled, shortcut
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return res.redirect(req.query.back || '/');
  res.render('gate', { title: 'Zugangscode erforderlich', back: req.query.back || '/' , error: null });
});

app.post('/gate', (req, res) => {
  const pw = (req.body && req.body.password) ? String(req.body.password) : '';
  const back = req.query.back || req.body.back || '/';
  if (!process.env.PUBLIC_GATE_PASSWORD || process.env.PUBLIC_GATE_PASSWORD.length === 0) return res.redirect(back);
  if (pw === process.env.PUBLIC_GATE_PASSWORD) {
    req.session.gatePassed = true;
    console.log('GATE: password ok; calling session.save (exists=', typeof req.session.save === 'function', ')');
    // Ensure session is saved before redirecting (avoids redirect loops on async stores)
    if (typeof req.session.save === 'function') {
      return req.session.save((err) => {
        console.log('GATE: session.save callback start');
        if (err) console.error('Session save error after gate pass:', err);
        // Send a small HTML response that performs a client-side redirect.
        // This ensures the browser processes Set-Cookie before navigating.
        const safeUrl = String(back).replace(/</g, '%3C').replace(/"/g, '%22');
        res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Weiterleitung</title></head><body><script>try{setTimeout(function(){window.location = decodeURIComponent("${encodeURIComponent(safeUrl)}")},150)}catch(e){window.location = "${safeUrl}"}</script><noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript></body></html>`);
      });
    } else {
      // No session.save available — still send client-side redirect to allow cookie processing.
      const safeUrl = String(back).replace(/</g, '%3C').replace(/"/g, '%22');
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Weiterleitung</title></head><body><script>try{setTimeout(function(){window.location = decodeURIComponent("${encodeURIComponent(safeUrl)}")},150)}catch(e){window.location = "${safeUrl}"}</script><noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript></body></html>`);
    }
  }
  // wrong password: re-render with error
  res.status(401).render('gate', { title: 'Zugangscode erforderlich', back: back, error: 'Falsches Passwort' });
});

// Apply gate middleware to relevant incoming requests
app.use(gateMiddleware);



// Timing middleware is applied selectively to heavy routes below.
// `timing` is required and mounted earlier to avoid duplicate declarations.
const usersRoute = require('./routes/users');



// Routes — static pages cached 1 hour
app.get("/", pageCache(30, { skip: r => r.session?.user?.id }), (req, res) => res.render("index", { title: "Ideenboard" }));
app.get("/impressum", pageCache(3600), (req, res) => res.render("legal/impressum"));
app.get("/datenschutz", pageCache(3600), (req, res) => res.render("legal/datenschutz"));
app.get("/agb", pageCache(3600), (req, res) => res.render("legal/agb"));
app.get("/kontakt", pageCache(3600), (req, res) => res.render("legal/kontakt"));
app.get("/dokumentation", pageCache(3600), (req, res) => res.render("dokumentation"));
app.get("/doku", pageCache(3600), (req, res) => res.render("doku"));

// Message
app.get('/message', (req, res) => {
  const message = req.query.msg || 'Unbekannter Fehler';
  const backUrl = req.query.back || '/';
  const status = req.query.status ? parseInt(req.query.status) : 200;
  
  if (status >= 400) res.status(status);
  res.render('message', { 
    title: 'Systemmeldung', 
    message: decodeURIComponent(message), 
    backUrl: decodeURIComponent(backUrl) 
  });
});

// MOUNT SELECTED ROUTES WITH TIMING MIDDLEWARE
app.use('/ideas', timing('ideas'), require('./routes/ideas'));

// Debug-only public search endpoint (no auth) to help diagnose search internals
app.get('/search-debug', async (req, res) => {
  try {
    const ideasService = require('./lib/services/ideasService');
    const userId = 0;
    const result = await ideasService.fetchIdeas(userId, req.query || {});
    // Log debugInfo if present
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

// Public load-test routes for benchmarking without auth (no timing)
app.use('/load-test', require('./routes/load_test'));

app.use('/projects', pageCache(15), timing('projects'), require('./routes/projects'));
app.use('/users', timing('users'), usersRoute);
app.use('/dashboard', pageCache(15), timing('dashboard'), require('./routes/dashboard.js'));
app.use('/adminPage', timing('adminPage'), require('./routes/adminPage.js'));
app.use('/dms', timing('dms'), require('./routes/dms.js'));
app.use('/surveys', pageCache(15), timing('surveys'), require('./routes/surveys.js'));
app.use('/groups', timing('groups'), require('./routes/groups.js'));


// 404
app.use((req, res) => res.status(404).render('404')); 

// UNIFIED SERVER - Express everywhere!
async function startServer() {
  if (process.env.WARMUP_ON_START === '1' || process.env.WARMUP_ON_START === 'true') {
    try {
      console.log('🔁 WARMUP_ON_START aktiviert — Index-Warmup wird ausgeführt');
      const warmup = require('./scripts/warmup_indexes');
      if (warmup && warmup.main) await warmup.main();
    } catch (e) {
      console.warn('Warmup fehlgeschlagen, Starte trotzdem weiter:', e && e.message ? e.message : e);
    }
  }

  // Ensure default admin exists before accepting connections. This prints a
  // generated one-time password when `DEFAULT_ADMIN_PASSWORD` is empty.
  try {
    if (usersRoute && typeof usersRoute.ensureDefaultAdmin === 'function') {
      await usersRoute.ensureDefaultAdmin();
    }
  } catch (e) {
    console.warn('Konnte Standard-Admin beim Start nicht sicherstellen:', e && e.message ? e.message : e);
  }

  // Ensure DB is reachable before listening (helps PM2 cluster workers start only when store available)
  try {
    await db.execute('SELECT 1');
    console.log('DB: ping ok');
  } catch (e) {
    console.warn('DB ping failed — continuing start but sessions may be unstable:', e && e.message ? e.message : e);
  }

  // Start the server and keep a reference for graceful shutdown
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ${isBun ? 'BUN' : 'Node'} + mariadb läuft auf http://0.0.0.0:${PORT}`);
    // If running under a process manager that waits for a ready signal, notify it
    if (typeof process.send === 'function') {
      try { process.send('ready'); } catch (e) { /* ignore */ }
    }
  });

  // NUR FÜR BUN: reusePort aktivieren!
  if (isBun) {
  server.reusePort = true;  
  console.log('🔧 Bun reusePort aktiviert - alle Prozesse teilen sich Port', PORT);
  }

  // Graceful shutdown helper
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

// Prompt for upload master key (wrapped on disk) before starting server
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
