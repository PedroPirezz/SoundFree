const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CHANNELS = 16;


const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
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


let mixerState = Array.from({ length: CHANNELS }, (_, i) => ({
  id: i,
  volume: 50,
  mute: false,
  solo: false
}));


async function loadMixerState() {
  try {
    const saved = await redisGet("mixerState");

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        mixerState = parsed;
        console.log("♻️ Mixer restaurado do Redis");
      } else {
        console.warn("⚠️ Redis tinha dado inválido, resetando");
      }
    }
  } catch (err) {
    console.error("Erro ao carregar Redis:", err);
  }
}


async function saveMixerState() {
  try {
    await redisSet("mixerState", JSON.stringify(mixerState));
  } catch (err) {
    console.error("Erro ao salvar Redis:", err);
  }
}


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));




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
      return;
    }

    const ch = data.channel;
    if (!mixerState[ch]) return;

  
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


const PORT = process.env.PORT || 80;

server.listen(PORT, async () => {
  await loadMixerState();
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});