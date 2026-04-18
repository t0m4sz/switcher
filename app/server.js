const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const LOG_FILE = '/log/switcher.log';
const STATE_FILE = '/log/state.json';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── helpers ──────────────────────────────────────────────────────────────────

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

function saveState(scriptName) {
  const state = {
    last: scriptName,
    timestamp: new Date().toISOString()
  };
  fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), (err) => {
    if (err) writeLog(`ERROR: Failed to save state - ${err.message}`);
  });
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    writeLog(`ERROR: Failed to read state - ${e.message}`);
  }
  return null;
}

// ── routes ───────────────────────────────────────────────────────────────────

app.get('/state', (req, res) => {
  const state = loadState();
  res.json(state || { last: null, timestamp: null });
});

app.post('/run/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const label = (req.body && req.body.label) ? req.body.label : `skrypt${id}`;

  const scriptPath = `/scripts/copy${id}.sh`;

  if (!fs.existsSync(scriptPath)) {
    const msg = `ERROR: Script not found: ${scriptPath}`;
    writeLog(msg);
    return res.status(500).json({ ok: false, message: msg });
  }

  exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      const msg = `ERROR: ${label} - ${error.message}${stderr ? ' | stderr: ' + stderr.trim() : ''}`;
      writeLog(msg);
      return res.status(500).json({ ok: false, message: msg });
    }

    const msg = `OK: ${label} executed successfully${stdout ? ' | ' + stdout.trim() : ''}`;
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
