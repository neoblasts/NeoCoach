const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');
const root = path.join(__dirname, '..');

if (process.platform === 'win32') {
  const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const command = `Start-Process -FilePath ${psQuote(electron)} -ArgumentList @(${psQuote(root)}) -WorkingDirectory ${psQuote(root)} -Verb RunAs`;
  const elevated = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: root, stdio: 'inherit', windowsHide: false,
  });
  elevated.once('error', (error) => { console.error('[LifeOS] Elevated built launch failed:', error.message); process.exit(1); });
  elevated.once('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
} else {
  const child = spawn(electron, [root], {
    cwd: root,
    env: { ...process.env, LIFEOS_LOAD_BUILD: '1' },
    stdio: 'inherit',
    windowsHide: false,
  });
  child.once('error', (error) => { console.error('[LifeOS] Built Electron launch failed:', error.message); process.exit(1); });
  child.once('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
}
