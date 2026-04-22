const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const LOG_FILE   = '/log/switcher.log';
const STATE_FILE = '/log/state.json';
const SRC_DIR    = '/scripts';
const DST_FILE   = '/lms_setup/lms_convert.sh';
const CUSTOM_SH  = '/scripts/custom_skrypt.sh';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── whitelists (bezpieczeństwo) ───────────────────────────────────────────────

const ALLOWED_PHASE = new Set(['-L', '-M', '-I']);
const ALLOWED_BW    = new Set(Array.from({length: 16}, (_, i) => String(80 + i))); // 80-95
const ALLOWED_GAIN  = new Set(Array.from({length: 10}, (_, i) => String(-(0.5 + i * 0.5)))); // -0.5..-5
const ALLOWED_DITHER = new Set([
  'dither -f gesemann',
  'dither -f shibata',
  'dither -f low-shibata',
  'dither -f high-shibata',
  'dither -f lipshitz',
  'dither -f improved-e-weighted',
  'dither -f modified-e-weighted',
  'dither -f f-weighted',
  'dither -S',
  'dither'
]);

// ── helpers ───────────────────────────────────────────────────────────────────

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

function saveState(label) {
  const state = { last: label, timestamp: new Date().toISOString() };
  fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), (err) => {
    if (err) writeLog(`ERROR: Failed to save state - ${err.message}`);
  });
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    writeLog(`ERROR: Failed to read state - ${e.message}`);
  }
  return null;
}

function generateCustomScript(phase, bw, gain, dither) {
  return `#!/bin/sh
SOX=/lms/Bin/x86_64-linux/sox
FLAC=/lms/Bin/x86_64-linux/flac
LOG=/config/logs/lms_convert.log
# Custom: phase=${phase} bw=-b ${bw} gain=${gain} dither=${dither}
SR="$1"
BD="$2"
CH="$3"
FILE="$4"
START="\${5:-0}"

log_action() {
    echo "$(date "+%Y-%m-%d %H:%M:%S") | SR=$SR BD=$BD | START=$START | ACTION=$1 | FILE=$FILE" >> "$LOG"
}

# --- GRUPA 44100 Hz ---
if [ "$SR" -eq 44100 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_44100"
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        log_action "BIT_REDUCTION_44100"
        $SOX --buffer 524288 -q "$FILE" \\
        -t flac -b 16 -C 0 - \\
        gain ${gain} ${dither} trim "$START"
    fi
    exit 0
fi

# --- GRUPA 48000 Hz ---
if [ "$SR" -eq 48000 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_48000"
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        log_action "RESAMPLE_48000_TO_44100"
        $SOX --buffer 524288 -q "$FILE" \\
        -t flac -b 16 -C 0 - \\
        rate -v ${phase} -b ${bw} 44100 \\
        gain ${gain} ${dither} trim "$START"
    fi
    exit 0
fi

# --- GRUPA WYSOKIE SR ---
if [ "$SR" -eq 88200 ] || [ "$SR" -eq 176400 ] || [ "$SR" -eq 96000 ] || [ "$SR" -eq 192000 ]; then
    log_action "RESAMPLE_TO_44100"
    $SOX --buffer 524288 -q "$FILE" \\
        -t flac -b 16 -C 0 - \\
        rate -v ${phase} -b ${bw} 44100 \\
        gain ${gain} ${dither} trim "$START"
    exit 0
fi
exit 0
`;
}

// ── routes ────────────────────────────────────────────────────────────────────

app.get('/state', (req, res) => {
  res.json(loadState() || { last: null, timestamp: null });
});

app.post('/run/custom', (req, res) => {
  const { phase, bw, gain, dither } = req.body || {};

  // walidacja whitelist
  if (!ALLOWED_PHASE.has(phase)) {
    return res.status(400).json({ ok: false, message: `Invalid phase: ${phase}` });
  }
  if (!ALLOWED_BW.has(String(bw))) {
    return res.status(400).json({ ok: false, message: `Invalid bandwidth: ${bw}` });
  }
  if (!ALLOWED_GAIN.has(String(gain))) {
    return res.status(400).json({ ok: false, message: `Invalid gain: ${gain}` });
  }
  if (!ALLOWED_DITHER.has(dither)) {
    return res.status(400).json({ ok: false, message: `Invalid dither: ${dither}` });
  }

  const scriptContent = generateCustomScript(phase, bw, gain, dither);

  // wyodrębnij czytelną nazwę dithera do statusu
  const ditherLabel = dither.replace('dither -f ', '').replace('dither ', '').replace('-S', '-S') || 'dither';
  const label = `Custom: ${phase} -b ${bw} | gain ${gain} | ${ditherLabel}`;

  fs.writeFile(CUSTOM_SH, scriptContent, { mode: 0o755 }, (writeErr) => {
    if (writeErr) {
      const msg = `ERROR: Custom - failed to write script: ${writeErr.message}`;
      writeLog(msg);
      return res.status(500).json({ ok: false, message: msg });
    }

    fs.copyFile(CUSTOM_SH, DST_FILE, (copyErr) => {
      if (copyErr) {
        const msg = `ERROR: Custom - failed to copy to dst: ${copyErr.message}`;
        writeLog(msg);
        return res.status(500).json({ ok: false, message: msg });
      }

      const msg = `OK: ${label} -> ${DST_FILE}`;
      writeLog(msg);
      saveState(label);
      res.json({ ok: true, message: msg, last: label });
    });
  });
});

app.post('/run/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ ok: false, message: 'Invalid script ID' });
  }

  const label   = (req.body && req.body.label) ? req.body.label : `skrypt${id}`;
  const srcFile = path.join(SRC_DIR, `skrypt${id}.sh`);

  if (!srcFile.startsWith(SRC_DIR + '/')) {
    const msg = `ERROR: Invalid path for id ${id}`;
    writeLog(msg);
    return res.status(400).json({ ok: false, message: msg });
  }

  if (!fs.existsSync(srcFile)) {
    const msg = `ERROR: Script not found: ${srcFile}`;
    writeLog(msg);
    return res.status(500).json({ ok: false, message: msg });
  }

  fs.copyFile(srcFile, DST_FILE, (err) => {
    if (err) {
      const msg = `ERROR: ${label} - ${err.message}`;
      writeLog(msg);
      return res.status(500).json({ ok: false, message: msg });
    }

    const msg = `OK: ${label} -> ${DST_FILE}`;
    writeLog(msg);
    saveState(label);
    res.json({ ok: true, message: msg, last: label });
  });
});

// ── start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`LMS Switcher running on port ${PORT}`);
  writeLog(`INFO: Server started on port ${PORT}`);
});