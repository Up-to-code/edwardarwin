import {
  BrowserWindow, screen, shell, ipcMain,
} from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';

const isMac = process.platform === 'darwin';

export class WindowManager {
  private window: BrowserWindow | null = null;

  private windowedBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  private hoveringComponents: Set<string> = new Set();

  private wanderTimer: ReturnType<typeof setInterval> | null = null;

  setWander(enabled: boolean): void {
    if (this.wanderTimer) clearInterval(this.wanderTimer);
    this.wanderTimer = null;
    if (!this.window || this.window.isDestroyed()) return;
    if (!this.window.webContents.isDestroyed()) this.window.webContents.send('avatar-wander-changed', enabled && this.currentMode === 'pet');
    if (!enabled || this.currentMode !== 'pet') return;
    let direction = -1;
    this.wanderTimer = setInterval(() => {
      if (!this.window || this.window.isDestroyed() || this.currentMode !== 'pet') { this.setWander(false); return; }
      const bounds = this.window.getBounds();
      const area = screen.getDisplayMatching(bounds).workArea;
      const minX = area.x + 12, maxX = Math.max(minX, area.x + area.width - bounds.width - 12);
      const nextX = Math.max(minX, Math.min(maxX, bounds.x + direction * 2));
      if (nextX === minX || nextX === maxX) direction *= -1;
      const nextY = Math.max(area.y, Math.min(area.y + area.height - bounds.height, bounds.y));
      this.window.setPosition(nextX, nextY);
    }, 100);
  }

  private currentMode: 'window' | 'pet' = 'window';

  // Track if mouse events are forcibly ignored
  private forceIgnoreMouse = false;

  constructor() {
    ipcMain.on('renderer-ready-for-mode-change', (_event, newMode) => {
      if (newMode === 'pet') {
        setTimeout(() => {
          this.continueSetWindowModePet();
        }, 500);
      } else {
        setTimeout(() => {
          this.continueSetWindowModeWindow();
        }, 500);
      }
    });

    ipcMain.on('mode-change-rendered', () => {
      this.window?.setOpacity(1);
    });

    ipcMain.on('window-unfullscreen', () => {
      const window = this.getWindow();
      if (window && window.isFullScreen()) {
        window.setFullScreen(false);
      }
    });

    ipcMain.on('avatar-wander', (_event, enabled: boolean) => this.setWander(enabled === true));

    // Handle toggle force ignore mouse events from renderer
    ipcMain.on('toggle-force-ignore-mouse', () => {
      this.toggleForceIgnoreMouse();
    });
  }

  createWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
    this.window = new BrowserWindow({
      width: 900,
      height: 670,
      minWidth:740,
      minHeight:480,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      autoHideMenuBar: true,
      frame: false,
      movable: true,
      ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
      icon: process.platform === 'win32'
        ? join(__dirname, '../../resources/icon.ico')
        : join(__dirname, '../../resources/icon.png'),
      ...(isMac ? { titleBarStyle: 'hidden' } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
      hasShadow: false,
      paintWhenInitiallyHidden: true,
      ...options,
    });

    this.window.webContents.on('console-message', (details) => {
      if (details.level === 'error') console.error('[Renderer]', details.message);
    });
    this.window.webContents.on('did-fail-load', (_event, code, description) => console.error('[Page load]', code, description));
    this.window.webContents.on('render-process-gone', (_event, details) => console.error('[Renderer stopped]', details.reason));
    this.setupWindowEvents();
    this.loadContent();

    this.window.on('enter-full-screen', () => {
      this.window?.webContents.send('window-fullscreen-change', true);
    });

    this.window.on('leave-full-screen', () => {
      this.window?.webContents.send('window-fullscreen-change', false);
    });

    return this.window;
  }

  private setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('will-move', () => this.setWander(false));
    this.window.on('closed', () => {
      this.window = null;
      this.setWander(false);
    });

    this.window.on('ready-to-show', () => {
      this.window?.show();
      this.window?.webContents.send(
        'window-maximized-change',
        this.window.isMaximized(),
      );
    });

    this.window.on('maximize', () => {
      this.window?.webContents.send('window-maximized-change', true);
    });

    this.window.on('unmaximize', () => {
      this.window?.webContents.send('window-maximized-change', false);
    });

