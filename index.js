// index.js
import express from "express";

const app = express();
app.use(express.json());

const bots = {}; // เก็บบอทในหน่วยความจำ { id: {...} }

// หน้าเว็บ UI
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Bot Monitor</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: sans-serif; background: #111; color: #fff; padding: 20px; }
h1 { margin-bottom: 20px; }
.bot { border: 1px solid #333; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; }
.btn { padding: 5px 10px; border: none; cursor: pointer; border-radius: 5px; }
.toggle { background: #4caf50; color: white; }
.toggle.off { background: #f44336; }
.check { background: #2196f3; color: white; }
</style>
</head>
<body>
<h1>Bot Monitor</h1>
<div id="bots"></div>

<h2>เพิ่มบอท</h2>
<form id="addBotForm">
  <input type="text" id="botId" placeholder="Bot ID" required>
  <input type="text" id="botName" placeholder="Bot Name" required>
  <input type="url" id="renderHook" placeholder="Render Deploy Hook URL" required>
  <input type="number" id="timeout" placeholder="Timeout (นาที)" value="10" required>
  <input type="text" id="token" placeholder="Bot Secret Token" required>
  <button type="submit">เพิ่ม</button>
</form>

<script>
async function loadBots() {
  const res = await fetch('/api/bots');
  const data = await res.json();
  const container = document.getElementById('bots');
  container.innerHTML = '';
  data.bots.forEach(bot => {
    const div = document.createElement('div');
    div.className = 'bot';
    div.innerHTML = \`
      <div>
        <strong>\${bot.name}</strong> (\${bot.id})<br>
        Ping ล่าสุด: \${bot.lastPingAt ? new Date(bot.lastPingAt).toLocaleString() : 'ไม่เคย'}
      </div>
      <div>
        <button class="btn toggle \${bot.expectPing ? '' : 'off'}" onclick="toggleBot('\${bot.id}', \${!bot.expectPing})">
          \${bot.expectPing ? 'ปิดรับ' : 'เปิดรับ'}
        </button>
        <button class="btn check" onclick="manualCheck()">เช็คตอนนี้</button>
      </div>
    \`;
    container.appendChild(div);
  });
}

async function toggleBot(id, expectPing) {
  await fetch(\`/api/bots/\${id}\`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectPing })
  });
  loadBots();
}

async function manualCheck() {
  await fetch('/api/check');
  alert('ตรวจสอบเรียบร้อย');
  loadBots();
}

document.getElementById('addBotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bot = {
    id: document.getElementById('botId').value,
    name: document.getElementById('botName').value,
    renderDeployHook: document.getElementById('renderHook').value,
    timeoutMin: Number(document.getElementById('timeout').value),
    token: document.getElementById('token').value,
    expectPing: true,
    lastPingAt: null
  };
  await fetch('/api/bots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bot)
  });
  e.target.reset();
  loadBots();
});

loadBots();
</script>
</body>
</html>
  `);
});

// API
app.get("/api/bots", (req, res) => {
  res.json({ bots: Object.values(bots) });
});

app.post("/api/bots", (req, res) => {
  bots[req.body.id] = req.body;
  res.status(201).json({ ok: true });
});

app.patch("/api/bots/:id", (req, res) => {
  if (!bots[req.params.id]) return res.status(404).json({ error: "Not found" });
  bots[req.params.id] = { ...bots[req.params.id], ...req.body };
  res.json({ ok: true });
});

app.post("/api/ping", (req, res) => {
  const { botId, token } = req.body;
  if (!bots[botId]) return res.status(404).json({ error: "Not found" });
  if (bots[botId].token !== token) return res.status(401).json({ error: "Unauthorized" });
  bots[botId].lastPingAt = new Date().toISOString();
  res.json({ ok: true });
});

app.get("/api/check", async (req, res) => {
  const now = Date.now();
  const silent = [];
  for (const bot of Object.values(bots)) {
    if (!bot.expectPing) continue;
    const last = bot.lastPingAt ? new Date(bot.lastPingAt).getTime() : 0;
    if (!last || (now - last) / 60000 > bot.timeoutMin) {
      silent.push(bot.id);
      await fetch(bot.renderDeployHook, { method: "POST" });
    }
  }
  res.json({ ok: true, silent });
});

export default app;
