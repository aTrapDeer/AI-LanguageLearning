const net = require('net');

const REDIS_HOST = 'redis-cluster-ailang-rhkzgb.serverless.use1.cache.amazonaws.com';
const REDIS_PORT = 6379;
const PROXY_PORT = 6380;

const server = net.createServer((clientSocket) => {
  console.log('Client connected');

  const redisSocket = net.createConnection({
    host: REDIS_HOST,
    port: REDIS_PORT
  }, () => {
    console.log('Connected to Redis');
  });

  clientSocket.pipe(redisSocket);
  redisSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    console.error('Client socket error:', err);
  });

  redisSocket.on('error', (err) => {
    console.error('Redis socket error:', err);
  });

  clientSocket.on('end', () => {
    console.log('Client disconnected');
    redisSocket.end();
  });

  redisSocket.on('end', () => {
    console.log('Redis disconnected');
    clientSocket.end();
  });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on port ${PROXY_PORT}`);
}); 