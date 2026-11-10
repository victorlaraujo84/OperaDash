import { execFileSync } from "node:child_process";
import { access, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist-extension");
const archive = join(root, "operadash-extension.zip");
await access(join(output, "manifest.json"));
await rm(archive, { force: true });
if (process.platform === 'win32') {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(output)}, ${quote(archive)})`], { stdio: 'inherit', windowsHide: true });
} else {
  execFileSync("zip", ["-qr", archive, "."], { cwd: output, stdio: "inherit" });
}
const { size } = await stat(archive);
console.log(`Extensão empacotada: ${archive} (${(size / 1024 / 1024).toFixed(2)} MiB)`);