    this.window.on('resize', () => {
      const window = this.getWindow();
      if (window) {
        const bounds = window.getBounds();
        const { width, height } = screen.getPrimaryDisplay().workArea;
        const isMaximized = bounds.width >= width && bounds.height >= height;
        window.webContents.send('window-maximized-change', isMaximized);
      }
    });

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });
  }

  private loadContent(): void {
    if (!this.window) return;

    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      this.window.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      this.window.loadURL('http://127.0.0.1:12393/');
    }
  }

  setWindowMode(mode: 'window' | 'pet'): void {
    if (!this.window) return;

    this.currentMode = mode;
    this.window.setOpacity(0);

    if (mode === 'window') {
      this.setWindowModeWindow();
    } else {
      this.setWindowModePet();
    }
  }

  private setWindowModeWindow(): void {
    if (!this.window) return;

    this.setWander(false);
    this.window.setMinimumSize(740,480);
    this.window.setAlwaysOnTop(false);
    this.window.setIgnoreMouseEvents(false);
    this.window.setSkipTaskbar(false);
    this.window.setResizable(true);
    this.window.setFocusable(true);
    this.window.setAlwaysOnTop(false);

    this.window.setBackgroundColor('#00000000');
    this.window.webContents.send('pre-mode-changed', 'window');
  }

  private continueSetWindowModeWindow(): void {
    if (!this.window) return;
    if (this.windowedBounds) {
      this.window.setBounds(this.windowedBounds);
    } else {
      this.window.setSize(900, 670);
      this.window.center();
    }

    if (isMac) {
      this.window.setWindowButtonVisibility(true);
      this.window.setVisibleOnAllWorkspaces(false, {
        visibleOnFullScreen: false,
      });
    }

    this.window?.setIgnoreMouseEvents(false, { forward: true });

    this.window.webContents.send('mode-changed', 'window');
  }

  private setWindowModePet(): void {
    if (!this.window) return;

    this.windowedBounds = this.window.getBounds();

    if (this.window.isFullScreen()) {
      this.window.setFullScreen(false);
    }

    this.window.setMinimumSize(220,320);
    this.window.setBackgroundColor('#00000000');

    this.window.setAlwaysOnTop(true, 'floating');
    this.window.setPosition(0, 0);

    this.window.webContents.send('pre-mode-changed', 'pet');
  }

  private continueSetWindowModePet(): void {
    if (!this.window) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = display.workArea;
    this.window.setBounds({ x: area.x + area.width - 360, y: area.y + area.height - 540, width: 300, height: 460 });
    if (isMac) this.window.setWindowButtonVisibility(false);
    this.window.setResizable(true);
    this.window.setSkipTaskbar(false);
    this.window.setFocusable(true);
    this.window.setIgnoreMouseEvents(false);
    if (isMac) this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    this.window.webContents.send('mode-changed', 'pet');
  }
  
  toggleCompactSize(): void {
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    this.setWander(false);
    const old = window.getBounds();
    const small = this.currentMode === 'pet' ? old.width > 240 : old.width > 760;
    const width = this.currentMode === 'pet' ? (small?220:300) : (small?740:900);
    const height = this.currentMode === 'pet' ? (small?340:460) : (small?580:670);
    const area = screen.getDisplayMatching(old).workArea;
    window.setBounds({x:Math.max(area.x,Math.min(old.x+Math.round((old.width-width)/2),area.x+area.width-width)),y:Math.max(area.y,Math.min(old.y,area.y+area.height-height)),width,height});
  }

  isWandering(): boolean { return this.wanderTimer !== null; }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  setIgnoreMouseEvents(ignore: boolean): void {
    if (!this.window) return;

    if (isMac) {
      this.window.setIgnoreMouseEvents(ignore);
      // this.window.setIgnoreMouseEvents(ignore, { forward: true });
    } else {
      this.window.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }

  maximizeWindow(): void {
    if (!this.window) return;

    if (this.isWindowMaximized()) {
      if (this.windowedBounds) {
        this.window.setBounds(this.windowedBounds);
        this.windowedBounds = null;
        this.window.webContents.send('window-maximized-change', false);
      }
    } else {
      this.windowedBounds = this.window.getBounds();
      const { width, height } = screen.getPrimaryDisplay().workArea;
      this.window.setBounds({
        x: 0, y: 0, width, height,
      });
      this.window.webContents.send('window-maximized-change', true);
    }
  }

  isWindowMaximized(): boolean {
    if (!this.window) return false;
    const bounds = this.window.getBounds();
    const { width, height } = screen.getPrimaryDisplay().workArea;
    return bounds.width >= width && bounds.height >= height;
  }

  updateComponentHover(componentId: string, isHovering: boolean): void {
    if (this.currentMode === 'window') return;

    // If force ignore is enabled, don't change the mouse ignore state
    if (this.forceIgnoreMouse) return;

    if (isHovering) {
      this.hoveringComponents.add(componentId);
    } else {
      this.hoveringComponents.delete(componentId);
    }

    if (this.window) {
      const shouldIgnore = false; // Compact avatar controls must remain reachable.
      if (isMac) {
        this.window.setIgnoreMouseEvents(shouldIgnore);
      } else {
        this.window.setIgnoreMouseEvents(shouldIgnore, { forward: true });
      }
      if (!shouldIgnore) {
        this.window.setFocusable(true);
      }
    }
  }

  // Toggle force ignore mouse events
  toggleForceIgnoreMouse(): void {
    this.forceIgnoreMouse = !this.forceIgnoreMouse;

    // Apply the new setting immediately
    if (this.forceIgnoreMouse) {
      if (isMac) {
        this.window?.setIgnoreMouseEvents(true);
      } else {
        this.window?.setIgnoreMouseEvents(true, { forward: true });
      }
    } else {
      // Reapply normal behavior based on hovering components
      const shouldIgnore = false; // Compact avatar controls must remain reachable.
      if (isMac) {
        this.window?.setIgnoreMouseEvents(shouldIgnore);
      } else {
        this.window?.setIgnoreMouseEvents(shouldIgnore, { forward: true });
      }
    }

    // Notify renderer about the change
    this.window?.webContents.send('force-ignore-mouse-changed', this.forceIgnoreMouse);
  }

  // Get current force ignore state
  isForceIgnoreMouse(): boolean {
    return this.forceIgnoreMouse;
  }

  // Get current mode
  getCurrentMode(): 'window' | 'pet' {
    return this.currentMode;
  }
}
