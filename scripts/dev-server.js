#!/usr/bin/env node
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!target.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(target,(err,stat)=>{
    if (!err && stat.isDirectory()) target=path.join(target,'index.html');
    fs.readFile(target,(readErr,data)=>{
      if (readErr) { res.writeHead(404,{'Content-Type':'text/plain'}); return res.end('Not found'); }
      res.writeHead(200,{'Content-Type':types[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(data);
    });
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`Olexa Archive → http://localhost:${port}`));
