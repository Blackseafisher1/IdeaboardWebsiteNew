const { MAX } = require("uuid");

module.exports = {
  apps: [
    // Bun - Fork mode (single instance, recommended for Bun)
    {
      name: "ideenboard-bun-fork",
      script: "server.js",
      interpreter: "bun",
      exec_mode: "fork",
      instances: "max",
      env: {
        UPLOAD_MASTER_PASSWORD: "123456",
        //SESSION_SECRET: "REPLACE_WITH_SESSION_SECRET",
        REDIS_URL: "redis://127.0.0.1:6379",
        NODE_ENV: "production",
        TRUST_PROXIES: "1",
        PORT: 3000
      }
    },

    // Node - Cluster mode (uses all CPU cores; requires Redis for SSE sync)
    {
      name: "ideenboard-node-cluster",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        UPLOAD_MASTER_PASSWORD: "123456",
        //SESSION_SECRET: "REPLACE_WITH_SESSION_SECRET",
        REDIS_URL: "redis://127.0.0.1:6379",
        NODE_ENV: "production",
        TRUST_PROXIES: "1",
        PORT: 3000
      }
    }
  ]
};
