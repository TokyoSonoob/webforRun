import express from "express";

const app = express();
app.use(express.json());

let alerts = []; // เก็บประวัติการยิง

// API ให้บอทยิงมา
app.post("/ping/:botId", (req, res) => {
  const botId = req.params.botId;
  const now = Date.now();
  alerts.unshift({ botId, time: now }); // เก็บรายการใหม่ไว้ด้านบน
  if (alerts.length > 50) alerts.pop(); // เก็บสูงสุด 50 รายการ
  res.json({ message: `Bot ${botId} ping received` });
});

// API ส่งข้อมูล JSON ให้หน้าเว็บดึง
app.get("/data", (req, res) => {
  res.json({ alerts });
});

// หน้าเว็บหลัก
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <meta charset="utf-8">
    <title>Bot Ping Monitor</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; padding: 20px; margin: 0; }
      h1 { text-align: center; color: #38bdf8; }
      .card { background: #1e293b; padding: 15px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
      .alert-list { list-style: none; padding: 0; margin: 0; }
      .alert-item { background: #1e3a8a; padding: 10px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
      .alert-bot { font-weight: bold; color: #93c5fd; }
      .alert-time { font-size: 0.9em; color: #e0f2fe; }
    </style>
  </head>
  <body>
    <h1>📡 Bot Ping Monitor</h1>
    <div class="card">
      <ul class="alert-list" id="alertList"></ul>
    </div>

    <script>
      async function fetchData() {
        const res = await fetch('/data');
        const data = await res.json();

        const alertList = document.getElementById('alertList');
        alertList.innerHTML = '';
        data.alerts.forEach(a => {
          alertList.innerHTML += \`<li class="alert-item"><span class="alert-bot">🤖 \${a.botId}</span><span class="alert-time">\${new Date(a.time).toLocaleTimeString()}</span></li>\`;
        });
      }

      setInterval(fetchData, 3000); // อัปเดตทุก 3 วิ
      fetchData();
    </script>
  </body>
  </html>
  `);
});

export default app;
