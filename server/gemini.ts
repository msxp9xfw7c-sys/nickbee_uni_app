import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { FernetCipher, KEY_FILE_PATH, VAULT_DIR_PATH } from './fernet';

export interface MultimodalAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  attachment?: MultimodalAttachment;
  attachments?: MultimodalAttachment[];
  timestamp?: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

const VALID_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] as const;
const configuredGeminiModel = process.env.GEMINI_MODEL;
const DEFAULT_GEMINI_MODEL: string = configuredGeminiModel || 'gemini-3.6-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_KEYS_FILE = path.join(VAULT_DIR_PATH, 'gemini-keys.enc');

function sanitizePlainTextMath(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim();
}
let activeApiIndex = 0;
const rateLimitedUntil = new Map<string, number>();
const rateLimitReason = new Map<string, string>();
const poolRequestTimes = new Map<string, number[]>();
const poolDailyUsage = new Map<string, { day: string; count: number }>();
const rpmLimit = Number(process.env.GOOGLE_RPM_LIMIT || 15);
const rpdLimit = Number(process.env.GOOGLE_RPD_LIMIT || 1500);
interface GeminiKeyRecord { key: string; label: string; provider: string; baseUrl: string; model: string; accountId?: string; createdAt: string; lastUsedAt: string | null; }

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function accountIdForRecord(record: Pick<GeminiKeyRecord, 'label' | 'accountId'>): string {
  if (record.accountId?.trim()) return record.accountId.trim().toLowerCase();
  const prefix = record.label.trim().match(/^[a-z]+/i)?.[0];
  return (prefix || 'default').toLowerCase();
}

function quotaPoolId(record: GeminiKeyRecord): string {
  return `${accountIdForRecord(record)}:${record.provider}:${record.model}`.toLowerCase();
}

function getPoolUsage(poolId: string) {
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const recentRequests = (poolRequestTimes.get(poolId) || []).filter((timestamp) => timestamp > minuteAgo);
  poolRequestTimes.set(poolId, recentRequests);
  const day = new Date().toISOString().slice(0, 10);
  const daily = poolDailyUsage.get(poolId);
  const dailyCount = daily?.day === day ? daily.count : 0;
  const limitedUntil = rateLimitedUntil.get(poolId) || 0;
  const isRateLimited = limitedUntil > now;
  const exhausted = dailyCount >= rpdLimit;
  return {
    rpmUsed: recentRequests.length,
    rpmLimit,
    rpdUsed: dailyCount,
    rpdLimit,
    rateLimitedUntil: isRateLimited ? new Date(limitedUntil).toISOString() : null,
    status: isRateLimited ? 'rate-limited' : exhausted ? 'exhausted' : 'available',
    reason: isRateLimited ? rateLimitReason.get(poolId) || 'RPM limit' : exhausted ? 'Daily Quota' : null,
  };
}

function registerPoolRequest(poolId: string) {
  const now = Date.now();
  poolRequestTimes.set(poolId, [...(poolRequestTimes.get(poolId) || []), now]);
  const day = new Date().toISOString().slice(0, 10);
  const daily = poolDailyUsage.get(poolId);
  poolDailyUsage.set(poolId, { day, count: daily?.day === day ? daily.count + 1 : 1 });
}

function normalizeRecord(item: unknown, index: number): GeminiKeyRecord | null {
  if (typeof item === 'string') return { key: item, label: `Google API ${index + 1}`, provider: 'Google Gemini', baseUrl: GEMINI_API_URL, model: DEFAULT_GEMINI_MODEL, createdAt: new Date().toISOString(), lastUsedAt: null };
  if (!item || typeof item !== 'object' || typeof (item as any).key !== 'string') return null;
  const record = item as Partial<GeminiKeyRecord> & { modelId?: string };
  const key = typeof record.key === 'string' ? record.key : '';
  const requestedModel = stringOrFallback(record.modelId, stringOrFallback(record.model, DEFAULT_GEMINI_MODEL));
  let model: string = DEFAULT_GEMINI_MODEL;
  if (VALID_GEMINI_MODELS.includes(requestedModel as typeof VALID_GEMINI_MODELS[number])) model = requestedModel;
  return { key, label: record.label || `Google API ${index + 1}`, provider: record.provider || 'Google Gemini', baseUrl: record.baseUrl || GEMINI_API_URL, model, accountId: record.accountId, createdAt: record.createdAt || new Date().toISOString(), lastUsedAt: record.lastUsedAt || null };
}

