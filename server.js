const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const { exec } = require('node:child_process');

const { change2faBatch, MAX_BATCH: MAX_2FA } = require('./lib/change2fa');
const { checkPlanBatch, MAX_BATCH: MAX_CHECK } = require('./lib/checkPlan');
const { getTokenBatch, MAX_BATCH: MAX_TOKEN } = require('./lib/getToken');
const { logoutAllBatch, MAX_BATCH: MAX_LOGOUT } = require('./lib/logoutAll');
const { get2faBatch, MAX_BATCH: MAX_2FA_CODE } = require('./lib/get2fa');
const { logResult, listLogs, logPath, setDisableLogs } = require('./lib/logger');
const { BASE_DIR } = require('./lib/paths');
const { runPython } = require('./lib/runPython');
const updater = require('./lib/updater');

// Persisted config (proxy list, updateUrl, disableLogs, etc.) lives in one JSON file next to the app.
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(BASE_DIR, 'config.json');
async function readConfig() {
  try {
    const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
    if (typeof cfg.disableLogs === 'boolean') {
      setDisableLogs(cfg.disableLogs);
    }
    return cfg;
  } catch {
    return { proxies: '', updateUrl: '', disableLogs: false };
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(BASE_DIR, 'public')));

function batchRoute(handler, action) {
  return async (req, res) => {
    const combos = req.body && req.body.combos;
    if (typeof combos !== 'string' || !combos.trim()) {
      res.status(400).json({ error: 'combos (string) is required' });
      return;
    }
    const currentConfig = await readConfig();
    const proxies = (req.body && typeof req.body.proxies === 'string')
      ? req.body.proxies.trim()
      : (currentConfig.proxies || '');
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    try {
      await handler(combos, async (result) => {
        await logResult(action, result);
        if (!res.destroyed) res.write(JSON.stringify(result) + '\n');
      }, proxies);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error(`[${action}] batch failed:`, error.message);
      if (!res.destroyed) res.write(JSON.stringify({ ok: false, error: 'Batch interrupted: ' + error.message }) + '\n');
    } finally {
      res.end();
    }
  };
}

app.post('/api/change-2fa', batchRoute(change2faBatch, 'change-2fa'));
app.post('/api/change-2fa-team', batchRoute(
  (combos, onResult, proxies) => change2faBatch(combos, onResult, proxies, { accountType: 'workspace' }),
  'change-2fa-team'
));
app.post('/api/check-plan', batchRoute(checkPlanBatch, 'check-plan'));
app.post('/api/check-plus', batchRoute(checkPlanBatch, 'check-plan')); // compatibility
app.post('/api/get-token', batchRoute(getTokenBatch, 'get-token'));
app.post('/api/logout-all', batchRoute(logoutAllBatch, 'logout-all'));
app.post('/api/get-2fa', batchRoute(get2faBatch, 'get-2fa'));
app.post('/api/check-proxy', async (req, res) => {
  const proxies = req.body && typeof req.body.proxies === 'string' ? req.body.proxies : '';
  try {
    const outcome = await runPython('check_proxy.py', [proxies]);
    res.json(outcome);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  res.json(await listLogs());
});

app.get('/api/logs/:name/content', async (req, res) => {
  const file = logPath(req.params.name);
  if (!file) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  try {
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split('\n');
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('---')) continue;
      const parts = line.split('\t');
      if (parts.length >= 4) {
        const rawTime = parts[0];
        let displayTime = rawTime;
        try {
          const d = new Date(rawTime);
          if (!isNaN(d.getTime())) {
            displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }
        } catch {}
        const action = parts[1].replace(/[\[\]]/g, '');
        const status = parts[2];
        const rest = parts.slice(3).join('\t');
        const restParts = rest.split(' | ');
        const account = restParts[0] || '';
        let details = restParts.slice(1).join(' | ');
        // Clean up any internal phrases to clean English
        details = details.replace(/combo_moi:\s*/g, 'New Combo: ')
                         .replace(/combo_cu:\s*/g, 'Old Combo: ')
                         .replace(/combo_du_phong:\s*/g, 'Backup: ')
                         .replace(/ly do:\s*/g, 'Reason: ')
                         .replace(/CHƯA XÁC NHẬN/g, 'Unconfirmed');
        entries.push({
          id: i + 1,
          time: displayTime,
          fullTime: rawTime,
          action,
          status,
          account,
          details,
          raw: line
        });
      } else {
        entries.push({
          id: i + 1,
          time: '',
          fullTime: '',
          action: 'info',
          status: 'INFO',
          account: '',
          details: line,
          raw: line
        });
      }
    }
    // Most recent entries first
    entries.reverse();
    res.json({ name: req.params.name, entries, total: entries.length, content: raw });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs-range/:days', async (req, res) => {
  const days = parseInt(req.params.days, 10) || 1;
  try {
    const allFiles = await listLogs();
    const now = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().slice(0, 10);

    const targetFiles = allFiles.filter((f) => {
      const match = f.name.match(/^(\d{4}-\d{2}-\d{2})\.txt$/);
      if (!match) return false;
      if (days === 1) return match[1] === todayStr;
      const fileDate = new Date(match[1]).getTime();
      return (now - fileDate <= maxAgeMs);
    });

    const entries = [];
    for (const f of targetFiles) {
      const file = logPath(f.name);
      if (!file) continue;
      const raw = await fs.readFile(file, 'utf8').catch(() => '');
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('---')) continue;
        const parts = line.split('\t');
        if (parts.length >= 4) {
          const rawTime = parts[0];
          let displayTime = rawTime;
          try {
            const d = new Date(rawTime);
            if (!isNaN(d.getTime())) {
              displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
          } catch {}
          const action = parts[1].replace(/[\[\]]/g, '');
          const status = parts[2];
          const rest = parts.slice(3).join('\t');
          const restParts = rest.split(' | ');
          const account = restParts[0] || rest;
          let details = restParts.slice(1).join(' | ');
          details = details.replace(/combo_moi:\s*/g, 'New Combo: ')
                           .replace(/combo_cu:\s*/g, 'Old Combo: ')
                           .replace(/combo_du_phong:\s*/g, 'Backup: ')
                           .replace(/ly do:\s*/g, 'Reason: ')
                           .replace(/CHƯA XÁC NHẬN/g, 'Unconfirmed');
          entries.push({
            id: `${f.name}-${i}-${rawTime}`,
            fileName: f.name,
            fileDate: f.name.replace(/\.txt$/, ''),
            time: displayTime,
            fullTime: rawTime,
            action,
            status,
            account,
            details,
            raw: line
          });
        }
      }
    }
    entries.sort((a, b) => b.fullTime.localeCompare(a.fullTime));
    res.json({ ok: true, days, entries, total: entries.length, filesCount: targetFiles.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/logs/:name', (req, res) => {
  const file = logPath(req.params.name);
  if (!file) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.download(file, req.params.name);
});

app.get('/api/config', async (req, res) => {
  res.json(await readConfig());
});

app.post('/api/config', async (req, res) => {
  const current = await readConfig();
  const proxies = req.body && typeof req.body.proxies === 'string' ? req.body.proxies.trim() : '';
  const updateUrl = req.body && typeof req.body.updateUrl === 'string' ? req.body.updateUrl.trim() : (current.updateUrl || '');
  const disableLogs = req.body && typeof req.body.disableLogs === 'boolean' ? req.body.disableLogs : Boolean(current.disableLogs);
  setDisableLogs(disableLogs);
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ proxies, updateUrl, disableLogs }, null, 2));
  res.json({ ok: true, proxies, updateUrl, disableLogs });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, maxBatch: { twofa: MAX_2FA, check: MAX_CHECK, token: MAX_TOKEN, logout: MAX_LOGOUT, get2fa: MAX_2FA_CODE } });
});

