module.exports = {
  apps: [
    {
      name: 'auth-secret-generator',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3898',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
