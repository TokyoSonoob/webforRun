import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// ---------- Storage (KV ถ้ามี env, ไม่งั้น in-memory) ----------
type BotStatus = { lastPing: number | null; count: number; lastPayload?: unknown };
const STATUS_KEY = 'bot:status';
const hasKV = Boolean(process.env.KV_URL && process.env.KV_REST_API_TOKEN);

// in-memory (per instance)
let memoryStatus: BotStatus = { lastPing: null, count: 0 };

async function kv() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

async function readStatus(): Promise<BotStatus> {
  if (hasKV) {
    const k = await kv();
    const d = await k.get<BotStatus>(STATUS_KEY);
    return { lastPing: d?.lastPing ?? null, count: d?.count ?? 0, lastPayload: d?.lastPayload };
  }
  return memoryStatus;
}

async function writeStatus(next: BotStatus) {
  if (hasKV) {
    const k = await kv();
    await k.set(STATUS_KEY, next);
  } else {
    memoryStatus = next;
  }
}

// ---------- Helpers ----------
function j(data: any, status = 200, headers: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

function getToken(req: NextRequest) {
  const headerToken = req.headers.get('x-bot-token') ?? '';
  const queryToken = new URL(req.url).searchParams.get('token') ?? '';
  return headerToken || queryToken;
}

// ---------- GET (HTML page or status JSON) ----------
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // JSON status (หน้าเว็บจะเรียก /api/monitor?status=1)
  if (url.searchParams.get('status')) {
    const s = await readStatus();
    return j({ ...s, now: Date.now() });
  }

  // หน้าเว็บ (HTML + CSS + JS ฝังในไฟล์เดียว)
  const origin = url.origin;
  const webhookCurl = `curl -X POST "${origin}/api/monitor?token=YOUR_BOT_TOKEN" -H "content-type: application/json" -d '{"hello":"world"}'`;

  return html(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bot Webhook Monitor</title>
<style>
:root{--bg:#0b1220;--panel:#111a2b;--text:#e6eefc;--muted:#98a2b3;--ok:#22c55e;--warn:#f59e0b;--err:#ef4444;--b:#1f2a44}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial;background:radial-gradient(1000px 600px at 10% -10%,#15213a 0%,var(--bg) 60%);color:var(--text)}
.container{min-height:100%;display:grid;place-items:center;padding:16px}
.card{width:100%;max-width:860px;background:linear-gradient(180deg,var(--panel),#0f172a 140%);border:1px solid var(--b);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.h1{margin:0 0 6px;font-size:26px;font-weight:800}
.sub{color:var(--muted);font-size:14px;margin:0 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.kpi{border:1px solid var(--b);background:#0b1430;border-radius:12px;padding:14px}
.label{color:var(--muted);font-size:13px}
.val{font-size:26px;font-weight:800;margin-top:6px}
.val.ok{color:var(--ok)} .val.warn{color:var(--warn)}
pre{margin:0;overflow:auto;background:#0b1430;border:1px solid var(--b);border-radius:10px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px dashed var(--b);color:var(--muted);font-size:12px}
.small{color:var(--muted);font-size:13px}
.err{color:var(--err)}
.mt8{margin-top:8px}.mt12{margin-top:12px}.mt18{margin-top:18px}.full{grid-column:1 / -1}
.code{white-space:pre-wrap}
.footer{margin-top:10px;color:var(--muted);font-size:12px}
a{color:#8ab4ff;text-decoration:none} a:hover{text-decoration:underline}
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 class="h1">Bot Webhook Monitor 🔨🤖🔧</h1>
      <p class="sub">หน้าเดียวจบ: UI + API + Webhook ใน <b>/api/monitor</b> ไฟล์เดียว</p>

      <div class="grid">
        <div class="kpi">
          <div class="label">สถานะบอท</div>
          <div id="status-val" class="val warn">กำลังโหลด...</div>
        </div>
        <div class="kpi">
          <div class="label">จำนวนครั้งที่ยิง</div>
          <div id="count-val" class="val">0</div>
        </div>
        <div class="kpi full">
          <div class="label">ยิงล่าสุด</div>
          <div id="last-text" class="val">—</div>
          <div id="last-time" class="small mt8">—</div>
        </div>
        <div class="kpi full">
          <div class="label">Payload ล่าสุด</div>
          <pre id="payload" class="mt8">{ "note": "ยังไม่มีข้อมูล" }</pre>
        </div>
      </div>

      <div class="mt18">
        <span class="badge">วิธีทดสอบด้วย cURL</span>
        <pre class="mt8 code">${webhookCurl}</pre>
        <div class="small mt8">หรือใส่ Header: <code>X-Bot-Token: YOUR_BOT_TOKEN</code></div>
      </div>

      <div id="err" class="err mt12" style="display:none"></div>
      <div class="footer">GET <code>/api/monitor?status=1</code> for JSON • POST <code>/api/monitor</code> to send webhook</div>
    </div>
  </div>

<script>
function timeAgo(ms){
  const s=Math.floor(ms/1000);
  if(s<5) return 'เมื่อสักครู่';
  if(s<60) return s+' วินาทีที่แล้ว';
  const m=Math.floor(s/60);
  if(m<60) return m+' นาทีที่แล้ว';
  const h=Math.floor(m/60);
  if(h<24) return h+' ชั่วโมงที่แล้ว';
  const d=Math.floor(h/24);
  return d+' วันที่แล้ว';
}
async function refresh(){
  try{
    const r=await fetch(location.pathname+'?status=1',{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const s=await r.json();
    const has = !!s.lastPing;

    document.getElementById('status-val').textContent = has ? 'ยิงมาแล้ว' : 'ยัง';
    document.getElementById('status-val').className = 'val ' + (has ? 'ok':'warn');
    document.getElementById('count-val').textContent = s.count ?? 0;
    document.getElementById('last-text').textContent = has ? timeAgo((s.now ?? Date.now()) - s.lastPing) : 'ยังไม่เคยถูกยิง';
    document.getElementById('last-time').textContent = has ? new Date(s.lastPing).toLocaleString() : '—';
    document.getElementById('payload').textContent = JSON.stringify(s.lastPayload ?? {note:'ยังไม่มีข้อมูล'}, null, 2);

    const err = document.getElementById('err');
    err.style.display='none'; err.textContent='';
  }catch(e){
    const err = document.getElementById('err');
    err.style.display='block';
    err.textContent='เกิดข้อผิดพลาด: '+(e && e.message || e);
  }
}
refresh(); setInterval(refresh, 3000);
</script>
</body>
</html>`);
}

// ---------- POST (Webhook) ----------
export async function POST(req: NextRequest) {
  const expected = process.env.BOT_TOKEN ?? '';
  const token = getToken(req);

  if (!expected) return j({ error: 'Server missing BOT_TOKEN' }, 500);
  if (!token) return j({ error: 'Missing token' }, 401);
  if (token !== expected) return j({ error: 'Invalid token' }, 401);

  let payload: unknown = undefined;
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await req.json();
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      payload = Object.fromEntries([...form.entries()]);
    } else {
      const text = await req.text();
      payload = text ? { raw: text } : { note: 'no body' };
    }
  } catch {
    payload = { note: 'invalid body' };
  }

  const prev = await readStatus();
  const next: BotStatus = {
    lastPing: Date.now(),
    count: prev.count + 1,
    lastPayload: payload
  };
  await writeStatus(next);

  return j({ ok: true, receivedAt: next.lastPing, count: next.count });
}

export const dynamic = 'force-dynamic';
