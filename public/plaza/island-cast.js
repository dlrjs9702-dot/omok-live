// v1.10.91 섬 주민 (사용자 2026-10-18): every islander has a name, a little story and their own words -- one can talk to
// any of them at any time, a request or not. The ten who stroll the island (island-npcs.js, by index) and the story
// keepers (lib/island-quests.js, by story id) are here; the browser shows the words, the server picks them (with the
// day's errands, lib/island-errands.js). Original characters, no other game's.
// 호감도 (사용자 2026-10-18): each account's points with each islander (a talk a day, errands, story steps) set how they
// talk -- four levels, each with its own lines. `{me}` in a line is the player's name.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandCast = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const LEVELS = Object.freeze([
    Object.freeze({ min: 0, name: '처음 본 사이' }), Object.freeze({ min: 5, name: '아는 사이' }),
    Object.freeze({ min: 15, name: '친한 사이' }), Object.freeze({ min: 30, name: '단짝' }),
  ]);
  const levelOf = (points = 0) => { let k = 0; LEVELS.forEach((l, i) => { if (points >= l.min) k = i; }); return k; };
  // how points come: the first talk of a Seoul day, an errand (the asker more), a story step
  const GAIN = Object.freeze({ talk: 1, errandFrom: 3, errandTo: 2, story: 2 });
  // (R3 ⑤ 주민 사이의 관계) who gets on with whom -- an errand between two at odds patches it up a little (the server)
  const RELATIONS = Object.freeze([[0, 3, 'friend'], [2, 8, 'friend'], [4, 7, 'friend'], [1, 5, 'rival'], [6, 9, 'rival'], [3, 6, 'friend'], [5, 8, 'rival']]);
  const relationOf = (a, b) => RELATIONS.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2] || null;
  // (R2 ① 먼저 말 걸기) what an islander says over their head when I pass by, by level: say(n, `greet${level}`) -- 처음
  // 본 사이 nothing yet (T 주민 말투: each in their own words, below)
  // (대화창 새 단장) each one's name tag colour, white letters on it (4.5:1 or more) -- 봄이 꽃분홍, 바다 할아버지 남색, 하람
  // 공책 초록, 두리 꿀색, 노을 할머니 노을빛, 오 탐정 먹색, 다온 빵 갈색, 바람이 바다 파랑, 이솔 밤하늘, 가람 파란 모자
  const TAG_COLORS = Object.freeze(['#b34d70', '#2f4d7a', '#4e7d4a', '#9c6508', '#b45330', '#4a4a4a', '#9a5b2c', '#2a7399', '#4b4f9e', '#2f6fb8']);
  // lines: [처음 본 사이, 아는 사이, 친한 사이, 단짝]
  const WALKERS = [
    { name: '봄이', role: '꽃집 아르바이트생', about: '광장 근처 꽃집에서 일한다. 꽃 이름이라면 뭐든 안다.', lines: [
      ['안녕하세요! 저는 꽃집에서 일하는 봄이예요.', '처음 보는 얼굴이네요? 섬에 온 걸 환영해요!', '꽃 좋아하세요? 저는 엄청 좋아해요.'],
      ['오늘은 어떤 꽃이 제일 예뻤어요? 저는 강가 노란 꽃이요!', '꽃집 사장님이 이번 주엔 튤립을 들여온대요.', '꽃은 아침에 물 주는 게 제일 좋아요. 낮엔 뿌리가 놀라거든요.', '정원사 할머니 화단은 섬에서 제일 예뻐요. 비밀은 잡초 뽑기래요.', '꽃다발 하나면 누구든 웃게 할 수 있어요!'],
      ['{me}님 오셨어요? 마침 보고 싶었어요!', '{me}님한테 어울리는 꽃을 생각해 봤는데, 해바라기 같아요.', '사장님 몰래 제일 예쁜 꽃 한 송이 챙겨 뒀어요. 나중에 줄게요!'],
      ['{me}님은 제 섬 친구 1호예요. 정말이에요!', '{me}님 이름으로 꽃 이름을 지어 보고 싶어요. 「{me}꽃」 어때요?', '힘든 날엔 꽃집에 와요. 제일 좋은 향기로 기운 나게 해 줄게요.']],
      morning: '좋은 아침이에요! 꽃들이 막 기지개를 켜는 시간이에요.', night: '밤엔 꽃들도 자요. 쉿, 조용히 걸어 주세요.' },
    { name: '해송', call: '해송 할아버지', role: '은퇴한 선장', about: '먼 바다를 오래 다니다 섬에 정착했다. 하얀 선장 모자가 자랑.', lines: [
      ['음? 처음 보는 얼굴이구먼. 난 바다를 오래 다닌 늙은 선장이라네.', '바닷바람 맞으러 왔나? 좋지.', '섬 생활은 천천히 해도 된다네.'],
      ['젊을 땐 고래 등에 손을 얹어 본 적도 있지. 정말이라니까.', '바람 냄새를 맡아 보게. 내일은 날이 좋겠어.', '낚시는 기다림이야. 서두르면 물고기가 먼저 알아.', '항구 어부는 내 옛 선원의 아들이라네.', '등대 불빛만 보면 아직도 가슴이 뛰어.'],
      ['{me}, 자네는 바다 사나이 기질이 있어. 내 눈은 못 속이지.', '자네한테만 말하는데, 등대 너머에 큰 물고기가 산다네.', '{me}랑 얘기하면 배 위에 있던 시절이 떠올라.'],
      ['{me}, 내 선장 모자를 물려줄 사람이 있다면 자네일 걸세.', '평생 바다만 보고 살았는데, 이제는 자네 같은 친구가 보물이야.', '폭풍 속에서도 돌아올 항구가 있다는 건 큰 복이지. 자네가 그런 사람이야.']],
      morning: '아침 바다는 거울 같지. 한번 보고 오게.', night: '밤바다 위 별을 세다 보면 시간 가는 줄 몰라.' },
    { name: '하람', role: '소설가 지망생', about: '섬 풍경을 공책에 적어 다니며 첫 소설을 쓰고 있다.', lines: [
      ['아, 안녕하세요… 하람이에요. 글 쓰는 중이었어요.', '방해… 아니에요. 괜찮아요.', '섬에 새로 오셨나 봐요. 이 섬, 이야기가 많아요.'],
      ['지금 쓰는 소설 주인공이 이 섬에 살아요. 아직 이름은 비밀이에요.', '정자에 앉아 있으면 문장이 저절로 떠올라요.', '사람들 이야기를 듣는 게 제일 좋은 공부래요.', '어제는 한 줄도 못 썼어요… 오늘은 두 줄 쓸 거예요!', '도서관에 제 책이 꽂히는 날이 오겠죠?'],
      ['{me}님, 제 소설에 조연으로 나와도 될까요?', '{me}님한테 처음으로 제 원고 첫 장을 보여 드릴게요. 부끄럽지만요.', '{me}님이랑 얘기하면 막혔던 문장이 풀려요.'],
      ['결심했어요. 제 소설 주인공 이름은 {me}예요.', '책이 나오면 첫 장에 「{me}에게」라고 쓸 거예요.', '{me}님이 없었으면 끝까지 못 썼을 거예요. 진심이에요.']],
      morning: '아침엔 머리가 맑아서 글이 잘 써져요.', night: '밤에 쓴 글은 아침에 다시 읽으면 부끄러워요.' },
    { name: '두리', role: '양봉가', about: '섬 언덕에서 꿀벌을 친다. 노란 모자를 쓰면 벌들이 알아본다.', lines: [
      ['안녕하세요, 저는 벌 키우는 두리예요. 벌 무서워하지 않으시죠?', '노란 모자 보고 놀라셨죠? 벌들이 이걸 보고 저를 알아봐요.', '꿀 좋아하세요?'],
      ['우리 벌들은 열매나무 꽃을 제일 좋아해요.', '꿀 한 숟가락이면 기운이 나요. 진짜예요!', '벌은 화내지 않아요. 놀라게만 하지 않으면요.', '올해 꿀은 유난히 달아요. 다 섬 꽃들 덕분이죠.', '벌집 근처에선 뛰지 말아 주세요~'],
      ['{me}님이 오면 벌들도 조용해져요. 신기하죠?', '이번 꿀 첫 병은 {me}님 몫으로 빼 뒀어요.', '{me}님, 벌들한테 이름 붙이는 거 도와줄래요?'],
      ['여왕벌 이름을 {me}로 지었어요. 허락 안 받았지만요!', '{me}님은 꿀보다 달콤한 친구예요. 헤헤.', '언덕 위 벌집 자리, {me}님한테만 알려 줄게요.']],
      morning: '벌들이 일하러 나가는 시간이에요. 부지런하죠?', night: '벌들은 벌써 집에 들어갔어요. 저도 곧 가야죠.' },
    { name: '노을', call: '노을 할머니', role: '산책을 좋아하는 할머니', about: '하루에 섬을 두 바퀴씩 걷는다. 섬 소식은 다 안다.', lines: [
      ['어이구, 처음 보는 젊은이네. 나는 노을이라고 해.', '이 섬은 걷기 좋은 곳이야. 천천히 둘러봐.', '어디서 왔누?'],
      ['젊은이, 오늘도 걷고 있구먼. 걷는 게 최고야.', '저기 다리 건너 풍경이 참 고와. 가 봤나?', '내 나이 되면 매일 같은 길도 새로워 보인다네.', '시장님이 요즘 관공서 일로 바쁘시더라고.', '밥은 먹고 다니는 게지?'],
      ['{me}야, 왔구나! 오늘은 같이 좀 걸을까?', '우리 {me}는 볼 때마다 얼굴이 좋아지네.', '{me} 주려고 사탕 하나 챙겨 왔지. 자, 받아.'],
      ['{me}야, 너는 내 손주 같아. 고맙다, 자주 와 줘서.', '섬 소식은 다 알아도, {me} 소식이 제일 궁금하단다.', '내가 걷는 길마다 {me}랑 같이 걸은 기억이 있어. 좋구나.']],
      morning: '아침 공기가 보약이야. 깊이 들이마셔 봐.', night: '해 졌으면 일찍 들어가. 밤길 조심하고.' },
    { name: '누리', call: '오 탐정', role: '동네 탐정(자칭)', about: '검은 모자를 쓰고 섬의 작은 사건을 수사한다. 의뢰는 아직 없다.', lines: [
      ['멈춰! …아, 용의자가 아니군. 나는 오 탐정이다.', '처음 보는 얼굴이군. 수상한데… 농담이야.', '사건이 생기면 날 찾게.'],
      ['수상해… 분실물이 왜 자꾸 풀밭에서 나오는 거지?', '탐정의 기본은 관찰이야. 자네 신발에 흙이 묻었군. 잡초를 뽑았나?', '이 섬엔 아직 풀리지 않은 비밀이 있어. 내가 꼭 밝혀낸다.', '사건 의뢰는 언제든 환영이야. 수수료는… 나중에 얘기하지.', '어젯밤 광장에서 이상한 불빛을 봤어. 아, 가로등이었나.'],
      ['{me}, 자네를 조수로 임명하지. 거절은 안 받네.', '{me} 조수, 오늘의 수사 보고를 하겠네. …아직 없네.', '자네 덕에 분실물 사건 몇 개가 풀렸지. 훌륭해, {me}.'],
      ['{me}, 자네는 이제 조수가 아니라 파트너야. 「오 & {me} 탐정 사무소」 어떤가?', '세상에서 내가 의심하지 않는 사람은 {me} 하나뿐이네.', '내 수첩 맨 앞장에 자네 이름이 있지. 믿을 사람 1번.']],
      morning: '아침부터 사건 냄새가 나는군.', night: '밤이야말로 탐정의 시간이지.' },
    { name: '다온', role: '견습 제빵사', about: '광장 빵집에서 일을 배우는 중. 새 빵을 만들면 꼭 누군가에게 맛보인다.', lines: [
      ['안녕하세요! 빵집에서 일 배우는 다온이에요.', '밀가루 묻었죠? 방금 반죽하다 나왔어요.', '빵 좋아하세요?'],
      ['오늘은 밤식빵을 구웠어요! 조금 탔지만요.', '빵 반죽은 기다려 줘야 부풀어요. 사람도 그렇대요.', '섬 열매로 잼 빵을 만들고 싶어요.', '사장님한테 칭찬받았어요! 처음으로요!', '갓 구운 빵 냄새 맡으면 행복해지지 않아요?'],
      ['{me}님, 새로 만든 빵 맛 좀 봐 줄래요? 솔직하게요!', '{me}님 오는 시간 맞춰서 빵 굽는 거 알아요?', '{me}님이 맛있다고 한 빵, 사장님이 진열하기로 했어요!'],
      ['신메뉴 이름을 「{me}빵」으로 하자고 사장님을 설득 중이에요.', '언젠가 제 빵집을 열면 {me}님은 평생 공짜예요.', '{me}님은 제 빵을 처음 맛있다고 해 준 사람이에요. 잊지 않을게요.']],
      morning: '새벽부터 반죽했어요. 하암… 졸려요.', night: '내일 아침 빵 반죽을 미리 해 두고 왔어요.' },
    { name: '바람이', role: '우편배달부', about: '자전거로 섬 구석구석 편지를 나른다. 섬에서 길을 제일 잘 안다.', lines: [
      ['안녕하세요! 우편배달부 바람이에요. 바쁘다 바빠!', '처음 뵙네요. 주소 알려 주시면 편지 배달해 드려요!', '섬 길 모르는 데 있으면 물어보세요.'],
      ['편지 왔어요! …아, 당신 건 아니에요. 헷갈렸어요.', '섬 지름길은 제가 다 알아요. 비밀이지만요.', '편지는 기다리는 사람이 있어서 좋아요.', '다리 건너 집들은 오르막이라 힘들어요.', '요즘은 메신저로 다들 얘기해서 편지가 줄었어요.'],
      ['{me}님! 배달 가는 길에 마주쳐서 반가워요.', '{me}님한테만 알려 주는 지름길: 정자 뒤로 가면 빨라요.', '{me}님 앞으로 편지가 오면 제일 먼저 달려갈게요.'],
      ['언젠가 {me}님한테 진짜 편지를 써서 직접 배달할 거예요.', '{me}님이 있는 쪽 배달이 제일 신나요.', '섬 지도에 {me}님 집 표시를 제일 크게 해 뒀어요!']],
      morning: '오늘도 배달 시작! 날씨가 좋네요.', night: '오늘 배달 끝! 다리가 후들거려요.' },
    { name: '이솔', role: '천문 동아리 학생', about: '밤마다 언덕에서 별을 본다. 낮엔 늘 조금 졸려 보인다.', lines: [
      ['아… 안녕하세요. 이솔이에요. 별 보는 거 좋아해요.', '하아암… 죄송해요, 어젯밤 늦게 자서요.', '밤에 언덕에 가 보신 적 있어요?'],
      ['섬은 불빛이 적어서 별이 정말 잘 보여요.', '별똥별을 보면 소원 세 개를 빨리 말해야 해요.', '낮에도 별은 거기 있어요. 안 보일 뿐이에요.', '망원경을 사려고 포인트를 모으는 중이에요.', '저 등대 불빛이 별인 줄 알았던 적 있어요.'],
      ['{me}님, 오늘 밤 같이 별 보러 갈래요?', '{me}님이 좋아할 만한 별자리를 찾았어요. 다음에 알려 줄게요.', '{me}님이랑 얘기하면 잠이 깨요. 신기하게.'],
      ['새로 찾은 작은 별 하나, 몰래 {me}별이라고 부르고 있어요.', '별보다 {me}님 이야기가 더 재밌어요. 진짜로요.', '나중에 천문대에 가게 되면 제일 먼저 {me}님께 연락할게요.']],
      morning: '하아암… 어젯밤 별 보느라 못 잤어요.', night: '오늘 밤하늘 정말 맑죠? 같이 볼래요?' },
    { name: '가람', role: '꼬마 탐험가', about: '섬의 안 가 본 곳을 모두 가 보는 게 꿈이다. 파란 모자가 트레이드마크.', lines: [
      ['누구세요? 저는 탐험가 가람이에요!', '처음 보는 사람이다! 섬 탐험하러 왔어요?', '제 파란 모자 멋있죠?'],
      ['저 산 너머에 뭐가 있는지 알아요? 저는 알아요!', '탐험가는 겁내지 않아요. 조금만 무서워해요.', '바닷가에서 예쁜 조개를 찾았어요. 보여 줄까요?', '오 탐정 아저씨랑 같이 사건을 풀고 있어요!', '언젠가 섬 지도를 제가 다 그릴 거예요.'],
      ['{me}님! 오늘도 같이 탐험 가요!', '{me}님 탐험대 대원으로 임명합니다! 짝짝짝!', '제일 아끼는 조개 껍데기, {me}님한테만 보여 줄게요.'],
      ['{me}님은 우리 탐험대 부대장이에요. 대장은 저고요!', '섬 지도에 「{me} 언덕」을 만들었어요. 제 마음대로요!', '어른이 돼도 {me}님이랑 탐험할 거예요. 약속!']],
      morning: '오늘은 어디를 탐험할까요?', night: '엄마가 해 지기 전에 들어오랬는데…!' },
  ].map((c, n) => Object.freeze({ n, tagColor: TAG_COLORS[n], ...c, lines: Object.freeze(c.lines.map((l) => Object.freeze(l))) }));
  // the story keepers: their own numbers for 호감도 (after the ten), and their words when the story has nothing to ask
  const KEEPERS = Object.freeze({
    granny: Object.freeze({ n: 10, role: '정원사', lines: [
      ['처음 보는구나. 정원 구경하러 왔니?', '꽃 밟지 않게 조심하렴.'],
      ['화단 꽃들이 오늘따라 고개를 들었구나.', '잡초는 뽑아도 또 나지. 그래도 뽑는 맛이 있단다.', '열매 잼이 잘 익었어. 다음에 한 숟갈 주마.'],
      ['{me} 왔구나! 네 덕에 화단이 늘 깨끗해.', '{me}야, 새로 핀 꽃 이름 같이 지어 보자.'],
      ['{me}는 내 정원의 수호천사야.', '내 정원 제일 좋은 자리에 {me} 이름표를 꽂아 뒀단다.']] }),
    fisher: Object.freeze({ n: 11, role: '어부', lines: [
      ['처음 뵙네요. 항구 어부예요.', '배 근처는 미끄러우니 조심하세요.'],
      ['오늘 물때가 좋아요. 한번 던져 보세요!', '해송 할아버지는 제 아버지와 같은 배를 타셨대요.', '바다가 깨끗해야 고기도 돌아와요.'],
      ['{me}님, 오늘 잡힌 것 중에 제일 큰 놈 보여 줄게요!', '{me}님 덕분에 항구가 깨끗해졌어요.'],
      ['다음 배 이름은 「{me}호」로 할까 봐요.', '{me}님은 이 항구의 명예 선원이에요.']] }),
    photographer: Object.freeze({ n: 12, role: '관광객 사진가', lines: [
      ['안녕하세요, 섬 사진을 찍으러 온 여행자예요.', '이 섬 처음이세요? 저도 그래요.'],
      ['이 섬은 어디를 찍어도 그림이에요.', '빛이 좋을 때를 기다리는 게 사진의 반이에요.', '다음엔 등대 야경을 찍고 싶어요.'],
      ['{me}님, 사진 한 장 찍어도 돼요? 표정이 좋아서요.', '{me}님이 알려 준 장소, 정말 좋았어요.'],
      ['제 사진집 표지는 {me}님이랑 찍은 섬 풍경이에요.', '이 섬에 다시 오는 이유의 반은 {me}님이에요.']] }),
    farmer: Object.freeze({ n: 13, role: '농부', lines: [
      ['처음 보네요. 밭 구경은 자유예요.', '흙 묻어도 괜찮으면 가까이 와요.'],
      ['밭은 거짓말을 안 해요. 돌본 만큼 자라요.', '두더지 녀석들, 요즘은 좀 조용하네요.', '수확철엔 섬 사람들이 다 같이 도와줘서 든든해요.'],
      ['{me}님 오셨어요? 올해 작물은 {me}님 덕이에요.', '{me}님 몫으로 제일 실한 걸 골라 둘게요.'],
      ['밭 한 줄은 「{me} 줄」이에요. 거기 건 제일 잘 자라요.', '{me}님은 제 농사 동업자예요. 진심으로요.']] }),
    painter: Object.freeze({ n: 15, role: '화가', lines: [
      ['안녕하세요. 섬 풍경을 그리는 화가예요.', '물감 냄새 괜찮으세요?'],
      ['광장 벽화는 섬 사람들이 같이 완성해요.', '오늘 하늘 색은 그리기 어렵네요. 너무 예뻐서요.', '색은 섞을수록 깊어져요. 사람도 그렇죠.'],
      ['{me}님 눈은 색을 잘 봐요. 같이 그려요!', '{me}님 덕분에 벽화가 환해졌어요.'],
      ['벽화 구석에 {me}님을 몰래 그려 넣었어요.', '{me}님은 제 그림의 단골 손님이에요.']] }),
    stationmaster: Object.freeze({ n: 16, role: '역무원', lines: [
      ['동해안역입니다. 열차 이용에 불편은 없으세요?', '승강장에서는 뛰지 마세요.'],
      ['열차는 시간표대로 다닙니다. 거의요.', '남서해안역까지는 금방이에요.', '역 앞 벤치에서 바다 보는 사람이 많아요.'],
      ['{me}님, 오늘도 열차 타러 오셨어요?', '{me}님 덕분에 시간표가 깔끔해졌어요.'],
      ['{me}님 전용 좌석이라도 만들어 드리고 싶네요.', '{me}님이 타면 열차가 더 반가워하는 것 같아요.']] }),
    busker: Object.freeze({ n: 17, role: '거리 악단', lines: [
      ['안녕! 광장에서 노래하는 거리 악단이야.', '신청곡 있어?'],
      ['오늘은 바다 노래를 연습했어.', '기타 줄을 새로 갈았더니 소리가 좋아.', '박수 소리가 제일 좋은 반주야.'],
      ['{me}! 오늘도 들으러 왔구나.', '{me}가 박자를 맞춰 줘서 공연이 살았어.'],
      ['다음 곡 제목은 「{me}의 섬」이야.', '{me}는 내 첫 번째 팬이야. 영원히!']] }),
    electrician: Object.freeze({ n: 18, role: '전기 담당', lines: [
      ['안녕하세요. 섬 전기를 맡고 있어요.', '전선 근처에서는 조심하세요.'],
      ['가로등은 저녁에 저절로 켜져요. 고장만 안 나면요.', '공구 상자는 제 보물 상자예요.', '번개 치는 날이 제일 바빠요.'],
      ['{me}님, 회로 보는 눈이 좋던데요?', '{me}님 덕분에 길이 환해졌어요.'],
      ['{me}님 집 앞 가로등은 제일 밝게 해 둘게요.', '{me}님이랑 일하면 하나도 안 힘들어요.']] }),
    builder: Object.freeze({ n: 19, role: '공사 인부', lines: [
      ['안녕하세요! 공사 중이니 조심해서 다녀 주세요.', '돌은 무거워요. 제가 들게요.'],
      ['개울에 징검돌을 놓고 있어요.', '튼튼하게 만드는 게 제일이에요.', '다리 놓는 일은 생각보다 계산이 많아요.'],
      ['{me}님, 길 찾는 솜씨가 대단해요!', '{me}님 덕분에 공사가 빨라졌어요.'],
      ['징검돌 하나에 {me}님 이름을 새겨 둘까요?', '{me}님은 우리 공사장 최고의 반장이에요.']] }),
    librarian: Object.freeze({ n: 20, role: '도서관 할아버지', lines: [
      ['허허, 책 좋아하니?', '조용히 읽으면 더 재미있단다.'],
      ['책 수레에는 섬 이야기책이 많단다.', '그림책은 그림부터 보는 거야.', '돋보기가 어디 갔더라.'],
      ['{me}, 그림을 참 잘 찾는구나.', '{me} 덕분에 책 표지가 다시 예뻐졌어.'],
      ['{me}에게 제일 아끼는 책을 먼저 빌려주마.', '{me}는 내 오랜 책 친구란다.']] }),
    grandpa: Object.freeze({ n: 21, role: '정자 할아버지', lines: [
      ['허허, 젊은이. 바둑돌 소리 좋지 않은가?', '정자 바람이 시원하구먼.'],
      ['오목은 세 수 앞을 봐야 하네.', '오델로는 모서리가 생명이지.', '이기는 것보다 즐기는 게 먼저야.'],
      ['{me}, 수읽기가 늘었구먼!', '{me}랑 두면 시간 가는 줄 모르겠어.'],
      ['{me}는 내 최고의 맞수일세.', '내 비법은 {me}에게만 알려 주지.']] }),
    // R4 구치소장: his words when one passes the essay (아는 사이 and on: a joke)
    warden: Object.freeze({ n: 22, role: '김우성 구치소장', lines: [ // (사용자 2026-10-26: his name -- notes resident-voice-design 덧)
      ['통과입니다. 철창을 열어 드리죠.', '됐습니다. 나가셔도 좋습니다.'],
      ['또 오셨군요. 반성문 솜씨는 늘었네요.', '타자 실력이 늘어 가는 게 보입니다. 그게 좋은 건지는 모르겠지만요.', '이 정도면 반성문 장인이라 불러야겠어요.'],
      ['{me}님, 이제 반성문은 눈 감고도 쓰겠어요.', '{me}님 오면 차 한 잔 내 드리고 싶다니까요. 세금은 내고요.'],
      ['{me}님 자리는 늘 비워 두죠. 농담입니다. 오지 마세요.', '{me}님은 제 단골입니다. 자랑은 아니에요.']] }),
    kid: Object.freeze({ n: 14, role: '할로윈 꼬마', lines: [
      ['트릭 오어 트릿! 누구세요?', '제 분장 무섭죠?'],
      ['트릭 오어 트릿! 사탕 있어요?', '제 분장 무섭죠? 무섭다고 해 주세요!'],
      ['{me}님은 사탕 친구예요!', '{me}님한테만 제일 큰 사탕 줄게요.'],
      ['내년 할로윈에도 {me}님이랑 다닐 거예요!', '{me}님은 제 최고의 할로윈 짝꿍이에요!']] }),
  });
  // A-6 (사용자 2026-10-18): each walker's word for the island's day, by index -- rain, a rainbow, a star night, the
  // weekend contest, the winter festival
  const MOODS = Object.freeze({
    rain: ['비 오는 날엔 꽃들이 물을 실컷 마셔요. 저도 덩달아 기분 좋아요.', '비 오는 날 바다는 회색이지만, 물고기는 더 잘 문다네.', '빗소리 들으면서 쓰면 문장이 촉촉해져요.', '비 오는 날엔 벌들이 집에 있어요. 저도 쉬는 날이에요.', '비 오는 날엔 우산 꼭 챙겨. 감기 걸린다.',
      '비 오는 날엔 발자국이 잘 남지. 수사하기 딱 좋아.', '비 오는 날엔 반죽이 잘 안 부풀어요. 습해서요.', '비 오는 날 배달이 제일 힘들어요. 편지가 젖으면 안 되거든요.', '비 오면 별을 못 봐서 슬퍼요….', '비 오는 날 탐험은 장화가 필수예요!'],
    rainbow: ['무지개다! 꽃잎 색깔이 다 저기 있어요.', '바다 위 무지개는 선원들한테 좋은 징조야.', '무지개를 한 문장으로 쓰려니 너무 어려워요.', '무지개 뜨면 벌들이 신나서 붕붕거려요!', '어이구, 무지개구나. 오래 살고 볼 일이야.',
      '무지개 끝에 보물이 있다는 제보가 들어왔어. 조사 중이야.', '무지개 케이크를 만들어 보고 싶어요!', '배달하다 무지개 봤어요! 오늘 운 좋은 날이에요.', '무지개는 햇빛이 물방울에서 꺾여서 생기는 거래요.', '무지개 끝까지 가 볼 거예요! 따라올래요?'],
    stars: ['별똥별 뜨는 밤엔 꽃집 창가에서 소원을 빌어요.', '별똥별 떨어지는 밤엔 옛 항해가 생각나는구먼.', '별똥별이 떨어지는 장면을 소설에 넣었어요.', '밤엔 벌들도 자요. 별똥별은 저 혼자 봐요.', '별똥별 보면 소원 빌어. 나는 늘 섬 사람들 건강을 빌지.',
      '밤하늘에 수상한 불빛… 아, 별똥별이군.', '별 모양 쿠키를 구웠어요. 오늘 밤 별똥별 기념이에요.', '별똥별 뜨는 밤엔 늦게까지 배달해도 안 힘들어요.', '오늘 밤 별똥별 온대요! 언덕에서 같이 봐요!', '별똥별 주우러 갈 거예요! 어디 떨어지는지 봐 줘요.'],
    contest: ['오늘 섬 대회 나가요? 이기면 꽃 한 송이 드릴게요!', '대회라고? 젊은이들 기운이 좋구먼. 나도 한창땐….', '오늘 대회 장면, 소설에 쓰려고 구경 왔어요.', '대회 나가세요? 꿀 한 숟가락 먹고 가요, 힘 나게!', '오늘 대회 있다며? 구경 가야지.',
      '대회 날엔 사건이 많아. 내가 지켜보고 있지.', '대회 끝나면 빵집 와요. 응원 빵 드릴게요!', '대회 소식은 제가 섬 구석구석 다 알렸어요!', '대회요? 별 세기 대회면 제가 일등 할 텐데.', '대회 나가요? 저도 크면 꼭 나갈 거예요!'],
    winter: ['겨울 축제라 꽃집에 포인세티아가 들어왔어요.', '겨울 축제라… 배 위에서 보낸 크리스마스가 떠오르네.', '겨울 축제 이야기로 단편을 하나 써 볼까 해요.', '겨울엔 벌들이 꼭 붙어서 겨울을 나요. 축제 소리에 깰까 봐 걱정이에요.', '겨울 축제엔 따뜻한 차 한 잔이 최고야.',
      '축제 트리 장식이 하나 없어졌다는 제보가… 아직 수사 중이야.', '겨울 축제라 생강 쿠키를 잔뜩 구웠어요!', '겨울 축제라 카드 배달이 엄청 많아요!', '겨울 밤하늘이 제일 맑아요. 축제 불빛만 좀 줄이면요.', '눈사람 만들 거예요! 축제 트리보다 크게요!'],
  });
  // A-6 주민끼리 수다: two walkers standing together trade lines -- each one's [to the other ({you}), an answer, a goodbye]
  const CHATS = Object.freeze([
    ['{you}, 오늘 꽃 한 송이 어때요?', '와, 좋아요! 벌써 기분이 좋아지네요.', '그럼 이따 꽃집에서 봐요!'],
    ['{you}, 같이 바다 보러 가겠나?', '허허, 그거 좋구먼.', '자, 그럼 또 걸어 볼까.'],
    ['{you}, 이야기 하나 들려줄래요?', '좋아요! 그거 소설에 써도 돼요?', '잊기 전에 적어 둘게요!'],
    ['{you}, 꿀 한 숟가락 맛볼래요?', '좋아요! 벌들도 좋아할 거예요.', '벌들 보러 가야겠어요. 또 봐요!'],
    ['{you}야, 같이 좀 걸을까?', '그래그래, 좋지.', '천천히 다니거라.'],
    ['{you}, 수사 좀 도와주겠나?', '좋아. 내 수첩에 적어 두지.', '수사는 계속된다!'],
    ['{you}, 새로 구운 빵 맛볼래요?', '좋아요! 빵 하나 들고 갈게요.', '반죽 보러 가야 해요. 안녕!'],
    ['{you}, 이따 편지 한 통 써 줄래요?', '좋아요! 배달 끝나면 갈게요.', '배달 가야 해요. 다음에 봐요!'],
    ['{you}, 오늘 밤 별 보러 갈래요?', '좋아요… 하암, 졸리지만요.', '그 전에 낮잠 좀 자야겠어요.'],
    ['{you}, 같이 탐험 가요!', '좋아요, 대원 한 명 추가!', '출발! 저 언덕까지!'],
  ].map((l) => Object.freeze(l)));
  // the line of a chat between walkers a and b in time slot `slot` (the server clock's, so every screen shows the same):
  // { who, text } -- a opens, b answers, a says goodbye, a quiet beat; then b opens
  function chatLine(a, b, slot) {
    const [x, y] = Math.floor(slot / 4) % 2 ? [b, a] : [a, b]; const k = ((slot % 4) + 4) % 4;
    if (k === 3 || !WALKERS[x] || !WALKERS[y]) return null;
    const who = k === 1 ? y : x;
    return { who, text: withTail(CHATS[who][k].split('{you}').join(callOf(k === 1 ? x : y)), who) };
  }
  const PHASES = ['morning', 'day', 'evening', 'night'];
  const hasFinal = (word) => { const c = String(word).charCodeAt(String(word).length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
  // v1.10.193 주민 이름 (사용자 확정, 설정집 2-1): the tag, the notes and the cards say the name only; when the islanders
  // speak of one another it is how they call them -- 「해송 할아버지」「노을 할머니」「오 탐정」 (their call), else the name
  const callOf = (n) => WALKERS[n]?.call || WALKERS[n]?.name || '';
  const josa = (word, pair) => `${word}${hasFinal(word) ? pair[0] : pair[1]}`; // josa('봄이', '이가') -> 봄이가
  // {name} a word as it is, {name|A|B} with A after a final consonant, B after a vowel ({me|아|야}, {thing|이라고|라고})
  const slot = (line, name, word) => line.replace(new RegExp(`\\{${name}(?:\\|([^|}]*)\\|([^}]*))?\\}`, 'g'), (_, a, b) => (a === undefined ? word : `${word}${hasFinal(word) ? a : b}`));
  const fill = (line, me) => slot(line, 'me', me || '친구');
  const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

  // T 주민 말투 (gamecenter-notes docs/resident-voice-design-20261026.md, 사용자 「사람 주민에 말버릇」): each walker speaks
  // in their own register (말씨) -- the lines every walker shares (a greeting, an errand, a gift, ...) are written once
  // for each register, never by changing endings -- with a few of their own over them, and their tic (말버릇) said once,
  // at the end of what they say (not each sentence). 하람·바다 할아버지·노을 할머니·오 탐정·가람 carry theirs in their
  // own endings (~랄까요… ~라네 ~구나 ~란 말이지 ~거든!); the five with a word at the end have `tail`.
  // A key's value: alternatives -- each a line, or a run of lines said one after another.
  const REG = {
    yo: { // 해요체
      greet1: ['안녕하세요, {me}님!', '{me}님, 오늘도 좋은 하루예요.', '어, {me}님이다! 반가워요.'],
      greet2: ['{me}님! 마침 생각하고 있었어요.', '{me}님, 어디 가요? 잘 다녀와요!', '오늘 날씨 좋죠, {me}님?'],
      greet3: ['{me}님! 보고 싶었어요!', '{me}님, 오늘도 같이 걸을래요?', '역시 {me}님이에요! 오늘도 반가워요.'],
      why: ['빌려 간 책을 돌려받아야 하거든요.', '꼭 할 말이 있는데 어디 갔는지 모르겠어요.', '같이 산책하기로 했는데 안 보여요.', '맛있는 걸 나눠 주고 싶은데 안 보이네요.'],
      ask_buy: [['오늘 {thing|이|가} 필요한데 잡화점에 갈 틈이 없어요.', '하나만 사다 줄래요? 물건값은 꼭 드릴게요!']],
      ask_find: [['혹시 {who|을|를} 못 봤어요? {why}', '보면 제가 찾는다고 전해 주세요!']],
      ask_deliver: [['이 {thing}, {who}에게 좀 전해 줄래요?', '제가 지금 바빠서요. 부탁해요!']],
      hint: ['{who|은|는} 보통 {where} 근처에 있어요.'],
      remind_buy: ['{thing}, 잡화점에 있을 거예요. 부탁해요!'], remind_find: ['{who|은|는} 아직 못 찾았어요? 섬 어딘가를 걷고 있을 거예요.'],
      remind_find_where: ['{who|은|는} 아직 못 찾았어요? 보통 {where} 쪽에 있어요.'], remind_deliver: ['{thing}, {who}에게 아직 못 전했죠? 부탁해요!'],
      got_buy: [['{thing|이|가} 딱 필요했어요! 사다 줘서 고마워요.', '물건값에 수고비까지 얹었어요.']],
      got_deliver: [['{from|이|가} 보낸 {thing|이요|요}? 와, 고마워요!', '전해 준 사례예요. 받아 주세요.']],
      found_me: [['{from|이|가} 저를 찾는다고요? 아, 깜빡했어요!', '알려 줘서 고마워요. {from}에게 곧 간다고 전해 줄래요?']],
      found_back: [['{who|을|를} 찾아 줬군요! 정말 고마워요.', '이건 작은 사례예요.']],
      giftLove: ['와, {name}! 제가 제일 좋아하는 거예요. 정말 고마워요!'], giftLike: ['{name} 고마워요! 잘 쓸게요.'], giftMeh: ['{name}… 마음만 받을게요. 고마워요.'],
      answerLiked: ['와, 저도 그래요! 우리 잘 맞네요.'], answerMeh: ['오, 그것도 좋죠!'], answerDisliked: ['그렇군요… 저는 좀 달라요. 그래도 들려줘서 고마워요.'],
      letter: ['{me}님, 오늘 날씨가 참 좋네요. 섬 어딘가에서 마주치면 인사해요!', '{me}님 덕분에 요즘 섬 생활이 즐거워요. 고마워요.', '{me}님, 다음에 만나면 재미있는 이야기 들려줄게요. 기대해요!', '오늘 {me}님 생각이 나서 몇 자 적어요. 늘 건강해요!', '{me}님, 우리 섬에 와 줘서 정말 기뻐요. 또 봐요!'],
      hit: ['아야! 뭐 하는 거예요!', '잠자리채로 치면 어떡해요!', '나 곤충 아니에요!'],
      levelUp1: ['이제 {me}님이랑 아는 사이예요!'], levelUp2: ['{me}님이랑 친해져서 정말 좋아요!'], levelUp3: ['{me}님은 이제 제 단짝이에요!'],
      mem_errand: ['{when} 「{text}」 도와줘서 고마웠어요, {me}님!'], mem_errand_short: ['{when} 도와줘서 고마웠어요, {me}님!'], mem_answer: ['{when} 해 준 이야기, 계속 생각나요.'], mem_gift: ['{when} 준 {name}, 아직도 기분 좋아요!'],
      answerAgain: ['오늘은 벌써 이야기 나눴어요. 내일 또 들려줘요!'], giftAgain: ['오늘은 벌써 선물을 받았어요. 마음만으로 충분해요!'], giftAsk: ['저한테 주려고요? 뭘까요?'], giftNone: ['가방에 줄 만한 게 없네요. 괜찮아요!'], errandNone: ['오늘은 괜찮아요. 마음만 받을게요!'], errandYes: ['고마워요! 부탁할게요.'], errandLater: ['괜찮아요, 다음에 부탁해요!'], relRival: ['사실 {a|과|와} {b}, 요즘 좀 서먹했대요. 덕분에 사이가 풀렸어요!'], relFriend: ['둘은 오랜 친구라 더 기뻐할 거예요.'],
    },
    hage: { // 하게체 (노인·자칭 탐정)
      greet1: ['허허, {me} 왔는가.', '{me}, 오늘도 좋은 하루 보내게.', '오, 반갑네. {me} 아닌가.'],
      greet2: ['{me}, 마침 자네 생각을 하고 있었네.', '어디 가는 길인가, {me}? 조심히 다녀오게.', '오늘 바람 좋지 않은가, {me}?'],
      greet3: ['{me}! 기다리고 있었다네.', '{me}, 오늘도 같이 좀 걷겠나?', '역시 {me}일세. 반갑구먼.'],
      why: ['빌려 간 책을 돌려받아야 하거든.', '꼭 할 말이 있는데 어디 갔는지 모르겠구먼.', '같이 산책하기로 했는데 보이질 않네.', '맛있는 걸 나눠 주고 싶은데 안 보이는구먼.'],
      ask_buy: [['오늘 {thing|이|가} 필요한데 잡화점에 갈 틈이 없구먼.', '하나만 사다 주겠나? 물건값은 꼭 치르겠네.']],
      ask_find: [['혹시 {who|을|를} 못 봤나? {why}', '보거든 내가 찾는다고 전해 주게.']],
      ask_deliver: [['이 {thing}, {who}에게 좀 전해 주겠나?', '내가 지금 바빠서 말일세. 부탁하네.']],
      hint: ['{who|은|는} 보통 {where} 근처에 있다네.'],
      remind_buy: ['{thing}, 잡화점에 있을 걸세. 부탁하네.'], remind_find: ['{who|을|를} 아직 못 찾았나? 섬 어딘가를 걷고 있을 걸세.'],
      remind_find_where: ['{who|을|를} 아직 못 찾았나? 보통 {where} 쪽에 있다네.'], remind_deliver: ['{thing}, {who}에게 아직 못 전했나? 부탁하네.'],
      got_buy: [['{thing|이|가} 딱 필요했다네! 사다 줘서 고맙구먼.', '물건값에 수고비까지 얹었네.']],
      got_deliver: [['{from|이|가} 보낸 {thing|이라고|라고}? 허허, 고맙구먼.', '전해 준 사례일세. 받아 두게.']],
      found_me: [['{from|이|가} 나를 찾는다고? 아, 깜빡했구먼!', '알려 줘서 고맙네. {from}에게 곧 간다고 전해 주겠나?']],
      found_back: [['{who|을|를} 찾아 줬구먼! 정말 고맙네.', '이건 작은 사례일세.']],
      giftLove: ['허허, {name}! 내가 제일 좋아하는 걸세. 정말 고맙네.'], giftLike: ['{name}, 고맙네. 잘 쓰겠네.'], giftMeh: ['{name}… 마음만 받겠네. 고맙구먼.'],
      answerLiked: ['허허, 나도 그렇다네! 우리 잘 맞는구먼.'], answerMeh: ['오, 그것도 좋지.'], answerDisliked: ['그런가… 나는 좀 다르다네. 그래도 들려줘서 고맙네.'],
      letter: ['{me}, 오늘 바람이 참 좋다네. 섬 어딘가에서 마주치면 인사나 하세.', '{me} 덕분에 요즘 섬 생활이 즐겁구먼. 고맙네.', '{me}, 다음에 만나면 옛날 얘기 하나 들려주지.', '오늘 문득 {me} 생각이 나서 몇 자 적네. 늘 건강하게.', '{me}, 우리 섬에 와 줘서 고맙네. 또 보세.'],
      hit: ['아이쿠! 이게 무슨 짓인가!', '잠자리채로 치면 쓰나!', '내가 곤충으로 보이나!'],
      levelUp1: ['허허, 이제 자네와 아는 사이일세.'], levelUp2: ['{me}, 자네와 이렇게 가까워질 줄 알았네.'], levelUp3: ['{me}, 이제 자네는 내 단짝일세.'],
      mem_errand: ['{when} 「{text}」 도와줘서 고마웠네, {me}.'], mem_errand_short: ['{when} 도와줘서 고마웠네, {me}.'], mem_answer: ['{when} 해 준 이야기, 자꾸 생각나는구먼.'], mem_gift: ['{when} 준 {name}, 아직도 기분이 좋다네.'],
      answerAgain: ['오늘은 벌써 이야기를 나눴구먼. 내일 또 들려주게.'], giftAgain: ['오늘은 벌써 선물을 받았다네. 마음만으로 충분하네.'], giftAsk: ['나한테 주려는 건가? 뭔가?'], giftNone: ['가방에 줄 만한 게 없구먼. 괜찮네.'], errandNone: ['오늘은 괜찮네. 마음만 받겠네.'], errandYes: ['고맙네! 부탁하네.'], errandLater: ['괜찮네, 다음에 부탁하지.'], relRival: ['사실 {a|과|와} {b}, 요즘 좀 서먹했다네. 자네 덕에 사이가 풀렸구먼.'], relFriend: ['둘은 오랜 친구라 더 기뻐할 걸세.'],
    },
    grand: { // 할머니 말(해라체, 다정하게)
      greet1: ['아이고, {me} 왔구나.', '{me}, 오늘도 좋은 하루 보내렴.', '어이구, 반갑다. 밥은 먹었니?'],
      greet2: ['{me|아|야}, 마침 네 생각 하고 있었단다.', '어디 가니? 조심히 다녀오렴.', '오늘 날씨 참 좋지, 얘야?'],
      greet3: ['우리 {me} 왔구나! 보고 싶었단다.', '{me|아|야}, 오늘도 같이 좀 걸을까?', '역시 우리 {me|이구나|구나}.'],
      why: ['빌려 간 책을 돌려받아야 하거든.', '꼭 할 말이 있는데 어디 갔는지 모르겠구나.', '같이 산책하기로 했는데 안 보이는구나.', '맛있는 걸 나눠 주고 싶은데 안 보이는구나.'],
      ask_buy: [['오늘 {thing|이|가} 필요한데 잡화점에 갈 틈이 없구나.', '하나만 사다 주겠니? 물건값은 꼭 줄게.']],
      ask_find: [['혹시 {who|을|를} 못 봤니? {why}', '보거든 내가 찾는다고 전해 주렴.']],
      ask_deliver: [['이 {thing}, {who}에게 좀 전해 주겠니?', '내가 지금 좀 바쁘구나. 부탁하마.']],
      hint: ['{who|은|는} 보통 {where} 근처에 있단다.'],
      remind_buy: ['{thing}, 잡화점에 있을 게다. 부탁하마.'], remind_find: ['{who|을|를} 아직 못 찾았니? 섬 어딘가를 걷고 있을 게다.'],
      remind_find_where: ['{who|을|를} 아직 못 찾았니? 보통 {where} 쪽에 있단다.'], remind_deliver: ['{thing}, {who}에게 아직 못 전했니? 부탁하마.'],
      got_buy: [['아이고, {thing|이|가} 딱 필요했단다! 사다 줘서 고맙구나.', '물건값에 수고비까지 얹었다.']],
      got_deliver: [['{from|이|가} 보낸 {thing|이라고|라고}? 아이고, 고맙구나.', '전해 준 사례란다. 받아 두렴.']],
      found_me: [['{from|이|가} 나를 찾는다고? 아이고, 깜빡했구나!', '알려 줘서 고맙다. {from}에게 곧 간다고 전해 주렴.']],
      found_back: [['{who|을|를} 찾아 줬구나! 정말 고맙다, 얘야.', '이건 작은 사례란다.']],
      giftLove: ['아이고, {name}! 내가 제일 좋아하는 거란다. 정말 고맙구나.'], giftLike: ['{name}, 고맙다. 잘 쓰마.'], giftMeh: ['{name}… 마음만 받으마. 고맙구나.'],
      answerLiked: ['아이고, 나도 그렇단다! 우리 잘 맞는구나.'], answerMeh: ['오, 그것도 좋지.'], answerDisliked: ['그렇구나… 나는 좀 다르단다. 그래도 들려줘서 고맙다.'],
      letter: ['{me|아|야}, 오늘 날씨가 참 좋구나. 섬 어딘가에서 만나면 인사하렴.', '{me} 덕분에 요즘 사는 게 즐겁단다. 고맙다.', '{me|아|야}, 다음에 만나면 옛날이야기 하나 해 주마.', '오늘 네 생각이 나서 몇 자 적는다. 밥 잘 챙겨 먹으렴.', '{me|아|야}, 우리 섬에 와 줘서 정말 고맙구나. 또 보자.'],
      hit: ['아이고! 이게 무슨 짓이니!', '잠자리채로 치면 못쓴다!', '내가 곤충으로 보이니, 얘야!'],
      levelUp1: ['이제 너랑 아는 사이구나.'], levelUp2: ['{me|아|야}, 우리 많이 가까워졌구나.'], levelUp3: ['{me|아|야}, 이제 너는 내 손주나 다름없단다.'],
      mem_errand: ['{when} 「{text}」 도와줘서 고마웠다, {me|아|야}.'], mem_errand_short: ['{when} 도와줘서 고마웠다, {me|아|야}.'], mem_answer: ['{when} 해 준 이야기, 자꾸 생각나는구나.'], mem_gift: ['{when} 준 {name}, 아직도 기분이 좋단다.'],
      answerAgain: ['오늘은 벌써 이야기 나눴잖니. 내일 또 들려주렴.'], giftAgain: ['오늘은 벌써 선물을 받았단다. 마음만으로 충분하구나.'], giftAsk: ['나한테 주려고? 뭘까?'], giftNone: ['가방에 줄 만한 게 없구나. 괜찮다.'], errandNone: ['오늘은 괜찮단다. 마음만 받으마.'], errandYes: ['고맙구나! 부탁하마.'], errandLater: ['괜찮단다, 다음에 부탁하마.'], relRival: ['사실 {a|과|와} {b|이|가} 요즘 좀 서먹했단다. 네 덕에 사이가 풀렸구나.'], relFriend: ['둘은 오랜 친구라 더 기뻐할 게다.'],
    },
    kid: { // 꼬마 반말
      greet1: ['{me} 대장! 안녕!', '어, {me}다! 오늘도 탐험 가자!', '{me}, 오늘 날씨 탐험하기 딱 좋거든!'],
      greet2: ['{me} 대장! 마침 찾고 있었거든!', '{me}, 어디 가? 나도 같이 가자!', '오늘 바람 좋다! 저쪽 언덕 가 보자!'],
      greet3: ['{me} 대장! 보고 싶었거든!', '{me}, 오늘도 같이 탐험 가자!', '역시 {me} 대장이 최고거든!'],
      why: ['빌려 간 책을 돌려받아야 하거든!', '꼭 할 말이 있는데 어디 갔는지 모르겠어.', '같이 탐험하기로 했는데 안 보여!', '맛있는 거 나눠 주고 싶은데 안 보이거든.'],
      ask_buy: [['오늘 {thing|이|가} 필요한데 잡화점 갈 시간이 없거든.', '하나만 사다 줄래? 돈은 꼭 줄게!']],
      ask_find: [['혹시 {who|을|를} 못 봤어? {why}', '보면 내가 찾는다고 전해 줘!']],
      ask_deliver: [['이 {thing}, {who}한테 좀 전해 줄래?', '나 지금 탐험 중이라 바쁘거든. 부탁해!']],
      hint: ['{who|은|는} 보통 {where} 근처에 있거든.'],
      remind_buy: ['{thing}, 잡화점에 있을 거야. 부탁해!'], remind_find: ['{who|을|를} 아직 못 찾았어? 섬 어딘가 걷고 있을 거야.'],
      remind_find_where: ['{who|을|를} 아직 못 찾았어? 보통 {where} 쪽에 있거든.'], remind_deliver: ['{thing}, {who}한테 아직 못 전했어? 부탁해!'],
      got_buy: [['{thing|이|가} 딱 필요했거든! 사다 줘서 고마워!', '물건값에 수고비도 얹었어!']],
      got_deliver: [['{from|이|가} 보낸 {thing}? 와, 고마워!', '전해 준 사례야. 받아!']],
      found_me: [['{from|이|가} 나를 찾는다고? 아, 깜빡했다!', '알려 줘서 고마워. {from}한테 곧 간다고 전해 줄래?']],
      found_back: [['{who|을|를} 찾았구나! 진짜 고마워!', '이건 탐험대 사례야!']],
      giftLove: ['와, {name}! 내가 제일 좋아하는 거거든! 진짜 고마워!'], giftLike: ['{name} 고마워! 잘 쓸게!'], giftMeh: ['{name}… 음, 마음만 받을게. 고마워!'],
      answerLiked: ['와, 나도 그래! 우리 잘 맞거든!'], answerMeh: ['오, 그것도 좋아!'], answerDisliked: ['그렇구나… 나는 좀 달라. 그래도 말해 줘서 고마워!'],
      letter: ['{me} 대장! 오늘 날씨 탐험하기 딱 좋았거든. 섬에서 만나면 인사하자!', '{me} 덕분에 요즘 탐험이 더 재밌어. 고마워!', '{me} 대장, 다음에 만나면 새로 찾은 길 알려 줄게. 기대해!', '오늘 {me} 생각이 나서 편지 썼어. 내일 같이 탐험 가자!', '{me} 대장, 우리 섬에 와 줘서 진짜 좋아. 또 보자!'],
      hit: ['아야! 뭐 하는 거야!', '잠자리채로 치면 어떡해!', '나 곤충 아니거든!'],
      levelUp1: ['이제 {me}도 우리 탐험대 대원이야!'], levelUp2: ['{me}, 우리 이제 친한 탐험 친구거든!'], levelUp3: ['{me} 대장, 이제 우리 단짝이야! 평생 같이 탐험 가자!'],
      mem_errand: ['{when} 「{text}」 도와줘서 고마웠어, {me} 대장!'], mem_errand_short: ['{when} 도와줘서 고마웠어, {me} 대장!'], mem_answer: ['{when} 해 준 이야기, 계속 생각나거든.'], mem_gift: ['{when} 준 {name}, 아직도 기분 좋거든!'],
      answerAgain: ['오늘은 벌써 얘기했거든! 내일 또 해 줘!'], giftAgain: ['오늘은 벌써 선물 받았거든! 마음만 받을게!'], giftAsk: ['나 주는 거야? 뭔데?'], giftNone: ['가방에 줄 만한 게 없네. 괜찮아!'], errandNone: ['오늘은 괜찮아! 마음만 받을게!'], errandYes: ['고마워! 부탁해!'], errandLater: ['괜찮아, 다음에 부탁할게!'], relRival: ['사실 {a|이랑|랑} {b}, 요즘 좀 서먹했거든. 덕분에 화해했어!'], relFriend: ['둘은 오랜 친구라 더 좋아할 거야!'],
    },
  };
  // T2 (검토: 「오 탐정이 바다 할아버지와 같은 하게체 문장이라 ~란 말이지가 없어」): the detective's own register, 하게체 with
  // his case-file talk where it shows
  REG.det = { ...REG.hage,
    why: ['빌려 간 책을 돌려받아야 하거든.', '꼭 할 말이 있는데 행방이 묘연하단 말이지.', '같이 산책하기로 했는데 보이질 않네.', '나눠 줄 게 있는데 어디 숨었는지 모르겠군.'],
    ask_buy: [['오늘 {thing|이|가} 필요한데, 잡화점에 갈 틈이 없단 말이지.', '하나 사다 주게. 물건값은 확실히 치르겠네.']],
    ask_find: [['혹시 {who|을|를} 못 봤나? {why}', '보거든 내가 찾는다고 전해 주게.']],
    ask_deliver: [['이 {thing}, {who}에게 전해 주게.', '내가 지금 잠복 중이란 말이지.']],
    hint: ['{who|은|는} 보통 {where} 근처에 나타난단 말이지.'],
    remind_buy: ['{thing}, 잡화점에 있을 거란 말이지.'], remind_find: ['{who|을|를} 아직 못 찾았나? 섬 어딘가에 숨어 있단 말이지.'],
    remind_find_where: ['{who|을|를} 아직 못 찾았나? 보통 {where} 쪽에 나타난단 말이지.'], remind_deliver: ['{thing}, {who}에게 아직 못 전했나? 서두르게.'],
    got_buy: [['{thing|이|가} 딱 필요했단 말이지! 고맙네.', '물건값에 수고비까지 얹었네.']],
    got_deliver: [['{from|이|가} 보낸 {thing|이라고|라고}? 흠, 고맙네.', '전해 준 사례일세.']],
    found_me: [['{from|이|가} 나를 찾는다고? 흠… 수사에 빠져 깜빡했단 말이지!', '알려 줘서 고맙네. {from}에게 곧 간다고 전해 주게.']],
    found_back: [['{who|을|를} 찾아냈군! 훌륭한 수사란 말이지.', '이건 수고비일세.']],
    giftLike: ['{name}, 고맙네. 잘 쓰겠단 말이지.'], giftMeh: ['{name}… 마음만 받겠단 말이지.'], giftAgain: ['오늘은 이미 증거품… 아니, 선물을 받았단 말이지.'],
    giftAsk: ['흠, 나에게 주는 건가? 무엇이지?'], giftNone: ['가방에 줄 만한 게 없군. 괜찮네.'],
    answerMeh: ['흠, 그것도 일리가 있단 말이지.'], answerDisliked: ['흠… 내 추리와는 다르군. 그래도 들려줘서 고맙네.'], answerAgain: ['오늘 조사는 끝났단 말이지. 내일 또 듣지.'],
    errandNone: ['오늘은 의뢰가 없단 말이지.'], errandYes: ['수락이란 말이지. 부탁하네.'], errandLater: ['괜찮네, 의뢰는 다음에 해도 된단 말이지.'], relRival: ['사실 {a|과|와} {b}, 요즘 서먹했단 말이지. 자네 덕에 사건 해결일세.'], relFriend: ['둘은 오랜 친구란 말이지. 더 기뻐할 걸세.'],
    letter: ['{me}, 오늘 섬은 평화롭단 말이지. 마주치면 인사하게.', '{me} 조수 덕에 요즘 수사가 즐겁단 말이지. 고맙네.', '{me}, 다음에 만나면 새 사건 이야기를 들려주지.', '오늘 수첩을 보다 {me} 이름이 보여서 몇 자 적네.', '{me}, 우리 섬에 와 준 건 행운이란 말이지. 또 보세.'],
    levelUp1: ['흠, 이제 자네와 아는 사이란 말이지.'], levelUp2: ['{me}, 자네를 내 조수로 임명하겠단 말이지.'],
    mem_errand: ['{when} 「{text}」 도와줘서 고마웠네, {me}.'], mem_errand_short: ['{when} 도와줘서 고마웠단 말이지, {me}.'], mem_answer: ['{when} 해 준 이야기, 수첩에 적어 뒀단 말이지.'], mem_gift: ['{when} 준 {name}, 증거품처럼 잘 보관 중이란 말이지.'],
  };
  // T2 (검토: 「심부름 부탁은 해요체 여섯이 본문이 똑같고 끝 말버릇만 달라」): each walker's own word before or after the lines
  // seen most -- an ask (before), thanks for an errand done, an ordinary gift, a level reached (after), a letter (its first
  // line) -- so no two say them alike
  const FLAVOR = [
    { ask: '꽃 배달 사이에 부탁 하나만요!', thanks: '고마운 마음, 꽃 한 송이에 담았어요!', gift: '꽃병 옆에 둘게요!', level: '기념으로 꽃 한 송이 드릴게요!', letter: '꽃집에서 쓰는 편지예요.' }, // 봄이
    { ask: '허허, 늙은 선장 부탁 하나 들어주겠나.', thanks: '허허, 자네는 믿을 만한 선원이구먼.', gift: '선실에 잘 두겠네.', level: '허허, 기분 좋은 날이구먼.', letter: '바닷바람 맞으며 몇 자 적네.' }, // 바다 할아버지
    { ask: '아, 저… 부탁이 하나 있달까요…', thanks: '고마운 마음을 한 줄로 쓰기가 어렵달까요…', gift: '책상 위에 둘게요… 영감이 올 것 같달까요.', level: '오늘 일기에 쓸 거랄까요…', letter: '아, 편지는 처음 써 보는 거랄까요…' }, // 하람
    { ask: '흐음~ 벌들 돌보느라 바빠서요.', thanks: '꿀 한 숟가락만큼 고마워요!', gift: '벌집 옆에 둘게요!', level: '벌들도 축하해요!', letter: '꿀단지 옆에서 쓰는 편지예요.' }, // 두리
    { ask: '얘야, 이 할미 부탁 하나 들어주련?', thanks: '아이고, 착하기도 하지.', gift: '귀하게 쓰마.', level: '오래오래 보자꾸나.', letter: '할미가 몇 자 적는다.' }, // 노을 할머니
    { ask: '흠… 의뢰가 하나 있단 말이지.', thanks: '사건 해결이란 말이지. 훌륭하네.', gift: '증거품처럼 잘 보관하겠단 말이지.', level: '내 수첩에 적어 두겠단 말이지.', letter: '탐정 사무소에서 보내는 편지란 말이지.' }, // 오 탐정
    { ask: '반죽 부풀 동안만 부탁할게요!', thanks: '다음에 갓 구운 빵으로 갚을게요!', gift: '빵 재료로 써 볼까요?', level: '축하 빵 구울게요!', letter: '밀가루 묻은 손으로 써요.' }, // 다온
    { ask: '배달 경로에 하나만 넣어 줄래요?', thanks: '배달보다 빨랐어요!', gift: '가방에 쏙 넣을게요!', level: '섬 지도에 표시해 둘게요!', letter: '이건 제가 직접 배달하는 편지예요!' }, // 바람이
    { ask: '하암… 부탁 하나 해도 돼요?', thanks: '오늘 밤 별한테 자랑할래요.', gift: '망원경 옆에 둘게요.', level: '오늘 밤 별에 소원 빌게요.', letter: '별빛 아래서 쓰는 편지예요.' }, // 이솔
    { ask: '대원! 탐험 임무다!', thanks: '임무 완료! 역시 대원이야!', gift: '탐험 가방에 넣을 거야!', level: '탐험대 만세!', letter: '탐험대장이 보내는 편지!' }, // 가람
  ];
  const FLAVOR_OF = { ask_buy: ['ask', 0], ask_find: ['ask', 0], ask_deliver: ['ask', 0], got_buy: ['thanks', 1], got_deliver: ['thanks', 1], found_back: ['thanks', 1], giftLike: ['gift', 1], levelUp1: ['level', 1], levelUp2: ['level', 1], levelUp3: ['level', 1], letter: ['letter', 0] };
  // by walker: register, the word at the end (tail), and their own lines over the register's (the design's table)
  const VOICES = [
    { reg: 'yo', tail: '꽃!', own: { greet1: ['와아, {me}님 왔다! 오늘도 반가워요.'], greet2: ['{me}님한테 어울리는 꽃을 생각하고 있었어요.'], greet3: ['{me}님! 오늘 제일 예쁜 꽃 드릴게요.'], giftLove: ['와아, {name}! 제가 제일 좋아하는 거예요. 꽃다발보다 좋아요!'], hit: ['아야! 꽃잎 다 떨어지겠어요!'] } }, // 봄이
    { reg: 'hage', own: { greet1: ['허허, {me} 왔구먼. 오늘 바다가 잔잔하다네.'], greet3: ['{me}, 오늘은 바다 얘기 하나 해 주겠네.'], giftLove: ['허허, {name}! 바다 사나이가 제일 좋아하는 걸세. 고맙네.'], hit: ['철썩! …아니, 파도가 아니구먼! 아프다네!'], answerLiked: ['허허, 나도 그렇다네. 바다처럼 마음이 통하는구먼.'] } }, // 바다 할아버지
    { reg: 'yo', own: { greet1: ['아, {me}님… 오늘 문장이 잘 써지는 날이랄까요…'], greet2: ['아, 저… {me}님 생각하면서 한 줄 썼달까요…'], greet3: ['{me}님이 오니까 이야기가 시작되는 느낌이랄까요…'], giftLove: ['아, 저… {name}, 제일 좋아하는 거예요. 소설에 꼭 쓸 거랄까요…'], giftLike: ['{name}… 고마워요. 잘 쓸 거랄까요…'], answerLiked: ['아, 저도요… 우리 꽤 잘 맞는달까요…'], hit: ['아, 아야… 원고 떨어뜨릴 뻔했달까요…'], levelUp1: ['아, 저… 이제 {me}님이랑 아는 사이랄까요…'], levelUp2: ['아, 저… {me}님이랑 많이 가까워졌달까요…'], levelUp3: ['{me}님은 제 이야기의 단짝이랄까요…'] } }, // 하람
    { reg: 'yo', tail: '붕붕', own: { greet1: ['흐음~ {me}님, 꿀처럼 달달한 하루예요.'], greet2: ['{me}님 오니까 벌들이 조용해졌어요.'], giftLove: ['흐음~ {name}! 제가 제일 좋아하는 거예요. 꿀보다 달아요!'], hit: ['아야! 벌들이 놀라겠어요!'] } }, // 두리
    { reg: 'grand', own: { greet1: ['아이고, {me} 왔구나. 밥은 먹었니, 얘야?'], greet2: ['{me|아|야}, 오늘은 다리 건너 쪽으로 걸어 보렴.'], greet3: ['우리 {me} 왔구나! 오늘도 얼굴이 좋구나, 얘야.'], giftLove: ['아이고, {name}! 내가 제일 좋아하는 거란다. 고맙구나, 얘야.'] } }, // 노을 할머니
    { reg: 'det', own: { greet1: ['흠… {me} 군, 여기 무언가 있다는 말이지.'], greet2: ['{me} 조수, 수상한 걸 봤나? 아직 없다는 말이지.'], greet3: ['{me}, 자네가 오면 사건이 풀린다는 말이지.'], giftLove: ['흠… {name}! 이건 내가 제일 좋아하는 거란 말이지. 고맙네.'], hit: ['사건이다! 탐정을 치다니, 이건 폭행 사건이란 말이지!'], answerLiked: ['흠, 나도 그렇다네. 우리 둘은 잘 맞는단 말이지.'], levelUp3: ['{me}, 이제 자네는 내 파트너란 말이지.'] } }, // 오 탐정
    { reg: 'yo', tail: '빵!', own: { greet1: ['{me}님! 오늘도 따끈한 하루예요.'], greet2: ['{me}님, 빵 냄새 나죠? 방금 구웠어요.'], giftLove: ['와, {name}! 제가 제일 좋아하는 거예요. 갓 구운 빵만큼 좋아요!'], hit: ['아야! 반죽 떨어뜨릴 뻔했어요!'] } }, // 다온
    { reg: 'yo', tail: '휙!', own: { greet1: ['{me}님 안녕! 지나갑니다.'], greet2: ['{me}님! 배달 가는 길이에요.'], giftLove: ['와, {name}! 제가 제일 좋아하는 거예요. 가방에 잘 넣을게요!'], hit: ['아야! 편지 떨어져요!'] } }, // 바람이
    { reg: 'yo', tail: '반짝…', own: { greet1: ['하암… {me}님, 오늘 밤엔 별이 많을 거예요.'], greet2: ['{me}님… 하암, 반가워요.'], giftLove: ['와… {name}! 제가 제일 좋아하는 거예요. 별만큼 좋아요.'], hit: ['아야… 잠이 확 깼어요.'] } }, // 이솔
    { reg: 'kid', own: { greet1: ['{me} 대장! 오늘은 저쪽 숲 탐험 가자!'], hit: ['아야! 대장한테 그러면 안 되거든!'] } }, // 가람
  ];
  // the tail once at the end: 「반가워요!」 -> 「반가워요 꽃!」, a question keeps its mark (「걸을래요 꽃?」); short calls go without
  function withTail(text, n) {
    const t = VOICES[n]?.tail; if (!t || String(text).length < 8 || String(text).endsWith(t)) return text;
    const q = /\?\s*$/.test(text); const body = String(text).replace(/[\s.!?~…]+$/, '');
    return q ? `${body} ${t.replace(/[!.…]+$/, '')}?` : `${body} ${t}`;
  }
  // what walker n says for `key` (or keys, said one after another): lines, their vars filled ({me} too when given), the
  // tail at the very end -> [] when n or the key is unknown
  function say(n, key, vars = {}, random = Math.random) {
    const v = VOICES[n]; if (!v) return [];
    const out = [];
    for (const k of [].concat(key)) {
      const alts = [...(v.own?.[k] || []), ...(REG[v.reg][k] || [])]; if (!alts.length) continue;
      const chosen = [].concat(pick(alts, random)); const [group, after] = FLAVOR_OF[k] || []; const own = group && FLAVOR[n]?.[group]; // (T2: their own word with it)
      out.push(...(own ? (after ? [...chosen, own] : [own, ...chosen]) : chosen));
    }
    const filled = out.map((line) => Object.entries(vars).reduce((s, [name, word]) => (word == null ? s : slot(s, name, String(word))), line));
    if (filled.length) filled[filled.length - 1] = withTail(filled[filled.length - 1], n);
    return filled;
  }
  // the tail taken back off the last line (a line said after it carries it instead)
  function untail(lines, n) {
    const t = VOICES[n]?.tail; if (!t || !lines.length) return lines; const last = lines[lines.length - 1]; const w = t.replace(/[!.…]+$/, '');
    const plain = last.endsWith(` ${t}`) ? `${last.slice(0, -t.length - 1)}.` : last.endsWith(` ${w}?`) ? `${last.slice(0, -w.length - 2)}?` : last;
    return [...lines.slice(0, -1), plain];
  }
  const whyOf = (n, k) => REG[VOICES[n]?.reg || 'yo'].why[k] ?? REG.yo.why[k];
  // a walker's line for a talk with nothing to ask, by 호감도 level (sometimes the one for this time of day, or -- A-6 --
  // for what the island has today: `moods`, keys of MOODS)
  function walkerLine(n, random = Math.random, phase = 'day', level = 1, me = '', moods = []) {
    const c = WALKERS[n]; if (!c) return null;
    const mood = moods.filter((k) => MOODS[k]?.[n]);
    if (mood.length && random() < 0.4) return withTail(MOODS[pick(mood, random)][n], n);
    if ((phase === 'morning' || phase === 'night') && c[phase] && random() < 0.3) return withTail(c[phase], n);
    return withTail(fill(pick(c.lines[Math.max(0, Math.min(3, level))], random), me), n);
  }
  function keeperLine(id, random = Math.random, level = 1, me = '') {
    const k = KEEPERS[id === 'photomemory' ? 'photographer' : id]; if (!k) return null;
    return fill(pick(k.lines[Math.max(0, Math.min(3, level))], random), me);
  }
  // A-6 「섬 소문 있어요?」: one thing going on on the island today, from what the server knows -- ctx { weather, night,
  // starSoon, contest: { phase, name, soonDays }, plants, winter, halloween, hint: { n, where } } (hint: where another
  // islander is often seen; the server gives the one my errand is about first)
  function rumor(ctx = {}, random = Math.random) {
    const out = [];
    if (ctx.weather === 'rain') out.push('비가 오면 물고기가 더 잘 문대요. 강가에 가 보세요.');
    if (ctx.weather === 'rainbow') out.push('지금 하늘에 무지개가 떴대요! 금방 사라지니까 얼른 보세요.');
    if (ctx.weather === 'clear') out.push('날이 맑아서 풀밭에 곤충이 많대요. 잠자리채 있어요?');
    if (ctx.starSoon) out.push(ctx.night ? '오늘 밤 별똥별이 떨어질 거래요. 보이면 얼른 소원 빌어요.' : '밤 8시가 넘으면 별똥별이 가끔 떨어진대요. 소원 하나 준비해 둬요.');
    const k = ctx.contest;
    if (k?.phase === 'live') out.push(`지금 「${k.name}」 대회가 한창이래요! 얼른 가 봐요.`);
    else if (k?.phase === 'soon') out.push(`곧 「${k.name}」 대회가 시작한대요!`);
    else if (k?.name && k.soonDays != null && k.soonDays <= 4) out.push(`이번 주말에 「${k.name}」 대회가 열린대요. 연습해 둬요!`);
    if (Number.isFinite(ctx.plants)) out.push(ctx.plants > 0 ? `섬 사람들이 심은 꽃·나무가 벌써 ${ctx.plants}그루래요.` : '잡화점 씨앗을 땅에 심으면 꽃이 핀대요. 아직 아무도 안 심었대요.');
    if (ctx.winter) out.push('광장에 겨울 축제가 열렸대요. 트리 보러 가요!');
    if (ctx.halloween) out.push('할로윈이라 섬 곳곳에 호박이 놓였대요. 꼬마들이 사탕을 찾아다녀요.');
    const h = ctx.hint && WALKERS[ctx.hint.n] ? `${josa(callOf(ctx.hint.n), '은는')} 요즘 ${ctx.hint.where} 근처에서 자주 보인대요.` : null;
    if (h && (ctx.hint.errand || !out.length || random() < 0.35)) return h;
    return out.length ? pick(out, random) : '요즘은 섬이 조용해요. 평화로운 게 제일이죠.';
  }
  const keeperN = (id) => KEEPERS[id === 'photomemory' ? 'photographer' : id]?.n ?? null;
  return { callOf, WALKERS, KEEPERS, LEVELS, GAIN, RELATIONS, relationOf, PHASES, MOODS, CHATS, REG, VOICES, levelOf, walkerLine, rumor, chatLine, keeperLine, keeperN, josa, hasFinal, fill, say, withTail, untail, whyOf };
}));
