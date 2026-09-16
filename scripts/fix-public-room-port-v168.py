from pathlib import Path
p = Path('test/public-rooms-invites.test.js')
src = p.read_text()
old = """    s.listen(0, '127.0.0.1', () => s.close(() => resolve(s.address()?.port || port)));
    let port;
    s.on('listening', () => { port = s.address().port; });"""
new = """    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });"""
if src.count(old) != 1:
    raise RuntimeError('Expected unique test port lifecycle anchor')
p.write_text(src.replace(old, new, 1))
print('Fixed test port acquisition before server close')
