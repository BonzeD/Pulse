#!/usr/bin/env python3
"""Reproducible source bundle; retain embedded Python's mandatory base_library.zip."""
from pathlib import Path
import sys, zipfile, hashlib, os, json
root=Path(__file__).resolve().parents[2]
version=json.loads((root/'app/package.json').read_text())['version']
prefix='Pulse-'+version
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/(prefix+'-source.zip')
skip_dirs={'node_modules','dist','.git','artifacts','release-proof','bin','obj','__pycache__'}
files=[]
for base, dirs, names in os.walk(root):
    dirs[:]=sorted(d for d in dirs if d not in skip_dirs)
    for name in sorted(names):
        p=Path(base)/name; rel=p.relative_to(root)
        # The old manifest may exist after unpacking a release; generate exactly one new copy.
        if rel==Path('SOURCE-MANIFEST-SHA256.txt'):continue
        if rel==Path('.maintenance/ai/oldlogs/manifests/SOURCE-MANIFEST-organized-SHA256.txt'):continue
        if rel.as_posix().startswith('app/build/installer-ui/out/'):continue
        if rel==Path('app/build/uninstall-files.nsh') or name.startswith('.env'):continue
        if p.resolve()==out or p.suffix in {'.log','.pdb','.pyc'}:continue
        if rel.parts[:3]==('app','resources','media-bridge') and p.suffix in {'.exe','.dll','.json'}:continue
        files.append((p,rel))
required=Path('app/resources/yt-dlp/_internal/base_library.zip')
assert any(rel==required for _,rel in files), 'Python standard library must remain in source bundles'
out.parent.mkdir(parents=True,exist_ok=True)
manifest=[]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p,rel in files:
        data=p.read_bytes(); archive=str(Path(prefix)/rel)
        z.writestr(archive,data);manifest.append(hashlib.sha256(data).hexdigest()+'  '+str(rel))
    z.writestr(prefix+'/.maintenance/ai/oldlogs/manifests/SOURCE-MANIFEST-organized-SHA256.txt','\n'.join(manifest)+'\n')
with zipfile.ZipFile(out) as z:
    assert len(z.namelist())==len(set(z.namelist())), 'Duplicate archive entries'
    assert z.testzip() is None
    for p,rel in files:
        assert z.read(str(Path(prefix)/rel))==p.read_bytes(),str(rel)
print(f'Verified {len(files)} source files; all nested runtime ZIPs retained; {out.stat().st_size} bytes')
