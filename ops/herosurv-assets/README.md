# 두 세계 영웅전 큰 파일 배포 (Cloudflare R2 + Worker)

게임 페이지·엔진 JS는 `public/herosurv/`(Render)에 있고, 큰 파일 2개만 R2 버킷 `gamecenter-games`에 sha256 이름으로 둔다. 서버는 `HEROSURV_ASSETS`(기본 `https://gamecenter-games.dlrjs9702.workers.dev`)를 페이지에 넣고, CSP `connect-src`에 그 주소만 더한다. `HEROSURV_ASSETS=`(빈 값)이면 `public/herosurv/index.wasm`·`index.pck`(gitignore) 로컬 사본을 읽는다.

## 새 빌드 올리기

1. 새 `index.wasm`·`index.pck`의 sha256을 구한다.
2. 업로드(wasm은 brotli로 압축해서 `.br`을 붙인다):
   ```
   npx wrangler r2 object put gamecenter-games/herosurv/<wasm sha256>.wasm.br --file index.wasm.br --remote
   npx wrangler r2 object put gamecenter-games/herosurv/<pck sha256>.pck --file index.pck --remote
   ```
3. `public/herosurv/boot.js`의 `BIG` 이름과 `GODOT_CONFIG.fileSizes`를 바꾼다. 옛 파일은 새 버전 배포 확인 뒤 지운다.

## Worker 배포

```
cd ops/herosurv-assets
npx wrangler deploy
```
