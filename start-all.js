import { spawn } from 'child_process';
import path from 'path';

const target = (process.argv[2] || 'all').toLowerCase();

console.log('\n======================================================');
console.log(`🛡️  PRISONGUARD RUNNER: ${target.toUpperCase()}`);
console.log('======================================================\n');

function runService(name, command, args, cwd, colorCode) {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows && command === 'npm' ? 'npm.cmd' : command;

  const proc = spawn(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: isWindows
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${name}]\x1b[0m ${line}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`\x1b[${colorCode}m[${name} ERR]\x1b[0m ${line}`);
      }
    }
  });

  proc.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
  });

  return proc;
}

const procs = [];

if (target === 'all' || target === 'server') {
  procs.push(runService(
    'SERVER (5000)',
    'node',
    ['src/index.js'],
    path.resolve(process.cwd(), 'server'),
    '32' // Green
  ));
}

if (target === 'all' || target === 'admin') {
  procs.push(runService(
    'ADMIN (5173)',
    'npm',
    ['run', 'dev'],
    path.resolve(process.cwd(), 'apps/admin'),
    '36' // Cyan
  ));
}

if (target === 'all' || target === 'simulator' || target === 'sim') {
  procs.push(runService(
    'SIMULATOR (5174)',
    'npm',
    ['run', 'dev'],
    path.resolve(process.cwd(), 'apps/simulator'),
    '35' // Magenta
  ));
}

process.on('SIGINT', () => {
  console.log('\nTerminating active PrisonGuard service(s)...');
  procs.forEach(p => p.kill());
  process.exit(0);
});
