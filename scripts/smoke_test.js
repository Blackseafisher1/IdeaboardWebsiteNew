/**
 * Smoke Test Script
 * Fires GET requests to various application pages with different parameters.
 * 
 * Usage: 
 *   node scripts/smoke_test.js [baseUrl] [sessionCookie]
 * 
 * Example:
 *   node scripts/smoke_test.js http://localhost:3000
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Normalize argv (skip node/bun and script path)
const argv = process.argv.slice(2);

// Helper to read flags in two forms: --key=value or --key value
function getArgFlag(name) {
    const withEq = argv.find(a => a.startsWith(`--${name}=`));
    if (withEq) return withEq.split('=')[1];
    const idx = argv.indexOf(`--${name}`);
    if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1];
    return undefined;
}

// BASE_URL: CLI first non-flag, then env, then default
const firstNonFlag = argv.find(a => !a.startsWith('--'));
let BASE_URL = firstNonFlag || process.env.BASE_URL || 'http://localhost:3000';

// SESSION_COOKIE: env or argument after BASE_URL
let SESSION_COOKIE = process.env.SESSION_COOKIE || '';
if (firstNonFlag) {
    const idx = argv.indexOf(firstNonFlag);
    const next = argv[idx + 1];
    if (next && !next.startsWith('--')) SESSION_COOKIE = next;
}

// Credentials: prefer explicit flags, then env
const EMAIL = getArgFlag('email') || process.env.EMAIL;
let PASSWORD = getArgFlag('password') || process.env.PASSWORD;

// Fallback for password if user wrote --123456 or just 123456
if (!PASSWORD) {
    const weirdPass = argv.find(a => /^--\d+$/.test(a));
    if (weirdPass) PASSWORD = weirdPass.substring(2);
}

// Optionally use the first session from the DB instead of logging in
const USE_FIRST_SESSION = getArgFlag('use-first-session') || process.env.USE_FIRST_SESSION;
async function tryLoadFirstSessionFromDb() {
    if (!USE_FIRST_SESSION) return;
    try {
        const db = require('../config/db.js');
        const rows = await db.query('SELECT sid, sess, expires FROM sessions WHERE expires > NOW() LIMIT 1');
        const res = db.normalizeQueryResult(rows);
        if (res && res.length && res[0].sid) {
            const sid = res[0].sid;
            // express-session default cookie name is 'connect.sid'
            SESSION_COOKIE = `connect.sid=${sid}`;
            console.log('🍪 Using session from DB:', SESSION_COOKIE.substring(0, 30) + '...');
        }
    } catch (e) {
        console.warn('Could not load session from DB:', e && e.message ? e.message : e);
    }
}

// Only hit the landing page (root) as requested
const ROUTES = ['/'];

// Parameter sets for the landing page; remove any search/query ('q') variants
const PARAM_SETS = [
    {}, // Default
    { sort: 'latest' },
    { sort: 'likes' },
    { page: '2' }
];

// Repeat each route+param combination this many times. Use --repeat=NUMBER or env REPEAT
const REPEAT = Number(getArgFlag('repeat') || process.env.REPEAT || 1);

// Concurrency: number of parallel workers
const CONCURRENCY = Number(getArgFlag('concurrency') || process.env.CONCURRENCY || 10);
// TOTAL requests to send (overrides REPEAT if set). 0 = use all combos * REPEAT
const TOTAL = Number(getArgFlag('total') || process.env.TOTAL || 0);
// RATE: approximate total requests per second (coarse). 0 = unlimited
const RATE = Number(getArgFlag('rate') || process.env.RATE || 0);

async function postRequest(path, data, currentCookie = '') {
    return new Promise((resolve) => {
        const urlObj = new URL(path, BASE_URL);
        const postData = new URLSearchParams(data).toString();
        
        const client = urlObj.protocol === 'https:' ? https : http;
        const req = client.request({
            hostname: urlObj.hostname,
            port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': currentCookie
            }
        }, (res) => {
                const cookies = res.headers['set-cookie'];
                let newCookie = currentCookie;

                if (cookies) {
                    const sessionCookie = cookies.find(c => c.startsWith('connect.sid'));
                    if (sessionCookie) newCookie = sessionCookie.split(';')[0];
                }

                // If server redirected (302) but didn't set cookie on that response,
                // follow the Location once to capture Set-Cookie from the follow-up.
                if ((res.statusCode === 302 || res.statusCode === 301) && !cookies && res.headers.location) {
                    const followUrl = new URL(res.headers.location, urlObj);
                    const followClient = followUrl.protocol === 'https:' ? https : http;
                    const followReq = followClient.get(followUrl.toString(), {
                        headers: { 'Cookie': currentCookie }
                    }, (followRes) => {
                        const followCookies = followRes.headers['set-cookie'];
                        if (followCookies) {
                            const sessionCookie = followCookies.find(c => c.startsWith('connect.sid'));
                            if (sessionCookie) newCookie = sessionCookie.split(';')[0];
                        }
                        // Drain body
                        followRes.on('data', () => {});
                        followRes.on('end', () => resolve({ status: res.statusCode, cookie: newCookie }));
                    });
                    followReq.on('error', () => resolve({ status: res.statusCode, cookie: newCookie }));
                    return;
                }

                resolve({ status: res.statusCode, cookie: newCookie });
        });

        req.on('error', (err) => {
            console.error(`❌ POST error (${path}): ${err.message}`);
            resolve({ status: 500, cookie: currentCookie });
        });

        req.write(postData);
        req.end();
    });
}

async function login(email, password, currentCookie = '') {
    console.log(`🔑 Attempting login for ${email}...`);
    const res = await postRequest('/users/auth', { email, password }, currentCookie);
    if (res.status === 302 || res.status === 200) {
        if (res.cookie && res.cookie !== currentCookie) {
            console.log('✅ Login successful, session cookie obtained.');
            return res.cookie;
        }
    }
    console.log(`⚠️ Login failed (Status: ${res.status}). Continuing as guest.`);
    return currentCookie;
}

async function passGate(gatePassword, currentCookie = '') {
    console.log(`🚪 Attempting to pass public gate...`);
    const res = await postRequest('/gate', { password: gatePassword }, currentCookie);
    if (res.status === 302 || res.status === 200) {
        console.log('✅ Gate passed.');
        return res.cookie;
    }
    console.log(`⚠️ Gate password rejected (Status: ${res.status}).`);
    return currentCookie;
}

async function request(urlpath, params = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(urlpath, BASE_URL);
        Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));

        const start = Date.now();
        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.get(urlObj.toString(), {
            headers: {
                'Cookie': SESSION_COOKIE
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                resolve({
                    url: urlObj.toString(),
                    status: res.statusCode,
                    duration: duration,
                    contentLength: data.length,
                    location: res.headers.location
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                url: urlObj.toString(),
                error: err.message,
                duration: Date.now() - start
            });
        });
    });
}

async function run() {
    console.log(`🚀 Starting Smoke Test on ${BASE_URL}`);

    // If requested, try to load a session from the DB before attempting login
    await tryLoadFirstSessionFromDb();

    if (!SESSION_COOKIE && EMAIL && PASSWORD) {
        SESSION_COOKIE = await login(EMAIL, PASSWORD, SESSION_COOKIE);
    }

    if (SESSION_COOKIE) console.log(`🍪 Using session: ${SESSION_COOKIE.substring(0, 30)}...`);
    console.log('------------------------------------------------------------');
    console.log(`STATUS | DURATION | SIZE     | ROUTE`);
    console.log('------------------------------------------------------------');

    let totalRequests = 0;
    let failures = 0;

    // Build task list (route + params) according to REPEAT or TOTAL
    const combos = [];
    for (const route of ROUTES) {
        for (const params of PARAM_SETS) {
            combos.push({ route, params });
        }
    }

    // expand by REPEAT
    let tasks = [];
    for (const c of combos) {
        for (let i = 0; i < REPEAT; i++) tasks.push(c);
    }

    // If TOTAL specified, cycle combos until we reach TOTAL
    if (TOTAL > 0) {
        tasks = [];
        let idx = 0;
        while (tasks.length < TOTAL) {
            tasks.push(combos[idx % combos.length]);
            idx++;
        }
    }

    // Simple shuffle to spread load
    for (let i = tasks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
    }

    // Shared rate limiter state
    let lastRequestTime = 0;
    const minInterval = RATE > 0 ? Math.max(1, Math.floor(1000 / RATE)) : 0;

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // Worker pool
    const queue = tasks.slice();

    async function worker(id) {
        while (true) {
            const task = queue.shift();
            if (!task) return;

            // Rate limiting (coarse): ensure at least minInterval between requests
            if (minInterval > 0) {
                const now = Date.now();
                const elapsed = now - lastRequestTime;
                if (elapsed < minInterval) await sleep(minInterval - elapsed);
                lastRequestTime = Date.now();
            }

            const result = await request(task.route, task.params);
            totalRequests++;

            const paramStr = Object.keys(task.params).length ? `?${new URLSearchParams(task.params).toString()}` : '';
            const fullPath = task.route + paramStr;

            if (result.error) {
                const dur = (result.duration || 0).toString().padStart(5);
                console.log(`❌ ERR  | ${dur}ms | ------ | ${fullPath} -> ${result.error}`);
                failures++;
            } else {
                const statusColor = result.status >= 400 ? '❌' : (result.status >= 300 ? '➡️' : '✅');
                if (result.status >= 400) failures++;
                const dur = (result.duration || 0).toString().padStart(5);
                const size = (result.contentLength || 0).toString().padStart(8);
                let info = `${statusColor} ${String(result.status).padEnd(4)} | ${dur}ms | ${size} | ${fullPath}`;
                if (result.status === 302) info += ` -> ${result.location}`;
                console.log(info);
            }
        }
    }

    const workers = [];
    const effectiveConcurrency = Math.max(1, Math.min(CONCURRENCY, tasks.length || 1));
    for (let i = 0; i < effectiveConcurrency; i++) workers.push(worker(i));
    await Promise.all(workers);

    console.log('------------------------------------------------------------');
    console.log(`🏁 Test Finished!`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Failures:       ${failures}`);
    
    if (failures > 0) {
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
