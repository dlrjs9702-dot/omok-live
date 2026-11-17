# DB 백업 (1.10.349, notes 178A·179A)

서버의 DB 전체를 매일 이 PC에 내려받아요. 서버는 **공개 키**로 잠근 파일만 내주고, 여는 **개인 키**는 이 PC의 `아일랜드\DB백업\keys\`에만 있어요. 저장소에는 비밀 값이 없어요.

| 파일 | 하는 일 |
|---|---|
| `lib/db-backup.js` (서버) | 모든 표를 JSON 줄로 → gzip → AES-256-GCM, 그 열쇠는 RSA-OAEP 공개 키로 잠금. 표는 커서로 500줄씩 읽어요 |
| `GET /api/admin/backup` | 관리자만, 하루 6번까지. 로그에는 크기·시간만 남겨요 |
| `keygen.js` | 열쇠 한 쌍을 한 번 만들어요. 개인 키 → `DB백업\keys\backup-private.pem`, 공개 키 → `DB백업\keys\`와 `tools/backup/backup-public.pem` |
| `fetch.js` | 관리자로 로그인 → 받기 → `DB백업\YYYY-MM-DD.bak` → 로그아웃. 개인 키가 있으면 열어서 끝까지 왔는지 확인해요. 30일 지난 `.bak`은 지워요. 기록은 `DB백업\backup.log` |
| `open.js` | 백업을 열어 표마다 줄 수를 보여 줘요(풀어 쓴 파일은 원할 때만) |
| `restore.js` | 되살리기 연습: 이 PC의 Postgres(localhost)에만 넣어요 |
| `install-task.ps1` | Windows 예약 작업 `IslandDbBackup`: 매일 05:30, 놓친 실행은 켜지면 바로, 실패하면 10분 뒤 3번까지 다시 |

## 처음 한 번

1. 열쇠 만들기: `node tools/backup/keygen.js`. 그다음 `tools/backup/backup-public.pem`을 커밋해서 서버에 올려요. 또는 Render 환경 변수 `BACKUP_PUBLIC_KEY`에 PEM을 넣어도 돼요.
2. `아일랜드\DB백업\config.local.json`에 **사용자가 직접** 관리자 비밀번호를 넣어요(`config.example.json` 모양).
3. 한 번 손으로 받아 보기: `node tools/backup/fetch.js`. 그 뒤 `DB백업\backup.log`에 `ok …`가 남았는지 봐요.
4. 예약 작업 등록: `powershell -ExecutionPolicy Bypass -File tools\backup\install-task.ps1`.
   - 로그인해 있을 때만 돌아요. 꺼져 있었으면 다음에 켜고 로그인할 때 바로 돌아요.

## 되살리기 연습 (매달, 62A)

1. `node tools/backup/open.js 아일랜드\DB백업\<날짜>.bak`을 실행해요. 「끝까지 있음」인지, 표마다 줄 수가 그럴듯한지 봐요.
2. 이 PC에 빈 Postgres DB를 만들어요. 예: `createdb island_restore`.
3. 게임 서버를 그 DB로 한 번 켜서 표를 만들게 해요. 그리고 꺼요.
   - `DATABASE_URL=postgres://localhost/island_restore`, `ADMIN_PASSWORD=아무거나`, `npm start`
4. `node tools/backup/restore.js 아일랜드\DB백업\<날짜>.bak postgres://localhost/island_restore`를 실행해요.
5. 다시 그 DB로 서버를 켜요. 관리자로 들어가 포인트·집·가방이 보이는지 확인해요. 결과(날짜, 줄 수, 이상 여부)는 notes에 한 줄 남겨요.

## 지켜요

- `.bak`, 풀어 쓴 `.jsonl`, 개인 키에는 모두의 데이터가 들어 있어요. 저장소, 공개 아티팩트, 메신저 어디에도 올리지 않아요(`tools/backup/.gitignore`).
- 개인 키를 잃으면 그 키로 잠근 백업은 열 수 없어요. `keys` 폴더를 USB 같은 곳에 따로 한 벌 두는 것을 권해요.
