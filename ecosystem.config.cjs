module.exports = {
  apps: [
    {
      name: "tutorhive",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 4173
      }
    }
  ]
};
