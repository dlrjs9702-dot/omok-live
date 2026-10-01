'use strict';

// 팬데믹 기본판의 표준 데이터. IDEAS.md 「팬데믹 기본 규칙」에 값이 정해져 있지 않은 부분(48개 도시의 색·인구·연결선,
// 이벤트 카드 5종 효과, 감염률 트랙 2·2·2·3·3·4·4)은 원작 기본판 표준값을 쓴다(PROJECT_STATUS.md 기록).
// 이 파일은 데이터만 갖는다: 규칙은 pandemic.js.

const COLORS = Object.freeze(['blue', 'yellow', 'black', 'red']);
const COLOR_KO = Object.freeze({ blue: '파랑', yellow: '노랑', black: '검정', red: '빨강' });

// id: [한글 이름, 색, 인구, 위도, 경도, 인접 도시 id들]. 연결은 한쪽에만 적어도 양쪽으로 합쳐진다.
const RAW = {
  atlanta: ['애틀랜타', 'blue', 4715000, 33.7, -84.4, ['chicago', 'washington', 'miami']],
  chicago: ['시카고', 'blue', 9121000, 41.9, -87.6, ['sanfrancisco', 'losangeles', 'mexicocity', 'atlanta', 'montreal']],
  essen: ['에센', 'blue', 575000, 51.5, 7.0, ['london', 'paris', 'milan', 'stpetersburg']],
  london: ['런던', 'blue', 8586000, 51.5, -0.1, ['newyork', 'madrid', 'paris', 'essen']],
  madrid: ['마드리드', 'blue', 5427000, 40.4, -3.7, ['newyork', 'london', 'paris', 'algiers', 'saopaulo']],
  milan: ['밀라노', 'blue', 5232000, 45.5, 9.2, ['paris', 'essen', 'istanbul']],
  montreal: ['몬트리올', 'blue', 3429000, 45.5, -73.6, ['chicago', 'washington', 'newyork']],
  newyork: ['뉴욕', 'blue', 20464000, 40.7, -74.0, ['montreal', 'washington', 'london', 'madrid']],
  paris: ['파리', 'blue', 10755000, 48.9, 2.35, ['london', 'madrid', 'essen', 'milan', 'algiers']],
  sanfrancisco: ['샌프란시스코', 'blue', 5864000, 37.8, -122.4, ['tokyo', 'manila', 'chicago', 'losangeles']],
  stpetersburg: ['상트페테르부르크', 'blue', 4879000, 59.9, 30.3, ['essen', 'istanbul', 'moscow']],
  washington: ['워싱턴', 'blue', 4679000, 38.9, -77.0, ['atlanta', 'montreal', 'newyork', 'miami']],

  bogota: ['보고타', 'yellow', 8702000, 4.7, -74.1, ['miami', 'mexicocity', 'lima', 'saopaulo', 'buenosaires']],
  buenosaires: ['부에노스아이레스', 'yellow', 13639000, -34.6, -58.4, ['bogota', 'saopaulo']],
  johannesburg: ['요하네스버그', 'yellow', 3888000, -26.2, 28.0, ['kinshasa', 'khartoum']],
  khartoum: ['하르툼', 'yellow', 4887000, 15.5, 32.5, ['cairo', 'lagos', 'kinshasa', 'johannesburg']],
  kinshasa: ['킨샤사', 'yellow', 9046000, -4.3, 15.3, ['lagos', 'khartoum', 'johannesburg']],
  lagos: ['라고스', 'yellow', 11547000, 6.5, 3.4, ['saopaulo', 'khartoum', 'kinshasa']],
  lima: ['리마', 'yellow', 9121000, -12.0, -77.0, ['mexicocity', 'bogota', 'santiago']],
  losangeles: ['로스앤젤레스', 'yellow', 14900000, 34.05, -118.2, ['sanfrancisco', 'chicago', 'mexicocity', 'sydney']],
  mexicocity: ['멕시코시티', 'yellow', 19463000, 19.4, -99.1, ['losangeles', 'chicago', 'miami', 'bogota', 'lima']],
  miami: ['마이애미', 'yellow', 5582000, 25.8, -80.2, ['atlanta', 'washington', 'mexicocity', 'bogota']],
  santiago: ['산티아고', 'yellow', 6015000, -33.4, -70.7, ['lima']],
  saopaulo: ['상파울루', 'yellow', 20186000, -23.5, -46.6, ['bogota', 'buenosaires', 'lagos', 'madrid']],

  algiers: ['알제', 'black', 2946000, 36.75, 3.06, ['madrid', 'paris', 'istanbul', 'cairo']],
  baghdad: ['바그다드', 'black', 6204000, 33.3, 44.4, ['istanbul', 'tehran', 'karachi', 'riyadh', 'cairo']],
  cairo: ['카이로', 'black', 14718000, 30.0, 31.2, ['algiers', 'istanbul', 'baghdad', 'riyadh', 'khartoum']],
  chennai: ['첸나이', 'black', 8865000, 13.1, 80.3, ['mumbai', 'delhi', 'kolkata', 'bangkok', 'jakarta']],
  delhi: ['델리', 'black', 22242000, 28.6, 77.2, ['tehran', 'karachi', 'mumbai', 'chennai', 'kolkata']],
  istanbul: ['이스탄불', 'black', 13576000, 41.0, 29.0, ['milan', 'stpetersburg', 'moscow', 'baghdad', 'cairo', 'algiers']],
  karachi: ['카라치', 'black', 20711000, 24.9, 67.0, ['tehran', 'baghdad', 'riyadh', 'mumbai', 'delhi']],
  kolkata: ['콜카타', 'black', 14374000, 22.6, 88.4, ['delhi', 'chennai', 'bangkok', 'hongkong']],
  moscow: ['모스크바', 'black', 15512000, 55.75, 37.6, ['stpetersburg', 'istanbul', 'tehran']],
  mumbai: ['뭄바이', 'black', 16910000, 19.1, 72.9, ['karachi', 'delhi', 'chennai']],
  riyadh: ['리야드', 'black', 5037000, 24.7, 46.7, ['baghdad', 'cairo', 'karachi']],
  tehran: ['테헤란', 'black', 7419000, 35.7, 51.4, ['moscow', 'baghdad', 'karachi', 'delhi']],

  bangkok: ['방콕', 'red', 7151000, 13.75, 100.5, ['kolkata', 'chennai', 'jakarta', 'hochiminh', 'hongkong']],
  beijing: ['베이징', 'red', 17311000, 39.9, 116.4, ['shanghai', 'seoul']],
  hochiminh: ['호치민', 'red', 8314000, 10.8, 106.7, ['jakarta', 'bangkok', 'hongkong', 'manila']],
  hongkong: ['홍콩', 'red', 7106000, 22.3, 114.2, ['kolkata', 'bangkok', 'hochiminh', 'manila', 'taipei', 'shanghai']],
  jakarta: ['자카르타', 'red', 26063000, -6.2, 106.8, ['chennai', 'bangkok', 'hochiminh', 'sydney']],
  manila: ['마닐라', 'red', 20767000, 14.6, 121.0, ['taipei', 'sanfrancisco', 'hochiminh', 'sydney', 'hongkong']],
  osaka: ['오사카', 'red', 2871000, 34.7, 135.5, ['tokyo', 'taipei']],
  seoul: ['서울', 'red', 22547000, 37.6, 127.0, ['beijing', 'shanghai', 'tokyo']],
  shanghai: ['상하이', 'red', 13482000, 31.2, 121.5, ['beijing', 'seoul', 'tokyo', 'taipei', 'hongkong']],
  sydney: ['시드니', 'red', 3785000, -33.9, 151.2, ['jakarta', 'manila', 'losangeles']],
  taipei: ['타이베이', 'red', 8338000, 25.0, 121.5, ['shanghai', 'osaka', 'hongkong', 'manila']],
  tokyo: ['도쿄', 'red', 13189000, 35.7, 139.7, ['seoul', 'shanghai', 'osaka', 'sanfrancisco']],
};

