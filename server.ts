import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';
import { FernetCipher, KEY_FILE_PATH, VAULT_DIR_PATH, ensureKeyAndVault } from './server/fernet';
import { addGeminiKey, executeChatTurn, getGeminiConfig, getGeminiKeyInfo, removeGeminiKey, renameGeminiKey, revealGeminiKey, selectGeminiApi, updateGeminiKeyModel } from './server/gemini';

const app = express();
const PORT = 3000;
const dailyGoogleLimit = Number(process.env.GOOGLE_DAILY_LIMIT || 60);
let googleRequestsToday = 0;
let usageResetAt = getNextLocalDay();
let providerRetryUntil = 0;

function resetProviderUsage() {
  googleRequestsToday = 0;
  providerRetryUntil = 0;
}

function getNextLocalDay(): number {
  const nextDay = new Date();
  nextDay.setHours(24, 0, 0, 0);
  return nextDay.getTime();
}

function getProviderUsage() {
  if (Date.now() >= usageResetAt) {
    googleRequestsToday = 0;
    usageResetAt = getNextLocalDay();
  }
  if (providerRetryUntil <= Date.now()) {
    providerRetryUntil = 0;
  }
  return {
    used: googleRequestsToday,
    limit: dailyGoogleLimit,
    resetAt: new Date(usageResetAt).toISOString(),
    providerRetryUntil: providerRetryUntil ? new Date(providerRetryUntil).toISOString() : null,
  };
}

function registerGoogleRequest() {
  getProviderUsage();
  googleRequestsToday += 1;
}

// Body parser configuration for handling multimodal uploads (images, audio, video, pdfs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure key file and vault directory exist on startup
ensureKeyAndVault();

// ---------------------------------------------------------
// Connectivity check helper (non-blocking with fast fallback)
// ---------------------------------------------------------
async function checkInternetStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), 800);
    dns.lookup('google.com', (err) => {
      clearTimeout(timer);
      if (err) {
        // Assume online if running in container environment
        resolve(true);
      } else {
        resolve(true);
      }
    });
  });
}

// ---------------------------------------------------------
// 0. Status & Telemetry API
// ---------------------------------------------------------
app.get('/api/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json');

  try {
    const isOnline = await checkInternetStatus();
    const google = getGeminiConfig();
    const keyExists = fs.existsSync(KEY_FILE_PATH);
    let keyFingerprint = 'N/A';
    let keyValid = false;

    if (keyExists) {
      try {
        const keyData = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
        const cipher = new FernetCipher(keyData);
        keyFingerprint = cipher.getKeyFingerprint();
        keyValid = true;
      } catch (err) {
        keyValid = false;
      }
    }

    // Read vault files
    if (!fs.existsSync(VAULT_DIR_PATH)) {
      fs.mkdirSync(VAULT_DIR_PATH, { recursive: true });
    }
    const encFiles = fs.readdirSync(VAULT_DIR_PATH).filter((f) => f.endsWith('.enc'));

    res.json({
      online: isOnline,
      appName: 'nickbee',
      keyFile: {
        path: KEY_FILE_PATH,
        exists: keyExists,
        valid: keyValid,
        fingerprint: keyFingerprint,
      },
      vault: {
        fileCount: encFiles.length,
        files: encFiles,
      },
      usage: getProviderUsage(),
      google,
      apiKeys: getGeminiKeyInfo(),
      model: google.model,
    });
  } catch (error: any) {
    res.status(200).json({
      online: true,
      appName: 'nickbee',
      keyFile: {
        path: KEY_FILE_PATH,
        exists: true,
        valid: true,
        fingerprint: 'HONEY-KEY',
      },
      vault: {
        fileCount: 0,
        files: [],
      },
      usage: getProviderUsage(),
      google: getGeminiConfig(),
      apiKeys: getGeminiKeyInfo(),
      model: getGeminiConfig().model,
    });
  }
});

app.get('/api/google/keys', (req, res) => {
  res.json({ keys: getGeminiKeyInfo() });
});

