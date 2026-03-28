const app = require('./src/app');
const { testConnection } = require('./src/config/db');

const DEFAULT_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_RETRIES = 10;

testConnection();

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    console.log(`ShoreClean backend running on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      if (attempt >= MAX_PORT_RETRIES) {
        console.error(`Port ${port} is busy and no fallback ports are available.`);
        process.exit(1);
      }

      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    throw error;
  });
}

startServer(DEFAULT_PORT);
