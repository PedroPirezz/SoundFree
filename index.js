const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CHANNELS = 16;

// ======================
// Estado global
// ======================
let mixerState = Array.from({ length: CHANNELS }, (_, i) => ({
  id: i,
  volume: 50,
  mute: false,
  solo: false
}));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("Home"));

// ======================
// WebSocket
// ======================
wss.on("connection", ws => {
  console.log("🟢 Cliente conectado");

  // Envia estado inicial
  ws.send(JSON.stringify({
    type: "INIT",
    state: mixerState
  }));

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "UPDATE") {
      const ch = data.channel;

      if (typeof ch !== "number") return;

      // Atualiza estado global
      mixerState[ch] = {
        ...mixerState[ch],
        ...data.payload,
        id: ch // garante ID
      };

      // 🔥 Broadcast de TODOS os canais
      mixerState.forEach(channel => {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "SYNC",
              channel: channel.id,
              payload: channel
            }));
          }
        });
      });
    }
  });
});

server.listen(80, () => {
  console.log("🚀 http://localhost");
});