const CITY_IDS = Object.freeze(Object.keys(RAW));
const CITIES = {};
for (const id of CITY_IDS) { const [name, color, population, lat, lon] = RAW[id]; CITIES[id] = { id, name, color, population, lat, lon, links: new Set() }; }
for (const id of CITY_IDS) for (const other of RAW[id][5]) { if (!CITIES[other]) throw new Error(`pandemic-data: unknown city ${other} linked from ${id}`); CITIES[id].links.add(other); CITIES[other].links.add(id); }
for (const id of CITY_IDS) { CITIES[id].links = Object.freeze([...CITIES[id].links].sort()); Object.freeze(CITIES[id]); }
Object.freeze(CITIES);

// Pawns' roles (직업 7종, IDEAS 「직업 7종」).
const ROLES = Object.freeze({
  contingency: { name: '비상 대책 설계자' },
  dispatcher: { name: '운항관리자' },
  medic: { name: '위생병' },
  operations: { name: '건축 전문가' },
  quarantine: { name: '검역 전문가' },
  researcher: { name: '연구자' },
  scientist: { name: '과학자' },
});
const ROLE_IDS = Object.freeze(Object.keys(ROLES));

// Event cards (standard base-game effects; IDEAS lists only that there are 5).
const EVENTS = Object.freeze({
  airlift: { name: '공중 수송', text: '아무 플레이어의 말 하나를 원하는 도시로 옮깁니다(말 주인의 동의 필요).' },
  grant: { name: '정부 보조금', text: '원하는 도시 한 곳에 연구소를 짓습니다(도시 카드 불필요).' },
  quietnight: { name: '조용한 하룻밤', text: '다음 도시 감염 단계를 건너뜁니다.' },
  forecast: { name: '예측', text: '감염 카드 더미 맨 위 6장을 보고 원하는 순서로 되돌려 놓습니다.' },
  resilient: { name: '회복력 있는 인구', text: '감염 카드 버림 더미의 카드 1장을 게임에서 제거합니다.' },
});
const EVENT_IDS = Object.freeze(Object.keys(EVENTS));

// Infection rate track (standard): the rate after 0..6 epidemics.
const INFECTION_RATES = Object.freeze([2, 2, 2, 3, 3, 4, 4]);
const DIFFICULTY = Object.freeze({ intro: { name: '입문', epidemics: 4 }, standard: { name: '표준', epidemics: 5 }, heroic: { name: '영웅', epidemics: 6 } });

module.exports = { COLORS, COLOR_KO, CITIES, CITY_IDS, ROLES, ROLE_IDS, EVENTS, EVENT_IDS, INFECTION_RATES, DIFFICULTY };