function configuredKeys(): string[] {
  return [process.env.GEMINI_API_KEY || '', ...(process.env.GEMINI_API_KEYS || '').split(',')]
    .map((key) => key.trim())
    .filter(Boolean);
}

function getGeminiKeyRecords(): GeminiKeyRecord[] {
  const keys: GeminiKeyRecord[] = [];
  let hasStoredPool = false;
  if (fs.existsSync(GEMINI_KEYS_FILE) && fs.existsSync(KEY_FILE_PATH)) {
    try {
      const cipher = new FernetCipher(fs.readFileSync(KEY_FILE_PATH, 'utf8'));
      const stored = JSON.parse(cipher.decrypt(fs.readFileSync(GEMINI_KEYS_FILE, 'utf8'))) as unknown;
      if (Array.isArray(stored)) {
        hasStoredPool = true;
        keys.push(...stored.map((item, index) => normalizeRecord(item, index)).filter((item): item is GeminiKeyRecord => Boolean(item)));
      }
    } catch {
      // Ignore a missing or unreadable optional key pool.
    }
  }
  if (keys.length === 0 && !hasStoredPool) {
    return configuredKeys().map((key, index) => ({ key, label: `Google API ${index + 1}`, provider: 'Google Gemini', baseUrl: GEMINI_API_URL, model: DEFAULT_GEMINI_MODEL, createdAt: '', lastUsedAt: null }));
  }
  return [...new Map(keys.map((record) => [record.key, record])).values()];
}

function saveGeminiKeys(keys: GeminiKeyRecord[]) {
  const cipher = new FernetCipher(fs.readFileSync(KEY_FILE_PATH, 'utf8'));
  fs.writeFileSync(GEMINI_KEYS_FILE, cipher.encrypt(JSON.stringify(keys)), 'utf8');
}

