from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

index = read('public/index.html')

# Move the admin panel below the main lobby row, and place lobby chat beside game selection.
admin_start = index.index('        <article id="adminPanel"')
admin_end = index.index('        </article>', admin_start) + len('        </article>')
admin_block = index[admin_start:admin_end]
admin_block = admin_block.replace('class="card lobbyCard hidden"', 'class="card lobbyCard lobbyAdminCard hidden"', 1)
index = index[:admin_start] + index[admin_end:]

chat_start = index.index('      <section class="card lobbyChatCard"')
chat_end = index.index('      </section>', chat_start) + len('      </section>')
chat_block = index[chat_start:chat_end]
index = index[:chat_start] + index[chat_end:]

index = index.replace('<section class="lobbyGrid">', '<section class="lobbyTopGrid">', 1)

grid_start = index.index('      <section class="lobbyTopGrid">')
grid_close = index.index('      </section>', grid_start)
index = index[:grid_close] + chat_block + '\n' + index[grid_close:]

# After the two-column top row, place the admin panel at full width.
grid_close = index.index('      </section>', grid_start)
grid_close_end = grid_close + len('      </section>')
index = index[:grid_close_end] + '\n\n' + admin_block + index[grid_close_end:]

index = index.replace('v=1.6.2', 'v=1.6.3')
write('public/index.html', index)

css = read('public/styles.css')
css += '''\n/* Lobby layout v1.6.3: game left, chat right, admin below */\n.lobbyTopGrid{display:grid;grid-template-columns:minmax(320px,.92fr) minmax(0,1.28fr);gap:18px;align-items:stretch}\n.lobbyTopGrid>.lobbyCard,.lobbyTopGrid>.lobbyChatCard{margin:0;min-width:0}\n.lobbyTopGrid>.lobbyChatCard{display:flex;flex-direction:column}\n.lobbyTopGrid .lobbyChatHead{flex:0 0 auto}\n.lobbyTopGrid .lobbyChatMessages{flex:1 1 auto;height:auto;min-height:300px;max-height:430px}\n.lobbyTopGrid .chatForm{flex:0 0 auto}\n.lobbyAdminCard{margin-top:18px;padding:24px 28px}\n.lobbyAdminCard .keyList{max-height:320px}\n@media(max-width:880px){.lobbyTopGrid{grid-template-columns:1fr}.lobbyTopGrid>.lobbyChatCard{min-height:0}.lobbyTopGrid .lobbyChatMessages{height:230px;min-height:230px;max-height:300px}.lobbyAdminCard{margin-top:18px;padding:14px}}\n'''
write('public/styles.css', css)

package = read('package.json').replace('"version": "1.6.2"', '"version": "1.6.3"')
write('package.json', package)

server = read('server.js').replace("version: '1.6.2'", "version: '1.6.3'").replace('게임 서버 v1.6.2 실행', '게임 서버 v1.6.3 실행')
write('server.js', server)

print('Applied lobby layout v1.6.3')
