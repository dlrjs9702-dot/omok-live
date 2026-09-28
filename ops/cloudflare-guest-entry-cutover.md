# 기존 입장파일의 Worker 입구 전환

대상: `silent-lake-9bcf.dlrjs9702.workers.dev`의 기존 Worker. **원본 Worker 코드를 확인한 뒤** 가장 먼저 실행되는 요청 분기(기존 프록시 `fetch`보다 앞)에 아래 분기만 삽입한다. 나머지 프록시 분기는 그대로 둔다. 이 저장소에는 Worker 원본과 Cloudflare 배포 권한이 없다.

```js
const url = new URL(request.url);
if (request.method === 'POST' && url.pathname === '/guest-entry') {
  return new Response(null, {
    status: 307,
    headers: {
      Location: 'https://omok-live.onrender.com/guest-entry',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
// 기존 프록시 경로를 계속 실행한다. 활성 Worker-origin 세션 보호용.
```

요청 본문을 읽거나 Worker에서 Render로 재전송하지 않는다. 브라우저가 307을 따라 POST 본문을 Render에 다시 보내므로 URL·Location·로그에 토큰을 넣을 필요가 없다. Worker의 WAF·Access·캐시·국가/IP 정책과 기존 프록시 구현은 이 저장소에서 확인할 수 없다. 정책을 확인한 뒤 적용한다.

적용 순서:

1. Render 신규 입장파일의 `action`이 Render이고 `/health`가 HTTP 200인지 확인한다.
2. Worker 원본과 활성 보안 정책을 확인하고 위 분기를 삽입한 뒤 배포한다. 기존 `/api/*`, SSE, 정적 자원 프록시는 유지한다.
3. 유효하지 않은 **임시** 토큰을 본문에 넣은 POST로 리다이렉트 자체를 확인한다. 첫 응답은 307, Location은 Render `/guest-entry`, Cache-Control은 `no-store`여야 한다. 자동 추적 결과 Render의 *유효하지 않은 입장파일* 응답이 나오면 POST와 본문이 보존된 것이다. 토큰을 URL·명령 기록·로그에 남기지 않는다.
4. 별도 테스트용 입장파일을 Worker 목적지로 만든 뒤 브라우저에서 실행한다. 최종 주소와 document/JS/CSS/API/SSE 요청이 Render여야 한다. 게스트 ID·포인트·전적·닉네임을 전후 비교한다.
5. 이미 열린 Worker-origin 페이지가 `/api/*`·SSE를 계속 사용할 수 있는지 확인한다. 활성 세션이 사라지는 종료 조건을 확인하기 전에는 프록시를 제거하지 않는다.

Worker 호환 입구는 기존 HTML이 남아 있는 동안 유지한다. 영구 삭제하지 않는다.