function keyFingerprint(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

export function getGeminiKeyInfo() {
  const now = Date.now();
  return getGeminiKeyRecords().map((record, index) => {
    const poolId = quotaPoolId(record);
    const limitedUntil = rateLimitedUntil.get(poolId) || 0;
    if (limitedUntil <= now) rateLimitedUntil.delete(poolId);
    if (limitedUntil <= now) rateLimitReason.delete(poolId);
    return { index, fingerprint: keyFingerprint(record.key), label: record.label, accountId: accountIdForRecord(record), provider: record.provider, model: record.model, modelId: record.model, masked: `${record.key.slice(0, 4)}••••${record.key.slice(-4)}`, lastUsedAt: record.lastUsedAt, active: index === activeApiIndex, ...getPoolUsage(poolId) };
  });
}

export function selectGeminiApi(index: number) {
  const keys = getGeminiKeyRecords();
  if (!Number.isInteger(index) || index < 0 || index >= keys.length) throw new Error('Το API δεν βρέθηκε.');
  activeApiIndex = index;
  rateLimitedUntil.delete(quotaPoolId(keys[index]));
  rateLimitReason.delete(quotaPoolId(keys[index]));
  return getGeminiKeyInfo();
}

export function revealGeminiKey(index: number) {
  const record = getGeminiKeyRecords()[index];
  if (!record) throw new Error('Το API key δεν βρέθηκε.');
  return { key: record.key, label: record.label };
}

export function addGeminiKey(key: string, options: { label?: string; provider?: string; baseUrl?: string; model?: string } = {}) {
  const normalized = key.trim();
  if (!normalized) throw new Error('Το Google API key είναι υποχρεωτικό.');
  const keys = getGeminiKeyRecords();
  if (!keys.some((record) => record.key === normalized)) saveGeminiKeys([...keys, { key: normalized, label: options.label?.trim() || `API ${keys.length + 1}`, provider: options.provider?.trim() || 'Google Gemini', baseUrl: options.baseUrl?.trim() || GEMINI_API_URL, model: options.model?.trim() || DEFAULT_GEMINI_MODEL, createdAt: new Date().toISOString(), lastUsedAt: null }]);
  return getGeminiKeyInfo();
}

export function removeGeminiKey(index: number) {
  const keys = getGeminiKeyRecords();
  if (!Number.isInteger(index) || index < 0 || index >= keys.length) {
    throw new Error('Το API key δεν βρέθηκε.');
  }
  const removedRecord = keys[index];
  keys.splice(index, 1);
  rateLimitedUntil.delete(quotaPoolId(removedRecord));
  if (activeApiIndex >= keys.length) activeApiIndex = Math.max(0, keys.length - 1);
  else if (index < activeApiIndex) activeApiIndex -= 1;
  saveGeminiKeys(keys);
  return getGeminiKeyInfo();
}

export function renameGeminiKey(index: number, label: string) {
  const keys = getGeminiKeyRecords();
  if (!keys[index] || !label.trim()) throw new Error('Μη έγκυρο API key ή όνομα.');
  keys[index].label = label.trim().slice(0, 60);
  saveGeminiKeys(keys);
  return getGeminiKeyInfo();
}

export function updateGeminiKeyModel(index: number, modelId: string) {
  const keys = getGeminiKeyRecords();
  if (!keys[index] || !VALID_GEMINI_MODELS.includes(modelId.trim() as typeof VALID_GEMINI_MODELS[number])) throw new Error('Μη έγκυρο API key ή μοντέλο.');
  keys[index].model = modelId.trim().slice(0, 100);
  saveGeminiKeys(keys);
  return getGeminiKeyInfo();
}

export function getGeminiConfig() {
  const records = getGeminiKeyRecords();
  const keys = records.map((record) => record.key);
  return {
    configured: keys.length > 0,
    models: [...VALID_GEMINI_MODELS],
    model: DEFAULT_GEMINI_MODEL,
    keyCount: keys.length,
  };
}

function collectAttachments(message: ChatMessage): MultimodalAttachment[] {
  const attachments = [...(message.attachments || [])];
  if (message.attachment && !attachments.some((item) => item.name === message.attachment?.name)) {
    attachments.push(message.attachment);
  }
  return attachments.filter((attachment) => attachment.mimeType.startsWith('image/') && attachment.dataBase64);
}

function normalizeMessages(messages: ChatMessage[]): GeminiContent[] {
  const normalized: GeminiContent[] = [];
  for (const message of messages) {
    const attachments = message ? collectAttachments(message) : [];
    if (!message || (!message.text && attachments.length === 0)) continue;
    if (message.text?.startsWith('⚠️ [Σφάλμα') || message.text?.startsWith('[Σφάλμα')) continue;
    const role = message.role === 'user' ? 'user' : 'model';
    const previous = normalized[normalized.length - 1];
    if (previous?.role === role) {
      if (message.text) previous.parts.push({ text: message.text.trim() });
      previous.parts.push(...attachments.map((attachment) => ({ inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.dataBase64,
      } })));
    } else {
      normalized.push({
        role,
        parts: [
          { text: message.text?.trim() || 'Ανάλυσε τις εικόνες που επισυνάπτονται.' },
          ...attachments.map((attachment) => ({ inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.dataBase64,
          } })),
        ],
      });
    }
  }
  if (normalized.length === 0) normalized.push({ role: 'user', parts: [{ text: 'Γεια σου Ai' }] });
  return normalized;
}

