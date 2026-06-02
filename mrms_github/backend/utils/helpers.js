const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

function readJSON(filename) {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJSON(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function sendSuccess(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, data }));
}

function sendError(res, message, statusCode = 400) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Noto\'g\'ri JSON format')); }
    });
    req.on('error', reject);
  });
}

function generateId(items) {
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}

function getQueryParams(url) {
  try {
    return Object.fromEntries(new URL('http://x' + url).searchParams.entries());
  } catch {
    return {};
  }
}

module.exports = { readJSON, writeJSON, sendSuccess, sendError, parseBody, generateId, getQueryParams };
