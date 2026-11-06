import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist-extension");
const requiredFiles = ["index.html", "background.js"];

for (const file of requiredFiles) {
  await access(join(output, file));
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "extension/manifest.template.json"), "utf8"));
manifest.version = packageJson.version;
if (manifest.manifest_version === 3 && manifest.background?.type !== "module") {
  throw new Error("O service worker do MV3 precisa de background.type=module porque o build Vite usa imports ES.");
}
await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await copyFile(join(root, "extension/README.md"), join(output, "README.md"));
await copyFile(join(root, "PROMPT_IA_LOCAL.md"), join(output, "PROMPT_IA_LOCAL.md"));
await copyFile(join(root, "PROMPT_APRESENTACAO_EXECUTIVA.md"), join(output, "PROMPT_APRESENTACAO_EXECUTIVA.md"));

const noticesDirectory = join(output, "THIRD_PARTY_NOTICES");
await mkdir(noticesDirectory, { recursive: true });
for (const [packageDirectory, noticeName] of [
  ["node_modules/@fontsource-variable/ibm-plex-sans", "IBM-Plex-Sans-OFL.txt"],
  ["node_modules/@fontsource/ibm-plex-mono", "IBM-Plex-Mono-OFL.txt"],
]) {
  const sourceDirectory = join(root, packageDirectory);
  const entries = await readdir(sourceDirectory);
  const licenseFile = entries.find((entry) => /^(LICENSE|OFL)(\.txt)?$/i.test(entry));
  if (licenseFile) await copyFile(join(sourceDirectory, licenseFile), join(noticesDirectory, noticeName));
}

console.log(`Manifesto e documentação preparados em ${output}`);