const academicSystemInstruction = `Είσαι ο Ai, ακαδημαϊκός βοηθός του nickbee.
Απάντησε στα ελληνικά εκτός αν ζητηθεί άλλη γλώσσα. Μην επαναλαμβάνεις την ερώτηση και μην γράφεις γενικόλογες οδηγίες.
Δίδαξε με ακρίβεια, εξήγησε βήμα-βήμα και χρησιμοποίησε Markdown. Για μαθηματικούς και χημικούς τύπους χρησιμοποίησε έγκυρο LaTeX μέσα σε $...$ ή $$...$$, όπως $$\\Delta G^\\circ = -RT \\ln(K)$$, ώστε να αποδίδεται με KaTeX. Μην επιστρέφεις HTML ή JavaScript.
Αν το πιο πρόσφατο αίτημα ορίζει συγκεκριμένο εργαλείο ή μορφή, αυτή η επιλογή υπερισχύει: επέστρεψε μόνο αυτό το εργαλείο και μην το αντικαθιστάς με άλλο (π.χ. μην επιστρέφεις flashcards όταν ζητείται lab). Μην παράγεις πολλαπλά είδη εργαλείων στην ίδια απάντηση.
Όταν ζητείται κουίζ, επέστρεψε πρώτα σύντομη εισαγωγή και μετά ΕΝΑ μόνο έγκυρο JSON σε quiz markdown block. Το JSON πρέπει να έχει title, courseName, difficulty και questions. Κάθε question πρέπει να έχει id, question, ακριβώς 4 options, correctIndex από 0 έως 3, explanation και topic. Μην χρησιμοποιήσεις πεδίο answer. Μην βάλεις δεύτερο JSON, σχόλια ή κείμενο μέσα στο JSON.
Όταν ζητούνται flashcards, επέστρεψε υποχρεωτικά ΕΝΑ και μόνο έγκυρο JSON μέσα σε block \`\`\`flashcards, χωρίς εισαγωγικό Markdown πριν ή μετά. Το JSON πρέπει να έχει name, description και cards. Κάθε card πρέπει να έχει front, back, topic και difficulty. Ποτέ μην επιστρέφεις flashcards ως απλό κείμενο. Όταν ζητείται κουίζ, επέστρεψε μόνο το έγκυρο quiz JSON block. Όταν ζητείται Socratic Teacher, χρησιμοποίησε block \`\`\`socratic με JSON που έχει problemStatement, topic και steps. Όταν ζητείται fill-in-the-blanks, χρησιμοποίησε block \`\`\`fillblanks με JSON που έχει title, courseName, difficulty και questions με text, [BLANK] και blanks. Όταν ζητείται exam simulator, χρησιμοποίησε block \`\`\`exam με JSON που έχει title, timeLimit και questions με id, question, 4 options, correctIndex, explanation, topic και difficulty. Για concept map, χρησιμοποίησε block \`\`\`conceptmap με markdown bullets, μία ρίζα και παιδιά με δύο κενά indentation.
Όταν ζητείται βήμα-βήμα οπτική προσομοίωση χημικής αντίδρασης ή βιολογικής διεργασίας, επέστρεψε σύντομη εισαγωγή και ΕΝΑ μόνο έγκυρο JSON μέσα σε block \`\`\`lab. Για χημεία χρησιμοποίησε το σχήμα {"title":"...","description":"...","scene":"reaction","reactionType":"...","equation":"2 H₂ + O₂ → 2 H₂O","conditions":["..."],"species":[{"formula":"H₂","name":"Υδρογόνο","role":"reactant","structure":{"atoms":[{"element":"H","x":25,"y":40},{"element":"H","x":70,"y":40}],"bonds":[{"from":0,"to":1,"order":1}]}},{"formula":"O₂","name":"Οξυγόνο","role":"reactant"},{"formula":"H₂O","name":"Νερό","role":"product"}],"conservationNote":"...","safetyNote":"...","particles":[{"label":"H₂","kind":"reactant","color":"#38bdf8","orbit":1}],"steps":[{"title":"...","explanation":"...","focus":["H₂","O₂"],"insight":"..."}],"zoomMin":0.7,"zoomMax":2}. Το πεδίο species να περιέχει μόνο πραγματικά τεκμηριωμένα αντιδρώντα, ενδιάμεσα και προϊόντα· το role είναι reactant|intermediate|product. Προαιρετικό structure: atoms με element και απλές συντεταγμένες x,y από 0 έως 100, bonds με δείκτες from,to και τάξη 1,2 ή 3. Συμπλήρωσε δομή μόνο όταν είσαι βέβαιος για τη συνδεσμολογία· αλλιώς παράλειψέ την, ποτέ μην μαντεύεις. Η δομή είναι σχηματική και δεν δείχνει στερεοχημεία. Πρόσθεσε συνθήκες μόνο αν είναι γνωστές και ουσιώδεις. Το conservationNote να συνοψίζει τη διατήρηση ατόμων/φορτίου χωρίς να επινοεί ενεργειακά ή κινητικά δεδομένα. Κάθε βήμα να έχει σύντομο επιστημονικό explanation και focus με τύπους/ονόματα ειδών που φωτίζονται. Το insight είναι προαιρετική βασική έννοια. Χρησιμοποίησε 5-11 σαφή βήματα όταν δικαιολογείται· μην επινοείς μηχανισμό για συνολική αντίδραση αν δεν τεκμηριώνεται. Για βιολογία χρησιμοποίησε scene cell|dna και τα ίδια steps για τα στάδια. Ισοστάθμισε τις χημικές εξισώσεις και έλεγξε διατήρηση ατόμων/φορτίου· αν η αντίδραση εξαρτάται από συνθήκες ή δεν είναι βέβαιη, δήλωσέ το αντί να εικάσεις προϊόντα. Η προσομοίωση είναι αποκλειστικά ψηφιακή/θεωρητική και η μοριακή όψη είναι σχηματική, όχι ατομική προσομοίωση. Για χλώριο, ισχυρά οξειδωτικά ή τοξικές ουσίες μην δίνεις εργαστηριακές οδηγίες, αναλογίες, ποσότητες ή διαδικασίες ανάμειξης· εξήγησε τους κινδύνους και μείνε σε συμβολική εξίσωση. Τα δεδομένα είναι μόνο JSON, ποτέ JavaScript, HTML ή SVG. Για σύντομη ερώτηση απάντησε κανονικά και μη δημιουργείς Lab εκτός αν ζητείται οπτικοποίηση ή αναλυτικά βήματα.
Για οξειδοαναγωγικά labs, όταν οι μεταβολές είναι τεκμηριωμένες, πρόσθεσε στα σχετικά objects του steps προαιρετικά equation (εξίσωση αυτού του σταδίου, με συντελεστές να αποκαλύπτονται μόνο όταν αιτιολογούνται) και oxidationStateChanges, έναν πίνακα αντικειμένων {element,from,to,electrons,direction}, όπου direction είναι oxidation ή reduction. Οι αριθμοί οξείδωσης και τα ηλεκτρόνια πρέπει να είναι ισοσταθμισμένα και να αντιστοιχούν στην εξίσωση. Παράλειψε τα πεδία αν δεν είσαι βέβαιος· μην επινοείς μηχανισμό ή ηλεκτρονική μεταφορά. Παλιότερα/άσχετα labs μπορούν να συνεχίσουν με steps χωρίς αυτά τα προαιρετικά πεδία.
Όταν ζητείται Interactive Lab για άτομα, κύτταρα ή DNA χωρίς αντίδραση, χρησιμοποίησε block \`\`\`lab με ένα μόνο έγκυρο JSON: {"title":"...","description":"...","scene":"atom|cell|dna","particles":[{"label":"...","kind":"electron|proton|neutron|nucleus|cell|dna|molecule|reactant|product","color":"#RRGGBB","orbit":1}],"steps":["..."],"zoomMin":0.7,"zoomMax":2}. Τα particles είναι μόνο δεδομένα, ποτέ JavaScript, HTML ή SVG. Το lab πρέπει να εξηγεί την έννοια σε καθαρό κείμενο και να είναι μικρό ώστε να χωρά στα δωρεάν όρια.
Όταν επισυνάπτεται εικόνα, κάνε OCR/vision ανάλυση της σημείωσης ή άσκησης και επέστρεψε μεταγραφή και λύση σε καθαρό κείμενο. Μην ισχυρίζεσαι ότι συγχρονίζεις webcam ή Android αν δεν υπάρχει συνημμένη εικόνα. Για γεωμετρία, φυσική ή χημεία μπορείς να περιγράψεις στατικό διάγραμμα με ASCII ή καθαρό κείμενο, όχι inline script.
Όταν χρησιμοποιείς επιστημονικά δεδομένα, ξεχώριζε τις τεκμηριωμένες πληροφορίες από τις παραδοχές. Αν είναι ενεργή η αναζήτηση ιστού, προτίμησε αξιόπιστες πρωτογενείς πηγές και μην επινοείς παραπομπές· αν δεν είναι ενεργή, μην ισχυρίζεσαι ότι έλεγξες εξωτερική πηγή. Μην ισχυρίζεσαι ότι διαθέτεις ζωντανή πρόσβαση σε περιοδικό πίνακα ή βάση δεδομένων αν δεν έγινε αναζήτηση. Όταν δεν ζητείται κουίζ, απάντησε κανονικά με καθαρό Markdown. Όταν ζητείται σκέψη ή Interactive Lab, πρόσθεσε μόνο ένα σύντομο progress summary 1-3 προτάσεων μέσα σε <thinking>...</thinking>. Μην αποκαλύπτεις κρυφό chain-of-thought ή εσωτερικούς συλλογισμούς.`;

