import { app, dialog } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
let directory = '';
export function projectDirectory(): string { if (!directory) throw Error('Choose the Emma source folder first.'); return directory; }
export async function chooseProject(): Promise<void> {
  if (!app.isPackaged) { directory = join(__dirname, '../../..'); return; }
  const saved = join(app.getPath('userData'), 'local-project.json');
  for (const path of [saved, join(process.resourcesPath, 'local-project.json'), join(__dirname, '../../resources/local-project.json')]) {
    try { const candidate = JSON.parse(readFileSync(path, 'utf8')).directory; if (typeof candidate === 'string' && existsSync(join(candidate, 'start-local-services.command'))) { directory = candidate; return; } } catch { /* Try the next location. */ }
  }
  const choice = await dialog.showOpenDialog({ title: 'Choose your Emma Darwin source folder', message: 'Run setup-macos.command in the downloaded source first, then choose that folder.', properties: ['openDirectory'] });
  if (choice.canceled || !existsSync(join(choice.filePaths[0], 'start-local-services.command'))) throw Error('Emma needs its prepared source folder.');
  directory = choice.filePaths[0]; mkdirSync(app.getPath('userData'), { recursive: true }); writeFileSync(saved, JSON.stringify({ directory }), { mode: 0o600 });
}
