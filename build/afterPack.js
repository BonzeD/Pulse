// Ставит иконку и метаданные в Pulse.exe без wine (чистый JS через resedit)
const fs = require('fs'); const path = require('path');
exports.default = async (ctx) => {
  if (ctx.electronPlatformName !== 'win32') return;
  // A missing .zip inside PyInstaller breaks all downloads despite a valid exe.
  if (!require('../ytd-runtime').complete(path.join(ctx.appOutDir,'resources','yt-dlp'))) throw Error('Incomplete yt-dlp runtime (Python standard library missing)');
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const ntExe = R.NtExecutable.from(fs.readFileSync(exe));
  const r = R.NtExecutableResource.from(ntExe);
  const ico = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  R.Resource.IconGroupEntry.replaceIconsForResource(r.entries, 1, 1033, ico.icons.map((i) => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(r.entries)[0];
  if (!vi) throw new Error('Pulse.exe: отсутствует ресурс версии');
  if (vi) {
    // 1.0.0: Electron-версия не должна остаться в метаданных Pulse.exe.
    const version = ctx.packager.appInfo.version;
    vi.setFileVersion(version); vi.setProductVersion(version);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: 'Pulse', FileDescription: 'Pulse Player', CompanyName: 'werxapee, Daswi', OriginalFilename: 'Pulse.exe', InternalName: 'Pulse', FileVersion: version, ProductVersion: version });
    vi.outputToResourceEntries(r.entries);
  }
  r.outputResource(ntExe);
  fs.writeFileSync(exe, Buffer.from(ntExe.generate()));
  console.log('  • icon set via resedit');
};
