// ── active button ────────────────────────────────────────────────
function setActiveButton(label) {
  document.querySelectorAll('.script-btn').forEach(btn => {
    const btnLabel = btn.querySelector('.btn-label').textContent.trim();
    if (btnLabel === label) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ── load state on page init ──────────────────────────────────────
async function loadState() {
  try {
    const res = await fetch('/state');
    const data = await res.json();
    if (data.last) {
      setStatus(data.last, data.timestamp, false);
      setActiveButton(data.last);
    }
  } catch (e) {
    console.error('Could not load state:', e);
  }
}

function setStatus(scriptName, timestamp, isError) {
  const sv = document.getElementById('statusValue');
  const st = document.getElementById('statusTime');
  sv.textContent = scriptName;
  sv.className = 'status-value' + (isError ? ' error' : '');
  if (timestamp) {
    const d = new Date(timestamp);
    st.textContent = d.toLocaleString('pl-PL', { hour12: false });
  }
}

// ── run script ───────────────────────────────────────────────────
async function runScript(id) {
  const btn   = document.getElementById('btn' + id);
  const bs    = document.getElementById('bs'  + id);
  const label = btn.querySelector('.btn-label').textContent.trim();

  document.querySelectorAll('.script-btn').forEach(b => b.classList.remove('active'));
  btn.className = 'script-btn running';
  bs.textContent = 'EXECUTING...';

  try {
    const res  = await fetch('/run/' + id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    });
    const data = await res.json();

    if (data.ok) {
      btn.className = 'script-btn success';
      bs.textContent = 'OK';
      setStatus(label, new Date().toISOString(), false);
      setTimeout(() => {
        btn.className = 'script-btn active';
        bs.textContent = '';
        setActiveButton(label);
      }, 3000);
    } else {
      btn.className = 'script-btn fail';
      bs.textContent = 'ERROR';
      setStatus(label + ' — BŁĄD', new Date().toISOString(), true);
      setTimeout(() => {
        btn.className = 'script-btn';
        bs.textContent = '';
      }, 3000);
    }
  } catch (e) {
    btn.className = 'script-btn fail';
    bs.textContent = 'ERROR';
    setStatus(label + ' — BŁĄD POŁĄCZENIA', new Date().toISOString(), true);
    setTimeout(() => {
      btn.className = 'script-btn';
      bs.textContent = '';
    }, 3000);
  }
}

// ── footer clock ─────────────────────────────────────────────────
function updateClock() {
  document.getElementById('footerTime').textContent =
    new Date().toLocaleTimeString('pl-PL', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

loadState();