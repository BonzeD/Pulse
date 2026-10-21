const safety = require('./core-safety');
// Музыкальные обои: окно с визуализацией встраивается ПОД значки рабочего стола (как Wallpaper Engine).
// Встраивание — через WorkerW/Progman (Win10, Win11 и новая схема Win11 24H2). Без нативных модулей: короткий C#-хелпер через PowerShell.
const { BrowserWindow, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let wall = null, cfg = { display: 0 }, port = 0, preload = '', attached = false;
const CS = `
using System; using System.Runtime.InteropServices;
public class PulseWall {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string n);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool SystemParametersInfo(uint a, uint p, string v, uint w);
  static IntPtr worker = IntPtr.Zero;
  public static string Attach(long hwnd, int x, int y, int w, int h) {
    IntPtr me = new IntPtr(hwnd), r;
    IntPtr progman = FindWindow("Progman", null);
    SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(1), 0, 1000, out r);
    SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, 0, 1000, out r);
    IntPtr parent = IntPtr.Zero; string mode = "";
    // Win11 24H2+: WorkerW стал дочерним окном Progman, рядом с SHELLDLL_DefView
    IntPtr inner = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null), defView = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
    if (defView != IntPtr.Zero && inner != IntPtr.Zero) { parent = progman; mode = "24h2"; }
    if (parent == IntPtr.Zero) {
      EnumWindows((top, l) => { IntPtr p = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null); if (p != IntPtr.Zero) worker = FindWindowEx(IntPtr.Zero, top, "WorkerW", null); return true; }, IntPtr.Zero);
      if (worker != IntPtr.Zero) { parent = worker; mode = "workerw"; }
    }
    if (parent == IntPtr.Zero) { parent = progman; mode = "progman"; }
    int st = GetWindowLong(me, -16); st = (st & ~unchecked((int)0x80000000)) | 0x40000000; SetWindowLong(me, -16, st);
    SetParent(me, parent);
    int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77);
    if (mode == "24h2") {
      // окно — между значками (SHELLDLL_DefView) и родными обоями (WorkerW)
      SetWindowPos(me, defView, x - vx, y - vy, w, h, 0x0010 | 0x0040);
      SetWindowPos(inner, me, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
    } else SetWindowPos(me, IntPtr.Zero, x - vx, y - vy, w, h, 0x0010 | 0x0040 | 0x0004);
    return mode;
  }
  public static void Refresh() { SystemParametersInfo(0x0014, 0, null, 0x02); }
}`;
function ps(cmd) {
  return new Promise((res) => {
    if (process.platform !== 'win32') return res({ ok: false, out: 'только Windows' });
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${CS}\n'@; ${cmd}`], { windowsHide: true });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    p.on('close', (c) => res({ ok: c === 0, out: out.trim() })); p.on('error', (e) => res({ ok: false, out: String(e) }));
  });
}
// ---- клики по обоям: окно под значками не получает мышь, поэтому слушаем кнопку мыши сами
// (только когда курсор над голым рабочим столом, а не над окнами/панелью задач)
const CLICK_CS = `
using System; using System.Text; using System.Runtime.InteropServices; using System.Threading;
public class PulseClick {
  public struct P { public int X; public int Y; }
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out P p);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(P p);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  static bool Desk(IntPtr h) { for (int i = 0; i < 4 && h != IntPtr.Zero; i++) { var sb = new StringBuilder(64); GetClassName(h, sb, 64); string c = sb.ToString(); if (c == "SHELLDLL_DefView" || c == "WorkerW" || c == "Progman" || c == "SysListView32") return true; h = GetParent(h); } return false; }
  public static void Run() {
    SetProcessDPIAware(); bool down = false, over = false; P dp = new P(), last = new P(); int tick = 0;
    while (true) {
      Thread.Sleep(30); tick++;
      bool d = (GetAsyncKeyState(1) & 0x8000) != 0; P p; GetCursorPos(out p);
      if (d && !down) dp = p;
      if (!d && down && Math.Abs(p.X - dp.X) < 6 && Math.Abs(p.Y - dp.Y) < 6 && Desk(WindowFromPoint(p))) { Console.WriteLine("C " + p.X + " " + p.Y); Console.Out.Flush(); }
      down = d;
      if ((p.X != last.X || p.Y != last.Y) && tick % 3 == 0) {
        last = p; bool o = Desk(WindowFromPoint(p));
        if (o) { Console.WriteLine("M " + p.X + " " + p.Y); Console.Out.Flush(); } else if (over) { Console.WriteLine("L"); Console.Out.Flush(); }
        over = o;
      }
    }
  }
}`;
let clicker = null;
function stopClicker() { if (clicker) { try { clicker.kill(); } catch {} clicker = null; } }
function syncClicker() {
  const want = process.platform === 'win32' && !!cfg.controls && !!wall && attached;
  if (!want) return stopClicker(); if (clicker) return;
  const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `Add-Type -TypeDefinition @'\n${CLICK_CS}\n'@; [PulseClick]::Run()`], { windowsHide: true });
  clicker = p; let buf = '';
  p.stdout.on('data', (d) => {
    buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop();
    for (const ln of lines) {
      if (!wall || wall.isDestroyed()) continue;
      const [t, xs, ys] = ln.trim().split(' '); if (!t) continue;
      if (t === 'L') { wall.webContents.send('wall:pointer', { t: 'L' }); continue; }
      let pt = { x: +xs, y: +ys }; try { if (screen.screenToDipPoint) pt = screen.screenToDipPoint(pt); } catch {}
      const b = wall.getBounds(), x = pt.x - b.x, y = pt.y - b.y;
      if (x < 0 || y < 0 || x > b.width || y > b.height) { wall.webContents.send('wall:pointer', { t: 'L' }); continue; }
      wall.webContents.send('wall:pointer', { t, x, y });
    }
  });
  p.on('error', () => { if (clicker === p) clicker = null; });
  p.on('close', () => { if (clicker === p) clicker = null; });
}
function targetDisplay() { const ds = screen.getAllDisplays(); return ds[Math.max(0, Math.min(ds.length - 1, +cfg.display || 0))] || screen.getPrimaryDisplay(); }
async function attach() {
  if (!wall || wall.isDestroyed()) return;
  const d = targetDisplay(), b = d.bounds;
  const phys = process.platform === 'win32' && screen.dipToScreenRect ? screen.dipToScreenRect(null, b) : b;
  const h = wall.getNativeWindowHandle(), hwnd = h.length >= 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0));
  const r = await ps(`[PulseWall]::Attach(${hwnd}, ${phys.x}, ${phys.y}, ${phys.width}, ${phys.height})`);
  attached = r.ok; return r;
}
module.exports = {
  setup(o) { port = o.port; preload = o.preload; },
  displays() { return screen.getAllDisplays().map((d, i) => ({ i, name: `${i + 1}: ${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' (основной)' : ''}` })); },
  async enable(c) {
    const prevDisp = cfg.display; cfg = Object.assign({}, cfg, c || {});
    if (wall && !wall.isDestroyed()) { if (prevDisp !== cfg.display) { const b = targetDisplay().bounds; wall.setBounds(b); await attach(); } syncClicker(); return { ok: true, attached }; }
    const b = targetDisplay().bounds;
    wall = new BrowserWindow({ x: b.x, y: b.y, width: b.width, height: b.height, frame: false, show: false, skipTaskbar: true, focusable: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, backgroundColor: '#000000',
      webPreferences: { preload, backgroundThrottling: false, contextIsolation: true } });
    wall.setMenu(null);
    safety.lockNavigation(wall.webContents, u => safety.appURL(u, port, 'wall.localhost', '/wallpaper.html'));
    wall.loadURL(`http://wall.localhost:${port}/wallpaper.html`); // свой хост — свой зум
    wall.on('closed', () => { wall = null; attached = false; stopClicker(); });
    await new Promise((r) => wall.once('ready-to-show', r));
    wall.showInactive();
    const r = await attach();
    if (!r || !r.ok) { console.error('wallpaper attach', r && r.out); }
    syncClicker();
    return { ok: !!(r && r.ok), attached, error: r && !r.ok ? r.out : null };
  },
  async disable() { stopClicker(); if (wall && !wall.isDestroyed()) wall.destroy(); wall = null; attached = false; await ps('[PulseWall]::Refresh()'); },
  send(ch, d) { if (wall && !wall.isDestroyed()) wall.webContents.send(ch, d); },
  isSender: wc => !!wall && !wall.isDestroyed() && wall.webContents === wc, active: () => !!wall,
  destroy() { stopClicker(); if (wall && !wall.isDestroyed()) { wall.destroy(); wall = null; ps('[PulseWall]::Refresh()'); } }
};
