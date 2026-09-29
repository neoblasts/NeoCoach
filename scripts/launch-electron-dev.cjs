const { spawn, execSync } = require('child_process');
const path = require('path');
const electron = require('electron');

const root = path.join(__dirname, '..');

function isElevated() {
  if (process.platform !== 'win32') return true;
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (process.platform === 'win32') {
  if (isElevated()) {
    console.log('[LifeOS Dev] Terminal is elevated. Launching Electron directly with live console logs...');
    const child = spawn(electron, ['.'], { cwd: root, stdio: 'inherit', windowsHide: false });
    child.once('error', (error) => {
      console.error('[LifeOS] Development launch failed:', error.message);
      process.exit(1);
    });
    child.once('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
  } else {
    console.log('[LifeOS Dev] Requesting Administrator elevation for website & hosts enforcement...');
    console.log('[LifeOS Dev] TIP: Run VS Code or your terminal window "As Administrator" to stream Electron console logs directly inside your terminal window!');
    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const command = `Start-Process -FilePath ${psQuote(electron)} -ArgumentList @(${psQuote(root)}) -WorkingDirectory ${psQuote(root)} -Verb RunAs`;
    const elevated = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
    elevated.once('error', (error) => {
      console.error('[LifeOS] Elevated development launch failed:', error.message);
      process.exit(1);
    });
    elevated.once('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
  }
} else {
  const child = spawn(electron, ['.'], { cwd: root, stdio: 'inherit', windowsHide: false });
  child.once('error', (error) => { console.error('[LifeOS] Development launch failed:', error.message); process.exit(1); });
  child.once('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
}
