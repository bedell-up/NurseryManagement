module.exports = {
  apps: [
    {
      name: 'natives-api',
      script: 'src/server.js',
      cwd: '/root/natives',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
  ],
};
