#!/usr/bin/env node
// Wraps `prisma generate` (and any command that runs it, like `prisma migrate dev`)
// so it never fails with EPERM on Windows.
//
// Cause: on Windows, `prisma generate` replaces node_modules/.prisma/client/query_engine-windows.dll.node
// by renaming a temp file over it. If any running node process (e.g. `npm run dev` /
// `tsx watch`) has already loaded that DLL, Windows keeps a lock on it and the rename
// fails with EPERM. Stopping the dev server's node process(es) first releases the lock.
const { execSync, spawnSync } = require('node:child_process');

function stopBackendDevProcesses() {
  if (process.platform !== 'win32') return;

  const projectDir = __dirname.replace(/\\scripts$/, '');
  let output = '';
  try {
    output = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
      { encoding: 'utf8' }
    );
  } catch {
    return;
  }

  let rows;
  try {
    const parsed = JSON.parse(output);
    rows = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return;
  }

  const pids = rows
    .filter((r) => r && typeof r.CommandLine === 'string' && r.CommandLine.includes(projectDir))
    .map((r) => r.ProcessId)
    .filter((pid) => pid && pid !== process.pid);

  for (const pid of pids) {
    spawnSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
  }
}

stopBackendDevProcesses();

const args = process.argv.slice(2);
const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
