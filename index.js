const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify(value)
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
      mixerState = JSON.parse(saved);
      console.log("♻️ Mixer restaurado do Redis");
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
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("Home"));

// ==============================
// WebSocket
// ==============================
wss.on("connection", ws => {
  console.log("🟢 Cliente conectado");

  ws.send(JSON.stringify({
    type: "INIT",
    state: mixerState
  }));

  ws.on("message", async msg => {
    let data;

    try {
      data = JSON.parse(msg);
    } catch {
      console.warn("⚠️ Mensagem inválida ignorada:", msg.toString());
      return;
    }

    if (data.type === "UPDATE") {
      const ch = data.channel;

      mixerState[ch] = {
        ...mixerState[ch],
        ...data.payload
      };

      await saveMixerState(); // 🔥 SALVA SEMPRE

      // Broadcast
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
  });
});

// ==============================
// Start server
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  await loadMixerState();
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
