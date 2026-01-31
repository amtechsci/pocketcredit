module.exports = {
  apps: [{
    name: 'pocket-credit-server',
    script: './src/server/server.js',
    cwd: './src/server',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Cron jobs will run automatically when server starts
    // No need for separate cron configuration
  }]
};
