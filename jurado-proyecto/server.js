const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const publicDir = path.join(__dirname, 'public');

function send(res, status, body, type='application/json') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store'});
  res.end(body);
}

async function saveVote(vote) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan variables de Supabase en Render.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/votaciones`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(vote)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/votaciones') {
      let raw='';
      req.on('data', chunk => { raw += chunk; if (raw.length > 20000) req.destroy(); });
      req.on('end', async () => {
        try {
          const data = JSON.parse(raw || '{}');
          const presentation = Number(data.presentacion);
          const student = String(data.estudiante || '').trim();
          const bando = String(data.bando || '');
          const argumentacion = Number(data.argumentacion);
          const refutacion = Number(data.refutacion);
          const actuacion = Number(data.actuacion);
          const justificacion = String(data.justificacion || '').trim();
          const evidencia = String(data.evidencia || '').trim();
          if (!Number.isInteger(presentation) || presentation < 1 || presentation > 99 || !student || !['A','B'].includes(bando) ||
              ![argumentacion, refutacion, actuacion].every(n => Number.isInteger(n) && n >= 1 && n <= 5) || !justificacion || !evidencia) {
            return send(res, 400, JSON.stringify({ok:false,error:'Datos incompletos o inválidos.'}));
          }
          await saveVote({presentacion:presentation, estudiante:student, bando, argumentacion, refutacion, actuacion, justificacion, evidencia});
          send(res, 201, JSON.stringify({ok:true}));
        } catch (e) { send(res, 500, JSON.stringify({ok:false,error:e.message})); }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/api/health') {
      return send(res, 200, JSON.stringify({ok:true, supabaseConfigured:Boolean(SUPABASE_URL && SUPABASE_KEY)}));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,JSON.stringify({error:'Method not allowed'}));
    let reqPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (reqPath === '/') reqPath = '/index.html';
    const file = path.normalize(path.join(publicDir, reqPath));
    if (!file.startsWith(publicDir)) return send(res,403,'Forbidden','text/plain');
    fs.readFile(file, (err, content) => {
      if (err) return send(res,404,'Not found','text/plain');
      const ext=path.extname(file);
      const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript'};
      res.writeHead(200, {'Content-Type':types[ext]||'application/octet-stream'}); res.end(content);
    });
  } catch (e) { send(res,500,JSON.stringify({error:e.message})); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Jurado del Directorio funcionando en puerto ${PORT}`));
