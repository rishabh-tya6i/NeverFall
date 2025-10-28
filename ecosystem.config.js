module.exports = {
  apps: [
    {
      name: 'neverfall-backend',
      cwd: '/home/ubuntu/NevrFall/backend',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: '/home/ubuntu/logs/backend-error.log',
      out_file: '/home/ubuntu/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    },
    {
      name: 'neverfall-frontend',
      cwd: '/home/ubuntu/NevrFall/frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/ubuntu/logs/frontend-error.log',
      out_file: '/home/ubuntu/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    },
    {
      name: 'neverfall-admin',
      cwd: '/home/ubuntu/NevrFall/admin',
      script: 'npm',
      args: 'run preview -- --port 5173 --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ubuntu/logs/admin-error.log',
      out_file: '/home/ubuntu/logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
};
