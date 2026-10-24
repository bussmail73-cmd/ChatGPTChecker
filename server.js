const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const { exec } = require('node:child_process');

const { change2faBatch, MAX_BATCH: MAX_2FA } = require('./lib/change2fa');
const { checkPlanBatch, MAX_BATCH: MAX_CHECK } = require('./lib/checkPlan');
const { getTokenBatch, MAX_BATCH: MAX_TOKEN } = require('./lib/getToken');
const { logoutAllBatch, MAX_BATCH: MAX_LOGOUT } = require('./lib/logoutAll');
const { get2faBatch, MAX_BATCH: MAX_2FA_CODE } = require('./lib/get2fa');
const { verifyCodexBatch, MAX_BATCH: MAX_VERIFY_CODEX } = require('./lib/verifyCodex');
const { checkPhoneBatch, MAX_BATCH: MAX_CHECK_PHONE } = require('./lib/checkPhone');
const fiveSim = require('./lib/fiveSim');
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
    return {
      proxies: '',
      updateUrl: '',
      disableLogs: false,
      fiveSimApiKey: '',
      fiveSimCountry: 'usa',
      fiveSimOperator: 'any'
    };
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
      const currentOperator = getUsernameFromReq(req) || 'admin';
      await handler(combos, async (result) => {
        await logResult(action, result);
        recordUserTelemetry(currentOperator, Boolean(result.ok));
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
app.post('/api/check-phone', batchRoute(checkPhoneBatch, 'check-phone'));
app.post('/api/verify-codex', async (req, res) => {
  const combos = req.body && req.body.combos;
  if (typeof combos !== 'string' || !combos.trim()) {
    res.status(400).json({ error: 'combos (string) is required' });
    return;
  }
  const currentConfig = await readConfig();
  const proxies = (req.body && typeof req.body.proxies === 'string')
    ? req.body.proxies.trim()
    : (currentConfig.proxies || '');
  const apiKey = (req.body && typeof req.body.fiveSimApiKey === 'string' && req.body.fiveSimApiKey.trim())
    ? req.body.fiveSimApiKey.trim()
    : (currentConfig.fiveSimApiKey || '');
  const country = (req.body && typeof req.body.fiveSimCountry === 'string' && req.body.fiveSimCountry.trim())
    ? req.body.fiveSimCountry.trim()
    : (currentConfig.fiveSimCountry || 'any');
  const operator = (req.body && typeof req.body.fiveSimOperator === 'string' && req.body.fiveSimOperator.trim())
    ? req.body.fiveSimOperator.trim()
    : (currentConfig.fiveSimOperator || 'any');
  const maxRetries = (req.body && Number(req.body.fiveSimMaxRetries))
    ? Math.min(15, Math.max(1, Number(req.body.fiveSimMaxRetries)))
    : (Number(currentConfig.fiveSimMaxRetries) || 5);

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  try {
    await verifyCodexBatch(combos, async (result) => {
      await logResult('verify-codex', result);
      if (!res.destroyed) res.write(JSON.stringify(result) + '\n');
    }, proxies, { apiKey, country, operator, maxRetries }, async (event) => {
      if (!res.destroyed) {
        res.write(JSON.stringify({ type: 'step', ...event, timestamp: new Date().toISOString() }) + '\n');
      }
      if (['ALREADY_VERIFIED', 'NUMBER_ACQUIRED', 'SMS_RECEIVED', 'REFUNDED', 'VERIFIED'].includes(event.stage)) {
        await logResult('verify-codex', {
          ok: event.status === 'OK',
          status: event.stage,
          email: event.email || event.account,
          combo: event.combo,
          details: event.message || event.details || event.stage
        });
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[verify-codex] batch failed:', error.message);
    if (!res.destroyed) res.write(JSON.stringify({ ok: false, error: 'Batch interrupted: ' + error.message }) + '\n');
  } finally {
    res.end();
  }
});

app.get('/api/5sim/balance', async (req, res) => {
  const currentConfig = await readConfig();
  const apiKey = (typeof req.query.apiKey === 'string' && req.query.apiKey.trim())
    ? req.query.apiKey.trim()
    : (currentConfig.fiveSimApiKey || '');
  if (!apiKey) {
    return res.status(400).json({ ok: false, error: 'No 5SIM API key provided or configured' });
  }
  const result = await fiveSim.getBalance(apiKey);
  res.json(result);
});

app.get('/api/5sim/prices', async (req, res) => {
  const product = typeof req.query.product === 'string' && req.query.product.trim() ? req.query.product.trim() : 'openai';
  const result = await fiveSim.getPrices(product);
  res.json(result);
});
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
  const param = String(req.params.days || '').trim().toLowerCase();
  const isAll = param === 'all' || param === 'alltime' || param === '0';
  const days = isAll ? 'all' : (parseInt(param, 10) || 1);
  try {
    const allFiles = await listLogs();
    const now = Date.now();
    const maxAgeMs = typeof days === 'number' ? days * 24 * 60 * 60 * 1000 : Infinity;
    const todayStr = new Date().toISOString().slice(0, 10);

    const targetFiles = allFiles.filter((f) => {
      const match = f.name.match(/^(\d{4}-\d{2}-\d{2})\.txt$/);
      if (!match) return false;
      if (isAll) return true;
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
  const autoUpdate = req.body && typeof req.body.autoUpdate === 'boolean' ? req.body.autoUpdate : (current.autoUpdate !== false);
  const whatsappNumber = req.body && typeof req.body.whatsappNumber === 'string' ? req.body.whatsappNumber.trim() : (current.whatsappNumber || '+92 300 0000000');
  const fiveSimApiKey = req.body && typeof req.body.fiveSimApiKey === 'string' ? req.body.fiveSimApiKey.trim() : (current.fiveSimApiKey || '');
  const fiveSimCountry = req.body && typeof req.body.fiveSimCountry === 'string' ? req.body.fiveSimCountry.trim() : (current.fiveSimCountry || 'any');
  const fiveSimOperator = req.body && typeof req.body.fiveSimOperator === 'string' ? req.body.fiveSimOperator.trim() : (current.fiveSimOperator || 'any');
  const fiveSimMaxRetries = req.body && Number(req.body.fiveSimMaxRetries) ? Math.min(15, Math.max(1, Number(req.body.fiveSimMaxRetries))) : (Number(current.fiveSimMaxRetries) || 5);

  setDisableLogs(disableLogs);
  await fs.writeFile(CONFIG_PATH, JSON.stringify({
    proxies,
    updateUrl,
    disableLogs,
    autoUpdate,
    whatsappNumber,
    fiveSimApiKey,
    fiveSimCountry,
    fiveSimOperator,
    fiveSimMaxRetries
  }, null, 2));
  res.json({ ok: true, proxies, updateUrl, disableLogs, autoUpdate, whatsappNumber, fiveSimApiKey, fiveSimCountry, fiveSimOperator, fiveSimMaxRetries });
});

app.get('/api/5sim/prices', async (req, res) => {
  try {
    const product = (req.query && req.query.product) || 'openai';
    const prices = await fiveSim.getPrices(product);
    res.json(prices);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    maxBatch: {
      twofa: MAX_2FA,
      check: MAX_CHECK,
      token: MAX_TOKEN,
      logout: MAX_LOGOUT,
      get2fa: MAX_2FA_CODE,
      verifyCodex: MAX_VERIFY_CODEX,
      checkPhone: MAX_CHECK_PHONE
    }
  });
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


// --- User Management & Session Authentication ---

function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  if (typeof ip === 'string' && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
  return ip || '127.0.0.1';
}

function parseDevice(userAgent) {
  const ua = String(userAgent || '');
  let os = 'Windows PC';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS Device';
  else if (ua.includes('Linux')) os = 'Linux Device';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';

  let browser = 'Chrome';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  return os + ' (' + browser + ')';
}

function getUsernameFromReq(req) {
  const authHeader = req.headers.authorization || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token && req.headers['x-auth-token']) token = req.headers['x-auth-token'];
  if (!token && req.query && req.query.token) token = req.query.token;
  if (!token && req.body && req.body.token) token = req.body.token;
  if (token && activeSessions.has(token)) {
    const sess = activeSessions.get(token);
    sess.lastActive = new Date().toISOString();
    return sess.username;
  }
  return null;
}

async function recordUserTelemetry(username, isSuccess) {
  try {
    const users = await readUsers();
    const u = users.find(x => x.username.toLowerCase() === String(username || '').toLowerCase());
    if (u) {
      u.totalProcessed = (u.totalProcessed || 0) + 1;
      if (isSuccess) {
        u.totalSuccess = (u.totalSuccess || 0) + 1;
      } else {
        u.totalFailed = (u.totalFailed || 0) + 1;
      }
      await writeUsers(users);
    }
  } catch {}
}

const USERS_PATH = process.env.USERS_PATH || path.join(BASE_DIR, 'users.json');
const activeSessions = new Map(); // token -> { username, role, expiresAt }

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}

  const defaultUsers = [
    {
      username: 'admin',
      password: 'admin786#password',
      role: 'admin',
      status: 'active',
      createdAt: '2026-10-24T12:00:00.000Z',
      lastLogin: null
    },
    {
      username: 'operator',
      password: 'operator123#2026',
      role: 'user',
      status: 'active',
      createdAt: '2026-10-24T12:00:00.000Z',
      lastLogin: null
    }
  ];
  await fs.writeFile(USERS_PATH, JSON.stringify(defaultUsers, null, 2), 'utf8').catch(() => {});
  return defaultUsers;
}

async function writeUsers(users) {
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

// Seed default users immediately
readUsers().catch(() => {});

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password, remember } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password are required' });
  }
  const users = await readUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user || user.password !== String(password)) {
    return res.status(401).json({ ok: false, error: 'Invalid username or password. Check credentials and try again.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ ok: false, error: 'This account has been blocked by the administrator. Contact WhatsApp support: +92 322 8784060' });
  }

  const clientIp = getClientIp(req);
  const device = parseDevice(req.headers['user-agent']);
  user.lastLogin = new Date().toISOString();
  user.lastIp = clientIp;
  user.lastDevice = device;
  await writeUsers(users).catch(() => {});

  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (remember ? 90 : 2) * 24 * 60 * 60 * 1000;
  activeSessions.set(token, {
    token,
    username: user.username,
    role: user.role,
    ip: clientIp,
    device,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    expiresAt
  });

  res.json({
    ok: true,
    token,
    user: { username: user.username, role: user.role, status: user.status }
  });
});

app.post('/api/auth/verify', async (req, res) => {
  const token = req.body && req.body.token;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ ok: false, error: 'Session expired or invalid' });
  }
  const sess = activeSessions.get(token);
  if (Date.now() > sess.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ ok: false, error: 'Session expired' });
  }
  const users = await readUsers();
  const user = users.find(u => u.username.toLowerCase() === sess.username.toLowerCase());
  if (!user || user.status === 'blocked') {
    activeSessions.delete(token);
    return res.status(403).json({ ok: false, error: 'Account has been blocked by administrator' });
  }
  res.json({ ok: true, user: { username: user.username, role: user.role, status: user.status } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.body && req.body.token;
  if (token) activeSessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/auth/users', async (req, res) => {
  const users = await readUsers();
  const now = Date.now();

  // Prune expired sessions
  for (const [tok, s] of activeSessions.entries()) {
    if (now > s.expiresAt) activeSessions.delete(tok);
  }

  const enrichedUsers = users.map(u => {
    const userSessions = Array.from(activeSessions.values()).filter(
      s => s.username.toLowerCase() === u.username.toLowerCase()
    );
    const proc = u.totalProcessed || 0;
    const succ = u.totalSuccess || 0;
    const fail = u.totalFailed || 0;
    const rate = proc > 0 ? ((succ / proc) * 100).toFixed(1) + '%' : '100%';

    return {
      ...u,
      activeDevicesCount: userSessions.length,
      devices: userSessions.map(s => ({
        token: s.token.slice(0, 8) + '...',
        fullToken: s.token,
        ip: s.ip,
        device: s.device,
        loginTime: s.loginTime,
        lastActive: s.lastActive
      })),
      totalProcessed: proc,
      totalSuccess: succ,
      totalFailed: fail,
      successRate: rate
    };
  });

  const totalUsers = users.length;
  const activeDevicesTotal = activeSessions.size;
  const globalProcessed = users.reduce((acc, u) => acc + (u.totalProcessed || 0), 0);
  const globalSuccess = users.reduce((acc, u) => acc + (u.totalSuccess || 0), 0);
  const globalRate = globalProcessed > 0 ? ((globalSuccess / globalProcessed) * 100).toFixed(1) + '%' : '100%';

  res.json({
    ok: true,
    users: enrichedUsers,
    stats: {
      totalUsers,
      activeDevicesTotal,
      globalProcessed,
      globalSuccess,
      globalRate
    }
  });
});