// Auto-update endpoints
app.get('/api/update/status', (req, res) => {
  res.json(updater.getStatus());
});

app.get('/api/update/check', async (req, res) => {
  try {
    const config = await readConfig();
    const manifestUrl = (req.query && req.query.url) || config.updateUrl || undefined;
    const status = await updater.checkUpdate({ manifestUrl });
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update/download', async (req, res) => {
  try {
    updater.startDownload().catch((err) => {
      if (process.env.NODE_ENV !== 'production') console.error('[updater] download error:', err.message);
    });
    res.json({ ok: true, status: updater.getStatus() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/update/cancel', async (req, res) => {
  try {
    const status = await updater.cancelDownload();
    res.json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/update/apply', async (req, res) => {
  try {
    const result = await updater.applyUpdate();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function openAppWindow(url) {
  const { exec, spawn } = require('node:child_process');
  const fsSync = require('node:fs');
  const path = require('node:path');

  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe')
  ];

  let browserPath = null;
  for (const c of candidates) {
    if (fsSync.existsSync(c)) {
      browserPath = c;
      break;
    }
  }

  if (browserPath) {
    const child = spawn(browserPath, [`--app=${url}`], { detached: true, stdio: 'ignore' });
    child.unref();
  } else {
    exec(`start "" "${url}"`);
  }
}

if (require.main === module) {
  const PORT = process.env.PORT || 8099;
  const BIND_IP = process.env.BIND_IP || '0.0.0.0';
  const fsSync = require('node:fs');

  // Ensure default embedded python is used if present and not overridden
  if (!process.env.PYTHON_BIN) {
    const defaultPy = path.join(__dirname, 'python', 'python.exe');
    if (fsSync.existsSync(defaultPy)) {
      process.env.PYTHON_BIN = defaultPy;
    }
  }

  const server = app.listen(PORT, BIND_IP, async () => {
    const url = `http://localhost:${PORT}`;
    console.log(`ChatGPT Checker listening on ${BIND_IP}:${PORT}  ->  ${url}`);

    // Check for auto-update ACK argument from updater helper
    const ackIdx = process.argv.indexOf('--portable-update-ack');
    if (ackIdx !== -1 && process.argv[ackIdx + 1]) {
      const ackPath = process.argv[ackIdx + 1];
      try {
        let appVer = '1.5.0';
        try { appVer = require('./package.json').version; } catch {}
        await fs.writeFile(ackPath, JSON.stringify({
          ok: true,
          version: appVer,
          pid: process.pid,
          time: new Date().toISOString()
        }), 'utf8');
        if (process.env.NODE_ENV !== 'production') console.log(`[updater] Health ACK verified: ${ackPath}`);
      } catch (ackErr) {
        if (process.env.NODE_ENV !== 'production') console.error('[updater] Failed to write ACK file:', ackErr.message);
      }
    }

    if (process.env.NO_OPEN_BROWSER !== '1') {
      openAppWindow(url);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      openAppWindow(`http://localhost:${PORT}`);
      setTimeout(() => process.exit(0), 400);
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = { app, batchRoute };
