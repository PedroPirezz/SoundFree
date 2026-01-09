console.log("🎚 mixer.js carregado");

const ws = new WebSocket("https://soundfree-1.onrender.com/");

const CHANNELS = 16;

const CHANNEL_NAMES = [
  "PASTOR-1", "PASTOR-2", "MIC-3", "MIC-4",
  "MIC-5", "MIC-6", "TECLADO", "VIOLÃO",
  "GUITARRA", "BAIXO", "BUMBO", "BATERIA",
  "CH-13", "CH-14", "CH-15", "CH-16"
];

let mixerState = [];
let isDragging = Array(CHANNELS).fill(false);

document.addEventListener("DOMContentLoaded", () => {
  const mixer = document.getElementById("mixer");

  // ======================
  // WebSocket
  // ======================
  ws.onopen = () => {
    console.log("🟢 WebSocket conectado");
  };

  ws.onerror = err => {
    console.error("🔴 WebSocket erro:", err);
  };

  ws.onmessage = e => {
    let data;

    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }

    if (data.type === "INIT") {
      mixerState = data.state;
      renderMixer();
      return;
    }

    if (data.type === "SYNC") {
      const { channel, payload } = data;

      // 🔥 MERGE correto do estado
      mixerState[channel] = {
        ...mixerState[channel],
        ...payload,
        id: channel
      };

      // 🔥 reaplica lógica global (SOLO/MUTE)
      mixerState.forEach(updateChannelUI);
    }
  };

  // ======================
  // Render Mixer (1x)
  // ======================
  function renderMixer() {
    mixer.innerHTML = "";

    mixerState.forEach(ch => {
      const el = document.createElement("div");
      el.className = "channel";
      el.dataset.id = ch.id;

      el.innerHTML = `
        <div class="channel-name">
          ${CHANNEL_NAMES[ch.id] || `Canal ${ch.id + 1}`}
        </div>

        <div class="volume" id="vol-${ch.id}">
          ${ch.volume}%
        </div>

        <input
          class="fader"
          id="fader-${ch.id}"
          type="range"
          min="0"
          max="100"
          value="${ch.volume}"
        >

        <div class="buttons">
          <button class="mute" id="mute-${ch.id}">M</button>
          <button class="solo" id="solo-${ch.id}">S</button>
        </div>
      `;

      mixer.appendChild(el);
      bindEvents(ch.id);
      updateChannelUI(ch);
    });
  }

  // ======================
  // Eventos
  // ======================
  function bindEvents(id) {
    const fader = document.getElementById(`fader-${id}`);
    const mute = document.getElementById(`mute-${id}`);
    const solo = document.getElementById(`solo-${id}`);

    fader.addEventListener("pointerdown", () => isDragging[id] = true);
    fader.addEventListener("pointerup", () => isDragging[id] = false);
    fader.addEventListener("pointerleave", () => isDragging[id] = false);
    fader.addEventListener("pointercancel", () => isDragging[id] = false);

    fader.addEventListener("input", e => {
      const val = Math.round(e.target.value);

      mixerState[id].volume = val;
      document.getElementById(`vol-${id}`).innerText = val + "%";

      sendUpdate(id, { volume: val });
    });

    mute.onclick = () => {
      sendUpdate(id, { mute: !mixerState[id].mute });
    };

    solo.onclick = () => {
      sendUpdate(id, { solo: !mixerState[id].solo });
    };
  }

  // ======================
  // Enviar update
  // ======================
  function sendUpdate(channel, payload) {
    ws.send(JSON.stringify({
      type: "UPDATE",
      channel,
      payload
    }));
  }

  // ======================
  // Atualizar UI
  // ======================
  function updateChannelUI(ch) {
    if (!ch || ch.id === undefined) return;

    const fader = document.getElementById(`fader-${ch.id}`);
    const vol = document.getElementById(`vol-${ch.id}`);
    const mute = document.getElementById(`mute-${ch.id}`);
    const solo = document.getElementById(`solo-${ch.id}`);

    if (!fader) return;

    mute.classList.toggle("active", ch.mute);
    solo.classList.toggle("active", ch.solo);

    const target = getTargetVolume(ch);
    fader.disabled = isLocked(ch);

    if (!isDragging[ch.id] && Number(fader.value) !== target) {
      animateFader(fader, vol, target);
    }
  }

  // ======================
  // Lógica Solo / Mute
  // ======================
  function isSoloActive() {
    return mixerState.some(c => c.solo);
  }

  function isLocked(ch) {
    if (ch.mute) return true;
    if (isSoloActive() && !ch.solo) return true;
    return false;
  }

  function getTargetVolume(ch) {
    if (ch.mute) return 0;
    if (isSoloActive() && !ch.solo) return 0;
    return ch.volume;
  }

  // ======================
  // Animação Suave
  // ======================
  function animateFader(fader, label, target) {
    let current = Number(fader.value);
    const speed = 1.1;

    function step() {
      if (Math.abs(current - target) < 0.5) {
        current = target;
      } else {
        current += current < target ? speed : -speed;
      }

      fader.value = current;
      label.innerText = Math.round(current) + "%";

      if (current !== target) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }
});
