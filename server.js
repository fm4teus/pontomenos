#!/usr/bin/env node

const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9993;
const BEARER_TOKEN = process.env.BEARER_TOKEN || '';

// Middleware para CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'app')));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ response: 'PontoMenos is alive', timestamp: new Date().toISOString() });
});

// Proxy para a API do PontoMais - INJETA O BEARER_TOKEN NO SERVIDOR
app.post('/api/time_cards/register', (req, res) => {
  // Injeta o BEARER_TOKEN no payload aqui no servidor (nunca exposto ao cliente)
  const payload = req.body;
  if (payload._device && payload._device.uuid && BEARER_TOKEN) {
    payload._device.uuid.authorization = `Bearer ${BEARER_TOKEN}`;
  }
  
  const headers = {
    'client': req.headers['client'] || '',
    'access-token': req.headers['access-token'] || '',
    'token': req.headers['token'] || '',
    'uid': req.headers['uid'] || '',
    'uuid': req.headers['uuid'] || '',
    'content-type': 'application/json',
    'origin': 'https://app2.pontomais.com.br',
    'referer': 'https://app2.pontomais.com.br/'
  };

  const options = {
    hostname: 'api.pontomais.com.br',
    path: '/api/time_cards/register',
    method: 'POST',
    headers: headers
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let responseBody = '';

    proxyRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    proxyRes.on('end', () => {
      console.log(`[${proxyRes.statusCode}] ${req.method} ${req.url}`);
      res.status(proxyRes.statusCode)
        .set('Content-Type', proxyRes.headers['content-type'] || 'application/json')
        .send(responseBody);
    });
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  });

  proxyReq.write(JSON.stringify(payload));
  proxyReq.end();
});

// Proxy genérico para a API do PontoMais (GET de sessão, work_days, statuses, etc.)
// Resolve o CORS: o browser fala same-origin com este servidor, que encaminha
// a requisição para api.pontomais.com.br server-side (sem restrição de CORS).
app.all('/api/*', (req, res) => {
  const headers = {
    'client': req.headers['client'] || '',
    'access-token': req.headers['access-token'] || '',
    'uid': req.headers['uid'] || '',
    'content-type': 'application/json',
    'api-version': '2',
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'identity',
    'origin': 'https://app2.pontomais.com.br',
    'referer': 'https://app2.pontomais.com.br/'
  };
  if (req.headers['token']) headers['token'] = req.headers['token'];
  if (req.headers['uuid']) headers['uuid'] = req.headers['uuid'];

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const bodyStr = hasBody ? JSON.stringify(req.body || {}) : '';

  const options = {
    hostname: 'api.pontomais.com.br',
    path: req.originalUrl, // inclui a query string
    method: req.method,
    headers
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let responseBody = '';
    proxyRes.on('data', (chunk) => { responseBody += chunk; });
    proxyRes.on('end', () => {
      console.log(`[${proxyRes.statusCode}] ${req.method} ${req.originalUrl}`);
      res.status(proxyRes.statusCode)
        .set('Content-Type', proxyRes.headers['content-type'] || 'application/json')
        .send(responseBody);
    });
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  });

  if (hasBody) proxyReq.write(bodyStr);
  proxyReq.end();
});

// Fallback para SPA - todas as outras rotas retornam o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 PontoMenos rodando em http://localhost:${PORT}`);
  console.log(`📡 API proxy: http://localhost:${PORT}/api/time_cards/register`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