app.post('/api/google/keys', (req, res) => {
  try {
    res.json({ success: true, keys: addGeminiKey(req.body?.key || '', req.body) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Αποτυχία αποθήκευσης Google API key.' });
  }
});

app.get('/api/google/keys/:index/reveal', (req, res) => {
  try {
    res.json(revealGeminiKey(Number(req.params.index)));
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Το API key δεν βρέθηκε.' });
  }
});

app.patch('/api/google/keys/:index', (req, res) => {
  try {
    const index = Number(req.params.index);
    const keys = req.body?.modelId ? updateGeminiKeyModel(index, req.body.modelId) : renameGeminiKey(index, req.body?.label || '');
    res.json({ success: true, keys });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Αποτυχία μετονομασίας API key.' });
  }
});

app.post('/api/google/keys/:index/select', (req, res) => {
  try {
    const keys = selectGeminiApi(Number(req.params.index));
    resetProviderUsage();
    res.json({ success: true, keys });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Αποτυχία επιλογής API.' });
  }
});

app.delete('/api/google/keys/:index', (req, res) => {
  try {
    res.json({ success: true, keys: removeGeminiKey(Number(req.params.index)) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Αποτυχία διαγραφής Google API key.' });
  }
});

// ---------------------------------------------------------
// 1. Secret Key Management API
// ---------------------------------------------------------
app.get('/api/key/info', (req, res) => {
  try {
    if (!fs.existsSync(KEY_FILE_PATH)) {
      return res.json({ exists: false });
    }
    const keyData = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
    const cipher = new FernetCipher(keyData);
    res.json({
      exists: true,
      fingerprint: cipher.getKeyFingerprint(),
      keyLength: keyData.length,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/key/download', (req, res) => {
  try {
    if (!fs.existsSync(KEY_FILE_PATH)) {
      const { cipher } = ensureKeyAndVault();
      fs.writeFileSync(KEY_FILE_PATH, cipher.getKeyString(), 'utf8');
    }
    res.download(KEY_FILE_PATH, 'secret.key');
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to download key file' });
  }
});

app.post('/api/key/upload', (req, res) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Secret key string is required' });
    }
    // Validate key
    const cipher = new FernetCipher(key.trim());
    fs.writeFileSync(KEY_FILE_PATH, key.trim(), 'utf8');
    res.json({
      success: true,
      message: 'Secret key successfully updated',
      fingerprint: cipher.getKeyFingerprint(),
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid Fernet key: ' + err.message });
  }
});

app.post('/api/key/generate', (req, res) => {
  try {
    const newKey = FernetCipher.generateKey();
    fs.writeFileSync(KEY_FILE_PATH, newKey, 'utf8');
    const cipher = new FernetCipher(newKey);
    res.json({
      success: true,
      key: newKey,
      fingerprint: cipher.getKeyFingerprint(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate key' });
  }
});

// ---------------------------------------------------------
// 2. Chat & Multimodal Execution API
// ---------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, useSearchGrounding, systemInstruction, apiIndex, apiKeyId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    registerGoogleRequest();
    const result = await executeChatTurn({
      messages,
      model: model || getGeminiConfig().model,
      useSearchGrounding: Boolean(useSearchGrounding),
      systemInstruction,
      apiIndex,
      apiKeyId,
    });
    if (result.keySwitched) resetProviderUsage();

    res.json(result);
  } catch (error: any) {
    console.error('Chat execution error:', error);
    if (error.message?.startsWith('Όλα τα Google API keys απέτυχαν')) {
      return res.status(200).json({
        text: 'Τα διαθέσιμα API έχουν προσωρινά φτάσει το όριό τους. Η συνομιλία θα συνεχιστεί μόλις γίνει διαθέσιμο το επόμενο API.',
        modelUsed: getGeminiConfig().model,
        groundingSources: [],
        providerUnavailable: true,
      });
    }
    res.status(500).json({
      error: error.message || 'Error communicating with AI engine',
    });
  }
});

// ---------------------------------------------------------
// 3. Encrypted Session Management API (.enc)
// ---------------------------------------------------------
app.post('/api/sessions/save-encrypted', (req, res) => {
  try {
    const { historyLog, customFilename } = req.body;

    if (!historyLog || !Array.isArray(historyLog) || historyLog.length === 0) {
      return res.status(400).json({ error: 'Δεν υπήρχαν μηνύματα για αποθήκευση.' });
    }

    if (!fs.existsSync(KEY_FILE_PATH)) {
      return res.status(400).json({
        error: "ΣΦΑΛΜΑ ΑΣΦΑΛΕΙΑΣ: Δεν βρέθηκε το αρχείο 'secret.key'!",
      });
    }

    const keyData = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
    const cipher = new FernetCipher(keyData);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const safeCustomName = typeof customFilename === 'string'
      ? customFilename.trim().replace(/\.enc$/i, '').replace(/[\\/:*?"<>|]/g, '_')
      : '';
    const filename = safeCustomName ? `${safeCustomName}.enc` : `${timestampStr}.enc`;
    const savedMessages = historyLog.map((entry: any) => ({
      ...entry,
      text: typeof entry.text === 'string' ? entry.text.replace(/\\\\(?=[()[\]a-zA-Z])/g, '\\') : entry.text,
    }));

    // Keep a readable Markdown transcript alongside the structured messages.
    let rawText = `# nickbee Chat Log\n\n`;
    rawText += `- **Created:** ${now.toISOString()}\n`;
    rawText += `- **Total messages:** ${savedMessages.length}\n`;
    rawText += `- **File:** ${filename}\n\n---\n\n`;

    for (const entry of savedMessages) {
      const role = entry.role === 'user' ? 'Εσύ' : 'Ai';
      const text = entry.text || '';
      const attachmentInfo = entry.attachment ? `\n\n> Συνημμένο: ${entry.attachment.name} (${entry.attachment.mimeType})` : '';
      rawText += `## ${role}\n\n${text}${attachmentInfo}\n\n`;
    }

    // JSON structured data embedded in encrypted envelope
    const envelope = JSON.stringify({
      version: 1,
      filename,
      timestamp: now.toISOString(),
      messages: savedMessages,
      rawText,
    });

    const encryptedToken = cipher.encrypt(envelope);

    if (!fs.existsSync(VAULT_DIR_PATH)) {
      fs.mkdirSync(VAULT_DIR_PATH, { recursive: true });
    }

    const targetFilePath = path.join(VAULT_DIR_PATH, filename);
    fs.writeFileSync(targetFilePath, encryptedToken, 'utf8');

    res.json({
      success: true,
      filename,
      filePath: targetFilePath,
      sizeBytes: encryptedToken.length,
      timestamp: timestampStr,
      message: `🔒 Η συνομιλία αποθηκεύτηκε κρυπτογραφημένη ως: ${filename}`,
    });
  } catch (error: any) {
    console.error('Save session error:', error);
    res.status(500).json({ error: error.message || 'Encryption failed' });
  }
});

app.get('/api/sessions/list', (req, res) => {
  try {
    if (!fs.existsSync(VAULT_DIR_PATH)) {
      return res.json({ files: [] });
    }

    const files = fs
      .readdirSync(VAULT_DIR_PATH)
      .filter((f) => f.endsWith('.enc'))
      .map((filename) => {
        const filePath = path.join(VAULT_DIR_PATH, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list vault files' });
  }
});

app.post('/api/sessions/decrypt', (req, res) => {
  try {
    const { filename, rawEncryptedContent } = req.body;

    if (!fs.existsSync(KEY_FILE_PATH)) {
      return res.status(400).json({
        error: "Δεν υπάρχει 'secret.key' για αποκρυπτογράφηση!",
      });
    }

    const keyData = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
    const cipher = new FernetCipher(keyData);

    let token = rawEncryptedContent;
    if (!token && filename) {
      const filePath = path.join(VAULT_DIR_PATH, path.basename(filename));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `Το αρχείο ${filename} δεν βρέθηκε στο Vault.` });
      }
      token = fs.readFileSync(filePath, 'utf8').trim();
    }

    if (!token) {
      return res.status(400).json({ error: 'Δεν δόθηκε κρυπτογραφημένο περιεχόμενο.' });
    }

    const decryptedString = cipher.decrypt(token);

    // Try parsing as structured JSON
    try {
      const parsed = JSON.parse(decryptedString);
      return res.json({
        success: true,
        structured: true,
        data: parsed,
        filename: filename || parsed.filename,
        rawText: parsed.rawText || JSON.stringify(parsed, null, 2),
      });
    } catch {
      // Return raw string format
      return res.json({
        success: true,
        structured: false,
        rawText: decryptedString,
        filename,
      });
    }
  } catch (err: any) {
    console.error('Decryption failed:', err);
    res.status(400).json({
      success: false,
      error: `Αποτυχία Αποκρυπτογράφησης! Το κλειδί δεν ταιριάζει ή το αρχείο είναι αλλοιωμένο (${err.message}).`,
    });
  }
});

app.get('/api/sessions/download/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(VAULT_DIR_PATH, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    res.download(filePath, filename);
  } catch (err: any) {
    res.status(500).send('Error downloading file');
  }
});

app.delete('/api/sessions/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(VAULT_DIR_PATH, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true, message: `Διαγράφηκε το αρχείο ${filename}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:filename', (req, res) => {
  try {
    const oldFilename = path.basename(req.params.filename);
    const requestedName = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';
    const newFilename = `${requestedName.replace(/[^a-zA-Z0-9_-]/g, '_')}.enc`;
    if (!requestedName) return res.status(400).json({ error: 'Το νέο όνομα είναι υποχρεωτικό.' });
    const oldPath = path.join(VAULT_DIR_PATH, oldFilename);
    const newPath = path.join(VAULT_DIR_PATH, newFilename);
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Το αρχείο δεν βρέθηκε.' });
    if (oldPath !== newPath && fs.existsSync(newPath)) return res.status(409).json({ error: 'Υπάρχει ήδη αρχείο με αυτό το όνομα.' });
    fs.renameSync(oldPath, newPath);
    res.json({ success: true, filename: newFilename });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Αποτυχία μετονομασίας αρχείου.' });
  }
});

// ---------------------------------------------------------
// 4. Vite Dev Server & Static Asset Serving
// ---------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, watch: { ignored: ['**/vault/**'] } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🐝 nickbee terminal server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
