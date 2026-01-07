const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CHANNELS = 16;

// 🔥 Estado global
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

wss.on("connection", ws => {
  console.log("🟢 Cliente conectado");

  // Envia estado completo
  ws.send(JSON.stringify({
    type: "INIT",
    state: mixerState
  }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "UPDATE") {
      const ch = data.channel;

      mixerState[ch] = {
        ...mixerState[ch],
        ...data.payload
      };

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

server.listen(80, () => {
  console.log("🚀 http://localhost");
});
