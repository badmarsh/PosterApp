import http from 'http';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST') {
    const u = new URL(req.url, 'http://x');
    const name = path.basename(u.searchParams.get('name') || 'shot.png');
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const target = path.join(OUT, name);
      fs.writeFileSync(target, Buffer.from(body, 'base64'));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('saved ' + name + ' ' + fs.statSync(target).size);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('sink-alive');
}).listen(8391, () => console.log('sink ready on 8391'));