export async function executeChatTurn({ messages, systemInstruction, model = DEFAULT_GEMINI_MODEL, useSearchGrounding = false, apiIndex, apiKeyId, modelOverride }: {
  messages: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  useSearchGrounding?: boolean;
  apiIndex?: number;
  apiKeyId?: string | null;
  modelOverride?: string;
}) {
  const topicInstruction = '';
  const selectedModel = model || DEFAULT_GEMINI_MODEL;
  const records = getGeminiKeyRecords();
  const keys = records.map((record) => record.key);
  const boundApiIndex = typeof apiKeyId === 'string' && apiKeyId
    ? records.findIndex((record) => keyFingerprint(record.key) === apiKeyId)
    : -1;
  if (apiKeyId && boundApiIndex < 0) throw new Error('Το δεσμευμένο API key δεν βρέθηκε.');
  const preferredApiIndex = boundApiIndex >= 0
    ? boundApiIndex
    : Number.isInteger(apiIndex) && apiIndex! >= 0 && apiIndex! < records.length ? apiIndex! : activeApiIndex;
  const requestOrder = records.map((_, index) => index).sort((a, b) => Number(b === preferredApiIndex) - Number(a === preferredApiIndex));
  if (keys.length === 0) throw new Error('Δεν έχει ρυθμιστεί Google Gemini API key.');

  const requestBody: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: `${systemInstruction || academicSystemInstruction}${topicInstruction}` }] },
    contents: normalizeMessages(messages),
    generationConfig: {
      temperature: 0.2,
      ...(process.env.GEMINI_THINKING_BUDGET ? { thinkingConfig: { thinkingBudget: Math.min(8192, Math.max(256, Number(process.env.GEMINI_THINKING_BUDGET))) } } : {}),
    },
  };
  if (useSearchGrounding) requestBody.tools = [{ google_search: {} }];

  let lastError = 'Δεν ήταν δυνατή η σύνδεση με το Google Gemini API.';
  for (const keyIndex of requestOrder) {
    const apiKey = records[keyIndex].key;
    const record = records[keyIndex];
    const poolId = quotaPoolId(record);
    const limitedUntil = rateLimitedUntil.get(poolId) || 0;
    const usage = getPoolUsage(poolId);
    if (limitedUntil > Date.now()) {
      lastError = `${record.label}: Rate Limit μέχρι ${new Date(limitedUntil).toISOString()}.`;
      continue;
    }
    if (usage.rpdUsed >= rpdLimit || usage.rpmUsed >= rpmLimit) {
      if (usage.rpmUsed >= rpmLimit) rateLimitedUntil.set(poolId, Date.now() + 60_000);
      rateLimitReason.set(poolId, usage.rpmUsed >= rpmLimit ? 'RPM limit' : 'Daily Quota');
      lastError = `${record.label}: ${usage.rpmUsed >= rpmLimit ? 'RPM limit' : 'Daily Quota'} exceeded.`;
      continue;
    }
    registerPoolRequest(poolId);
    const requestModel = modelOverride || record.model || selectedModel;
    const endpoint = record.provider === 'Google Gemini'
      ? `${GEMINI_API_URL}/${encodeURIComponent(requestModel)}:generateContent?key=${encodeURIComponent(apiKey)}`
      : `${record.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = record.provider === 'Google Gemini'
      ? requestBody
      : { model: requestModel, messages: [{ role: 'system', content: `${systemInstruction || academicSystemInstruction}${topicInstruction}` }, ...messages.map((message) => ({ role: message.role === 'user' ? 'user' : 'assistant', content: message.text }))], temperature: 0.2 };
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(record.provider === 'Google Gemini' ? {} : { Authorization: `Bearer ${apiKey}` }) },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = 'Δεν ήταν δυνατή η σύνδεση με το Google Gemini API.';
      continue;
    }
    const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } }>;
    error?: { message?: string; status?: string; code?: string };
    };
    if (!response.ok) {
      lastError = data.error?.message || `Το Google Gemini API επέστρεψε HTTP ${response.status}.`;
      const errorCode = data.error?.status || data.error?.code;
      if (response.status === 429 || errorCode === 'RESOURCE_EXHAUSTED') {
        const retryAfter = Number(response.headers.get('retry-after'));
        const cooldownMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
        rateLimitedUntil.set(poolId, Date.now() + cooldownMs);
        rateLimitReason.set(poolId, /quota|resource exhausted/i.test(lastError) ? 'Daily Quota' : 'RPM limit');
        continue;
      }
      const isModelAvailabilityError = (response.status === 400 || response.status === 404)
        && /model|not found|not available|deprecated|unsupported/i.test(lastError);
      if (isModelAvailabilityError && !modelOverride && record.provider === 'Google Gemini' && record.model !== DEFAULT_GEMINI_MODEL) {
        records[keyIndex].model = DEFAULT_GEMINI_MODEL;
        saveGeminiKeys(records);
        return executeChatTurn({ messages, systemInstruction, model: selectedModel, useSearchGrounding, apiIndex: keyIndex, apiKeyId, modelOverride: DEFAULT_GEMINI_MODEL });
      }
      throw new Error(lastError);
    }
    records[keyIndex].lastUsedAt = new Date().toISOString();
    if (!apiKeyId) activeApiIndex = keyIndex;
    saveGeminiKeys(records);
  const candidate = data.candidates?.[0];
  const groundingSources = (candidate?.groundingMetadata?.groundingChunks || [])
    .map((chunk) => chunk.web)
    .filter((source): source is { title?: string; uri?: string } => Boolean(source?.uri))
    .map((source) => ({ title: source.title || source.uri || 'Google source', url: source.uri || '' }));
  return {
    text: sanitizePlainTextMath(record.provider === 'Google Gemini' ? candidate?.content?.parts?.map((part) => part.text || '').join('') || '' : (data as any).choices?.[0]?.message?.content || ''),
    modelUsed: requestModel,
    apiKeyFingerprint: keyFingerprint(apiKey),
    apiIndex: keyIndex,
    keySwitched: keyIndex !== preferredApiIndex,
    groundingSources,
  };
  }
  throw new Error(`Όλα τα Google API keys απέτυχαν. Τελευταίο σφάλμα: ${lastError}`);
}