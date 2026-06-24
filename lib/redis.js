/**
 * @fileoverview Redis-Wrapper: Haupt-Client, Subscriber-Client und Hilfsfunktionen.
 * @module lib/redis
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Erzeuge zwei Redis-Clients: einen für allgemeine Befehle, einen für Subscriptions
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

const redisSub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

// Verbessere Beobachtbarkeit: Lifecycle-Events für Debugging und Monitoring loggen
redis.on('connect', () => console.log('Redis: connect'));
redis.on('ready', () => console.log('Redis: ready'));
redis.on('reconnecting', (delay) => console.warn('Redis: reconnecting in', delay));
redis.on('close', () => console.warn('Redis: close'));
redis.on('end', () => console.warn('Redis: end'));
redis.on('error', (err) => {
    console.warn('Redis Connection Error:', err && err.message ? err.message : err);
});

// Subscriber-Client: getrennte Logs, damit Subscription-Lifecycle erkennbar ist
redisSub.on('connect', () => console.log('RedisSub: connect'));
redisSub.on('ready', () => console.log('RedisSub: ready'));
redisSub.on('reconnecting', (delay) => console.warn('RedisSub: reconnecting in', delay));
redisSub.on('close', () => console.warn('RedisSub: close'));
redisSub.on('end', () => console.warn('RedisSub: end'));
redisSub.on('error', (err) => {
    console.warn('Redis Sub Connection Error:', err && err.message ? err.message : err);
});

// Wartet auf Bereitschaft des Haupt-Redis-Clients (optionales Timeout)
/**
 * Wartet, bis der Haupt-Redis-Client `ready` ist oder ein Timeout eintritt.
 * @param {number} [timeout=5000] - Timeout in Millisekunden, 0 = kein Timeout.
 * @returns {Promise<void>} Erfüllt, sobald Redis bereit ist.
 * @throws {Error} Bei Timeout oder Verbindungsfehler.
 */
function awaitRedisReady(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (redis.status === 'ready') return resolve();

        // Handler für erfolgreiche Bereitschaft
        const onReady = () => { cleanup(); resolve(); };
        // Handler für Fehler während des Verbindungsaufbaus
        const onError = (err) => { cleanup(); reject(err); };
        // Entfernt die Event-Listener
        const cleanup = () => {
            redis.removeListener('ready', onReady);
            redis.removeListener('error', onError);
        };

        redis.on('ready', onReady);
        redis.on('error', onError);

        if (timeout > 0) {
            const tid = setTimeout(() => {
                cleanup();
                reject(new Error('awaitRedisReady timeout'));
            }, timeout);
            // Wrap resolve, damit Timeout beim Erfüllen gecleart wird
            const origResolve = resolve;
            resolve = (...args) => { clearTimeout(tid); origResolve(...args); };
        }
    });
}

// Stellt ein Abonnement auf einem Kanal sicher – abonnieren, wenn bereit, und erneut bei Reconnect
/**
 * Stellt sicher, dass der Subscriber-Client auf einen Kanal abonniert ist.
 * Bei Verfügbarkeit des Clients wird `subscribe` ausgeführt; bei späterer Ready
 *-Ereignissen wird erneut versucht, das Abonnement herzustellen.
 * @param {string} channel - Kanalname.
 * @returns {void}
 */
function ensureSubscribe(channel) {
    const doSubscribe = () => {
        redisSub.subscribe(channel).then((count) => {
            console.log(`RedisSub: subscribed to ${channel} (count=${count})`);
        }).catch((err) => {
            console.error('RedisSub: subscribe error for', channel, err && err.message ? err.message : err);
        });
    };

    if (redisSub.status === 'ready') doSubscribe();
    redisSub.on('ready', doSubscribe);
}

module.exports = {
    redis,
    redisSub,
    // Rückgabewert `true` wenn Redis in einem brauchbaren Zustand ist (ready/connecting)
    isRedisEnabled: () => redis.status === 'ready' || redis.status === 'connecting',
    awaitRedisReady,
    ensureSubscribe,
    // Sicher serialisieren und veröffentlichen (BigInt -> number|string)
    safePublish: async (channel, payload) => {
        // Konvertiert BigInt in Number (falls sicher) oder String, um JSON.stringify-Fehler zu vermeiden
        const safeStringify = (obj) => JSON.stringify(obj, (_k, v) => {
            if (typeof v === 'bigint') {
                if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)) return Number(v);
                return v.toString();
            }
            return v;
        });

        try {
            const body = safeStringify(payload);
            return await redis.publish(channel, body);
        } catch (err) {
            return Promise.reject(err);
        }
    }
};
