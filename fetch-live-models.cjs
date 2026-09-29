const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    const p = path.join(os.homedir(), 'AppData', 'Roaming', 'NeoCoach', 'ai-config.json');
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    const encKey = cfg.keys?.gemini;
    const encGroq = cfg.keys?.groq;
    let geminiKey = encKey && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(encKey, 'base64')) : encKey;
    let groqKey = encGroq && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(encGroq, 'base64')) : encGroq;

    if (geminiKey) {
      console.log('=== GEMINI LIVE MODELS ===');
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(geminiKey) + '&pageSize=100');
      const data = await res.json();
      const models = (data?.models || []).map(m => ({
        name: (m.name || '').replace('models/', ''),
        displayName: m.displayName,
        methods: m.supportedGenerationMethods,
        inputLimit: m.inputTokenLimit,
        outputLimit: m.outputTokenLimit
      }));
      const textModels = models.filter(m => m.methods?.includes('generateContent') && !/embedding|aqa|imagen/i.test(m.name));
      console.log(JSON.stringify(textModels.map(m => ({ id: m.name, name: m.displayName, input: m.inputLimit, output: m.outputLimit })), null, 2));
    }

    if (groqKey) {
      console.log('\n=== GROQ LIVE MODELS ===');
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: 'Bearer ' + groqKey }
      });
      const data = await res.json();
      const groqModels = (data?.data || []).filter(m => m.active !== false).map(m => ({ id: m.id, owned_by: m.owned_by, context_window: m.context_window }));
      console.log(JSON.stringify(groqModels, null, 2));
    }
  } catch(e) {
    console.error('Error fetching live models:', e.message);
  } finally {
    app.quit();
  }
});
