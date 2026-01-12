const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CHANNELS = 16;

// ==============================
// Upstash config
// ==============================
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "text/plain"
    },
    body: value
  });
}

// ==============================
// Estado global
// ==============================
let mixerState = Array.from({ length: CHANNELS }, (_, i) => ({
  id: i,
  volume: 50,
  mute: false,
  solo: false
}));

// ==============================
// Carregar estado salvo
// ==============================
async function loadMixerState() {
  try {
    const saved = await redisGet("mixerState");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) mixerState = parsed;
    }
  } catch (err) {
    console.error("Erro ao carregar Redis:", err);
  }
}

// ==============================
// Salvar estado
// ==============================
async function saveMixerState() {
  try {
    await redisSet("mixerState", JSON.stringify(mixerState));
  } catch (err) {
    console.error("Erro ao salvar Redis:", err);
  }
}

// ==============================
// Express
// ==============================
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("Home"));

// ==============================
// LOGIN
// ==============================
app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ user }, process.env.JWT_SECRET, {
      expiresIn: "6h"
    });

    return res.json({ token });
  }

  res.status(401).json({ error: "Credenciais inválidas" });
});

// ==============================
// WebSocket
// ==============================
wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const token = params.get("token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    ws.isAuth = true;
    ws.user = decoded.user;
    console.log("🟢 Cliente autenticado:", ws.user);
  } catch {
    ws.isAuth = false;
    console.log("🟡 Cliente sem autenticação");
  }

  ws.send(JSON.stringify({
    type: "INIT",
    state: mixerState,
    auth: ws.isAuth
  }));

  ws.on("message", async msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    const ch = data.channel;
    if (!mixerState[ch]) return;

    // 🔐 BLOQUEIO
    if (!ws.isAuth && (data.type === "UPDATE" || data.type === "COMMIT")) {
      return;
    }

    if (data.type === "UPDATE") {
      mixerState[ch] = {
        ...mixerState[ch],
        ...data.payload
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "SYNC",
            channel: ch,
            payload: mixerState[ch]
          }));
        }
      });
    }

    if (data.type === "COMMIT") {
      await saveMixerState();
      console.log("💾 Mixer salvo no Redis");
    }
  });
});

// ==============================
// Start server
// ==============================
const PORT = process.env.PORT || 80;

server.listen(PORT, async () => {
  await loadMixerState();
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