app.post('/api/auth/users', async (req, res) => {
  const { action, username, password, newPassword, role, status } = req.body || {};
  const users = await readUsers();
  const targetUser = users.find(u => u.username.toLowerCase() === String(username || '').trim().toLowerCase());

  if (action === 'add') {
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password required' });
    if (targetUser) return res.status(400).json({ ok: false, error: 'Username already exists' });
    users.push({
      username: String(username).trim(),
      password: String(password).trim(),
      role: role === 'admin' ? 'admin' : 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLogin: null
    });
    await writeUsers(users);
    return res.json({ ok: true, users });
  }

  if (action === 'status') {
    if (!targetUser) return res.status(404).json({ ok: false, error: 'User not found' });
    if (targetUser.username.toLowerCase() === 'admin' && status === 'blocked') {
      return res.status(400).json({ ok: false, error: 'Cannot block primary admin account' });
    }
    targetUser.status = status === 'blocked' ? 'blocked' : 'active';
    if (targetUser.status === 'blocked') {
      for (const [tok, s] of activeSessions.entries()) {
        if (s.username.toLowerCase() === targetUser.username.toLowerCase()) {
          activeSessions.delete(tok);
        }
      }
    }
    await writeUsers(users);
    return res.json({ ok: true, users });
  }

  if (action === 'password') {
    if (!targetUser) return res.status(404).json({ ok: false, error: 'User not found' });
    if (!newPassword) return res.status(400).json({ ok: false, error: 'New password required' });
    targetUser.password = String(newPassword).trim();
    await writeUsers(users);
    return res.json({ ok: true, users });
  }

  if (action === 'kill_session') {
    const { sessionToken } = req.body || {};
    if (sessionToken && activeSessions.has(sessionToken)) {
      activeSessions.delete(sessionToken);
    }
    return res.json({ ok: true });
  }

  if (action === 'delete') {
    if (!targetUser) return res.status(404).json({ ok: false, error: 'User not found' });
    if (targetUser.username.toLowerCase() === 'admin') {
      return res.status(400).json({ ok: false, error: 'Cannot delete primary admin account' });
    }
    const idx = users.findIndex(u => u.username.toLowerCase() === targetUser.username.toLowerCase());
    if (idx !== -1) users.splice(idx, 1);
    for (const [tok, s] of activeSessions.entries()) {
      if (s.username.toLowerCase() === targetUser.username.toLowerCase()) {
        activeSessions.delete(tok);
      }
    }
    await writeUsers(users);
    return res.json({ ok: true, users });
  }

  res.status(400).json({ ok: false, error: 'Invalid action' });
});

app.post('/api/shutdown', (req, res) => {
  res.json({ ok: true, message: 'Server shutdown requested' });
  setTimeout(() => {
    process.exit(0);
  }, 400);
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
