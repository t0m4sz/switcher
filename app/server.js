const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const LOG_FILE   = '/log/switcher.log';
const STATE_FILE = '/log/state.json';
const SRC_DIR    = '/scripts';
const DST_FILE   = '/lms_setup/lms_convert.sh';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ── routes ────────────────────────────────────────────────────────────────────

app.get('/state', (req, res) => {
  res.json(loadState() || { last: null, timestamp: null });
});

app.post('/run/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  // zabezpieczenie: id musi być liczbą całkowitą większą od 0
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ ok: false, message: 'Invalid script ID' });
  }

  const label  = (req.body && req.body.label) ? req.body.label : `skrypt${id}`;
  const srcFile = path.join(SRC_DIR, `skrypt${id}.sh`);

  // zabezpieczenie: ścieżka musi pozostać wewnątrz SRC_DIR
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