const { redis } = require('./redis');

function isReady() {
  return redis && redis.status === 'ready';
}

async function get(key) {
  if (!isReady()) return null;
  try {
    const val = await redis.get(key);
    if (val === null) return null;
    try { return JSON.parse(val); } catch (e) { return val; }
  } catch (e) {
    return null;
  }
}

async function set(key, value, ttl) {
  if (!isReady()) return;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    if (ttl > 0) await redis.setex(key, ttl, str);
    else await redis.set(key, str);
  } catch (e) {}
}

async function del(key) {
  if (!isReady()) return;
  try { await redis.del(key); } catch (e) {}
}

async function delPattern(pattern) {
  if (!isReady()) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  } catch (e) {}
}

async function wrap(key, ttl, fetchFn) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const value = await fetchFn();
  await set(key, value, ttl);
  return value;
}

function pageCache(ttl, options = {}) {
  const { keyPrefix = 'page', skip = () => false } = options;

  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.headers['hx-request'] === 'true') return next();
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) return next();
    if (skip(req)) return next();

    const userId = req.session?.user?.id || 'anon';
    const key = `${keyPrefix}:${userId}:${req.originalUrl}`;

    get(key).then(cached => {
      if (cached) {
        try {
          const { html, statusCode, headers } = cached;
          if (headers) {
            for (const [k, v] of Object.entries(headers)) {
              if (k !== 'set-cookie') res.setHeader(k, v);
            }
          }
          res.status(statusCode || 200).send(html);
          return;
        } catch (e) {}
      }

      const originalSend = res.send.bind(res);
      const originalRender = res.render.bind(res);
      let sent = false;

      res.send = (body) => {
        if (sent) return;
        sent = true;
        if (res.statusCode < 400 && !res.headersSent) {
          set(key, { html: body, statusCode: res.statusCode }, ttl);
        }
        originalSend(body);
      };

      res.render = (view, data, cb) => {
        if (typeof data === 'function') { cb = data; data = {}; }
        if (typeof cb === 'function') {
          return originalRender(view, data, cb);
        }
        originalRender(view, data, (err, html) => {
          if (err) {
            res.status(500).send('Render error');
            return;
          }
          if (res.statusCode < 400) {
            set(key, { html, statusCode: res.statusCode || 200 }, ttl);
          }
          res.send(html);
        });
      };

      next();
    }).catch(() => next());
  };
}

module.exports = { get, set, del, delPattern, wrap, pageCache, isReady };
