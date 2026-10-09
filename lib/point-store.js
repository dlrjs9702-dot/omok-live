'use strict';

// Game Center points: an in-game virtual currency only (never bought, sold, cashed out or sent
// between users). Every balance change is a ledger row carrying balance before/after, and every
// grant or settlement carries an idempotency key, so a retried request, a duplicate SSE-triggered
// finish or two tabs claiming attendance at once can never move points twice. Balances never go
// below zero: a loser pays at most what they hold and the winner receives exactly what was paid.

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateMatch } = require('./match-records');
const { newDay, applyMatch: applyMissionMatch, rewardKey, dayView, missionById, weekStart, newWeek, applyWeekMatch, weekView } = require('./missions');
const IslandItems = require('./island-items'); // v1.10.10 게임 아일랜드 이벤트 인벤토리
const IslandFishing = require('./island-fishing'); // v1.10.42 도감
const { dailyClimbReward, climbWeekOf, competitionRanking, weeklyPrize } = require('./climb');

// v1.10.35 경제 기준(통합, 사용자 확정 2026-10-06): a new account starts at 0P (it was 100,000P). A store can be given
// another opening balance (the test server keeps 100,000P so its shop tests can buy).
const INITIAL_GRANT = 0;
// v1.10.35: every balance, admins' too, goes to 0P once, when the release that brings the new prices starts. The ledger
// row of each account (reason `economy_reset`, balance before → 0) is the record of what was there. Points owed later
// (a week's climb prize) are still paid when due. A marker keeps it to one time, so later accounts are never touched.
const ECONOMY_RESET = 'economy_reset_2026_10_v1';
const DAILY_ATTENDANCE = 50_000;
// v1.7.3 common game points: a general game's entry fee (per player per game), the share of that
// pool burned (the rest goes to the winners), the share burned from a self-settling game's real
// transfer (Go-Stop), and the admin grant unit/limits.
const ENTRY_FEE = 1_000;
const ENTRY_BURN_PERCENT = 20;
const SETTLEMENT_BURN_PERCENT = 10;
const ADMIN_GRANT_UNIT = 10_000;
const ADMIN_GRANT_MAX = 10_000_000;
const NICKNAME_FEE = 30_000; // v1.10.9 작명소 (IDEAS 「작명소」): one change of nickname; v1.10.35 경제 기준 100,000 → 30,000
const NICKNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000; // and then none for 24 hours
const DONATION_MAX = 1_000_000_000; // v1.10.6: one donation's upper bound (API and store share it)
const ADMIN_GRANT_CATEGORIES = ['event', 'reward', 'correction', 'other'];
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000; // Asia/Seoul has no DST

function kstDate(now = Date.now()) {
  return new Date(Number(now) + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

function validUserId(userId) {
  return typeof userId === 'string' && /^(guest:[0-9a-f-]{36}|admin)$/i.test(userId);
}

function assertUser(userId) {
  if (!validUserId(userId)) throw new TypeError('Invalid point account');
}

function validateSettlement(raw) {
  if (!raw || typeof raw.settlementId !== 'string' || !raw.settlementId || raw.settlementId.length > 200) throw new TypeError('Invalid settlement id');
  if (typeof raw.gameType !== 'string' || !/^[a-z0-9]+$/.test(raw.gameType)) throw new TypeError('Invalid settlement game');
  if (!Array.isArray(raw.transfers)) throw new TypeError('Invalid settlement transfers');
  const transfers = raw.transfers.map((item) => {
    assertUser(item?.from); assertUser(item?.to);
    const amount = Number(item.amount);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError('Invalid settlement amount');
    if (item.from === item.to) throw new TypeError('Self transfer');
    return { from: item.from, to: item.to, amount, key: item.key ? String(item.key).slice(0, 80) : null };
  });
  // `summary` is the engine's own result (score, multipliers, 박) kept with the settlement row; `match`
  // is the finished-match record, written in the same database transaction when the store can.
  let summary = null;
  if (raw.summary !== undefined && raw.summary !== null) {
    const text = JSON.stringify(raw.summary);
    if (typeof raw.summary !== 'object' || text.length > 16_000) throw new TypeError('Invalid settlement summary');
    summary = JSON.parse(text);
  }
  const match = raw.match ? validateMatch(raw.match) : null;
  if (match && raw.matchId && match.id !== String(raw.matchId)) throw new TypeError('Settlement match mismatch');
  const burnPercent = raw.burnPercent === undefined ? 0 : Number(raw.burnPercent);
  if (!Number.isInteger(burnPercent) || burnPercent < 0 || burnPercent >= 100) throw new TypeError('Invalid burn percent');
  return { settlementId: raw.settlementId, matchId: raw.matchId ? String(raw.matchId).slice(0, 200) : null, gameType: raw.gameType, transfers, summary, match, burnPercent };
}

// The winner of a transfer receives the paid amount minus the burned share (floored, so any
// fractional point is burned too). Points are never created: paid = credited + burned.
function creditAfterBurn(paid, burnPercent) {
  return burnPercent ? Math.floor(paid * (100 - burnPercent) / 100) : paid;
}

function validId(raw, prefix) {
  if (typeof raw !== 'string' || !raw.startsWith(prefix) || raw.length > 200) throw new TypeError('Invalid point event id');
  return raw;
}

function validateEntry(raw) {
  const entryId = validId(raw?.entryId, 'game-entry:');
  if (typeof raw.gameType !== 'string' || !/^[a-z0-9]+$/.test(raw.gameType)) throw new TypeError('Invalid entry game');
  const participants = [...new Set(raw.participants || [])];
  participants.forEach(assertUser);
  if (participants.length < 1) throw new TypeError('Invalid entry participants');
  const fee = Number(raw.fee ?? ENTRY_FEE);
  if (!Number.isSafeInteger(fee) || fee <= 0) throw new TypeError('Invalid entry fee');
  return { entryId, gameType: raw.gameType, matchId: raw.matchId ? String(raw.matchId).slice(0, 200) : null, participants, fee };
}

// Pure: splits a finished game's entry pool. The burned part is ENTRY_BURN_PERCENT of the pool plus
// whatever cannot be split evenly among the winners (whole points only).
function entryPayout(entry, winners, burnPercent = ENTRY_BURN_PERCENT) {
  const paidIn = new Set(entry.participants);
  const eligible = [...new Set(winners)].filter(id => paidIn.has(id));
  const reward = Math.floor(entry.pool * (100 - burnPercent) / 100);
  const each = eligible.length ? Math.floor(reward / eligible.length) : 0;
  const paid = each * eligible.length;
  return { winners: eligible, reward, each, paid, burned: entry.pool - paid };
}

function validateGrant(raw) {
  const grantId = validId(raw?.grantId, 'admin-grant:');
  assertUser(raw.userId);
  const amount = Number(raw.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount % ADMIN_GRANT_UNIT !== 0 || amount > ADMIN_GRANT_MAX) throw new RangeError('Invalid grant amount');
  if (!ADMIN_GRANT_CATEGORIES.includes(raw.category)) throw new RangeError('Invalid grant category');
  const memo = typeof raw.memo === 'string' ? raw.memo.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return { grantId, userId: raw.userId, amount, category: raw.category, memo };
}

// v1.7.15 common event reward: one claim per account and event id. The claim id doubles as the ledger
// idempotency key and the settlement id, so two concurrent or repeated requests can only ever pay once.
const EVENT_REWARD_MAX = 10_000_000;

function eventClaimId(eventId, userId) { return `event:${eventId}:${userId}`; }

function validateEventClaim(raw) {
  if (typeof raw?.eventId !== 'string' || !/^[a-z0-9_]{3,60}$/.test(raw.eventId)) throw new RangeError('Invalid event id');
  assertUser(raw.userId);
  const amount = Number(raw.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > EVENT_REWARD_MAX) throw new RangeError('Invalid event reward');
  const title = typeof raw.title === 'string' ? raw.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return { eventId: raw.eventId, userId: raw.userId, amount, title, claimId: eventClaimId(raw.eventId, raw.userId) };
}

// v1.7.16 mission progress input, one per account and finished match (see lib/missions.js).
function validateMissionInput(raw) {
  assertUser(raw?.userId);
  if (typeof raw.matchId !== 'string' || !raw.matchId || raw.matchId.length > 180) throw new TypeError('Invalid match id');
  if (typeof raw.gameType !== 'string' || !/^[a-z0-9]+$/.test(raw.gameType)) throw new TypeError('Invalid game type');
  if (!['win', 'loss', 'draw'].includes(raw.result)) throw new TypeError('Invalid match result');
  const opponents = [...new Set((Array.isArray(raw.opponents) ? raw.opponents : []).filter(validUserId))].filter(id => id !== raw.userId).slice(0, 8);
  return { userId: raw.userId, matchId: raw.matchId, gameType: raw.gameType, result: raw.result, soleWinner: Boolean(raw.soleWinner), clean: Boolean(raw.clean), opponents };
}

function missionSettlement({ claimId, reward, userId, before, after, at }) {
  return { kind: 'mission_reward', settlementId: claimId, gameType: 'mission', at, userId, amount: reward.amount, balanceBefore: before, balanceAfter: after,
    summary: { kind: 'mission_reward', reason: reward.reason, title: reward.title } };
}

const MISSION_KEEP_MS = 8 * 24 * 60 * 60 * 1000; // covers a whole week document (day key `w:<Monday>`)
const missionDayOf = key => key.replace(/^w:/, ''); // sortable date part of a day / week key

// v1.7.17 achievements: one payout per account and achievement id (same claim/idempotency scheme as events).
const ACHIEVEMENT_REWARD_MAX = 50_000;

function achievementClaimId(id, userId) { return `achievement:${id}:${userId}`; }

function validateAchievementGrant(userId, raw) {
  assertUser(userId);
  if (!Array.isArray(raw) || raw.length > 100) throw new TypeError('Invalid achievement list');
  const seen = new Set();
  return raw.map((item) => {
    if (typeof item?.id !== 'string' || !/^[a-z0-9_]{3,60}$/.test(item.id) || seen.has(item.id)) throw new RangeError('Invalid achievement id');
    seen.add(item.id);
    const amount = Number(item.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > ACHIEVEMENT_REWARD_MAX) throw new RangeError('Invalid achievement reward');
    const title = typeof item.title === 'string' ? item.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    return { id: item.id, title, amount, claimId: achievementClaimId(item.id, userId) };
  });
}

function achievementSettlement({ plan, userId, before, after, at }) {
  return { kind: 'achievement_reward', settlementId: plan.claimId, gameType: 'achievement', at, userId, achievementId: plan.id, amount: plan.amount,
    balanceBefore: before, balanceAfter: after, summary: { kind: 'achievement_reward', achievementId: plan.id, title: plan.title } };
}

// v1.7.30 skins: one purchase per account and skin (the claim id is also the ledger idempotency key and settlement
// id), paid in full from the balance (never below zero), owned for good, equipped per game and slot. The catalog
// (which skin exists, its price, which slot it fits) is checked by the server before the store is called.
const SKIN_SLOTS = ['piece', 'theme', 'hair', 'outfit', 'hat', 'title', 'cape', 'tail', 'shoes', 'necklace']; // v1.9.2: avatar slots (lib/skins.js SLOTS); v1.10.32 accessories
const SKIN_PRICE_MAX = 10_000_000;

function skinClaimId(skinId, userId) { return `skin:${skinId}:${userId}`; }

function validateSkinPurchase(raw) {
  assertUser(raw?.userId);
  if (typeof raw.skinId !== 'string' || !/^[a-z0-9_]{3,60}$/.test(raw.skinId)) throw new RangeError('Invalid skin id');
  const price = Number(raw.price);
  if (!Number.isSafeInteger(price) || price <= 0 || price > SKIN_PRICE_MAX) throw new RangeError('Invalid skin price');
  const title = typeof raw.title === 'string' ? raw.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  return { userId: raw.userId, skinId: raw.skinId, price, title, claimId: skinClaimId(raw.skinId, raw.userId) };
}

// v1.10.42 도감: one find of a known entry
function validateDex(raw) {
  assertUser(raw?.userId);
  if (!IslandFishing.DEX_IDS.has(raw.entry)) throw new RangeError('Invalid dex entry');
  return { userId: raw.userId, entry: raw.entry };
}
function validateSkinEquip(raw) {
  assertUser(raw?.userId);
  if (typeof raw.game !== 'string' || !/^[a-z0-9]{2,30}$/.test(raw.game)) throw new RangeError('Invalid skin game');
  if (!SKIN_SLOTS.includes(raw.slot)) throw new RangeError('Invalid skin slot');
  if (raw.skinId !== null && (typeof raw.skinId !== 'string' || !/^[a-z0-9_]{3,60}$/.test(raw.skinId))) throw new RangeError('Invalid skin id');
  return { userId: raw.userId, game: raw.game, slot: raw.slot, skinId: raw.skinId, free: raw.free === true }; // v1.10.42 free: a 도감 title (checked by the server, never owned)
}

// v1.10.30 성형외과·염색사 (IDEAS 「꾸미기 점포 세분화」「염색사」, 사용자 확정 2026-10-05): a paid change of one look
// slot -- a face part (`face_eyes|face_nose|face_mouth` = a design) or the colour of one owned dyeable item
// (`dye_<item id>` = a palette colour; null puts the item's own colour back, which costs the same). Charged per change,
// never kept as an owned item; once per request (a retry returns the first result). Values are checked by the server
// against its catalogue; the store keeps the payment and the slot together.
const LOOK_KINDS = ['surgery', 'dye'];
function validateLook(raw) {
  assertUser(raw?.userId);
  if (typeof raw.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.requestId)) throw new TypeError('Invalid look request');
  if (!LOOK_KINDS.includes(raw.kind)) throw new RangeError('Invalid look kind');
  const slotOk = raw.kind === 'surgery' ? /^face_(eyes|nose|mouth)$/.test(raw.slot) : /^dye_(avatar_[a-z]+_\d{1,2}|base_hair|eyes|skin)$/.test(raw.slot); // v1.10.35: hair, eyes, skin
  if (typeof raw.slot !== 'string' || !slotOk) throw new RangeError('Invalid look slot');
  if (raw.value !== null && (typeof raw.value !== 'string' || !/^[a-z0-9_]{2,40}$/.test(raw.value))) throw new RangeError('Invalid look value');
  if (raw.kind === 'surgery' && raw.value === null) throw new RangeError('A face part needs a design');
  // v1.10.35: a dye back to the own colour is free (경제 기준 통합); everything else costs something
  if (!Number.isSafeInteger(raw.price) || raw.price < (raw.kind === 'dye' && raw.value === null ? 0 : 1)) throw new RangeError('Invalid look price');
  return { userId: raw.userId, requestId: raw.requestId, kind: raw.kind, slot: raw.slot, value: raw.value, price: raw.price, title: String(raw.title || '').slice(0, 40), claimId: `look:${raw.requestId}` };
}
// v1.10.31 잡초 채집·주간 생활활동 (IDEAS 「잡초 채집」「포인트 경제·생활 보상」, 사용자 확정 2026-10-05).
// Weeds: the island's tufts (`w<index>`) and those grown back at 00:00 Asia/Seoul (`g<day>-<n>`); one pulled weed goes
// in the bag once per request and is gone for everyone. The weeds' state is one document (day, pulled ids, grown ones,
// pulled since the last regrowth) -- where new ones grow is the server's (terrain), the store keeps it with the pulls.
// A week (Monday 00:00 Asia/Seoul) of LIFE_WEEK_GOAL server-confirmed life activities (weeds, finds, NPC events) pays
// LIFE_WEEK_BONUS once per account and week.
const LIFE_WEEK_GOAL = 10;
const LIFE_WEEK_BONUS = 50_000;
const WEED_ID = /^(w\d{1,5}|g\d{4,6}-\d{1,5})$/;
function validateWeedPull(raw) {
  assertUser(raw?.userId);
  if (typeof raw.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.requestId)) throw new TypeError('Invalid weed request');
  if (typeof raw.weedId !== 'string' || !WEED_ID.test(raw.weedId)) throw new RangeError('Invalid weed');
  return { userId: raw.userId, requestId: raw.requestId, weedId: raw.weedId, claimId: `weed:${raw.requestId}` };
}
function validateWeedRoll(raw) {
  if (typeof raw?.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) throw new RangeError('Invalid weed day');
  if (!Array.isArray(raw.grown) || raw.grown.some((g) => !WEED_ID.test(g?.id) || !Number.isFinite(g.x) || !Number.isFinite(g.z))) throw new RangeError('Invalid grown weeds');
  return { day: raw.day, grown: raw.grown.map(({ id, x, z }) => ({ id, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 })) };
}
const emptyWeeds = () => ({ day: null, removed: {}, added: [], pulled: 0 });
const weedActive = (state, id) => (id.startsWith('w') ? !state.removed[id] : state.added.some((g) => g.id === id));
// the weeds' state after one pulled: { next } (or null when that weed is not there)
function pullFrom(state, id) {
  if (!weedActive(state, id)) return null;
  const next = { ...state, removed: { ...state.removed }, added: state.added.slice(), pulled: state.pulled + 1 };
  if (id.startsWith('w')) next.removed[id] = true; else next.added = next.added.filter((g) => g.id !== id);
  return next;
}
// a new day: the weeds pulled since the last one grow back where the server chose (once per day)
function rollWeeds(state, plan) {
  if (state.day !== null && plan.day <= state.day) return null;
  return { ...state, day: plan.day, added: state.day === null ? state.added : [...state.added, ...plan.grown], pulled: state.day === null ? state.pulled : 0 };
}
class WeedRefused extends Error {
  constructor(reason, extra = {}) { super(reason); this.reason = reason; this.extra = extra; }
}

class LookRefused extends Error {
  constructor(balance) { super('insufficient'); this.balance = balance; }
}

// v1.10.3 첫 접속 성별: chosen once per account and never changed (kept with the avatar slots as avatar/gender).
const GENDERS = ['male', 'female'];
function validateGender(raw) {
  assertUser(raw?.userId);
  if (!GENDERS.includes(raw.gender)) throw new RangeError('Invalid gender');
  return { userId: raw.userId, gender: raw.gender };
}

// v1.10.5 기부 동상 (IDEAS 「기부 동상」, 사용자 확정 2026-10-03·04): points given at the central plaza are burned at
// once. A week (Monday 00:00 Asia/Seoul) is ranked by its total; the same total is ordered by who reached it first
// (no shared places). When a week is closed its 1st and 2nd become the plaza statues and its 1st holds 「호구왕」 for a week.
function validateDonation(raw) {
  assertUser(raw?.userId);
  if (typeof raw.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.requestId)) throw new TypeError('Invalid donation request');
  if (typeof raw.amount !== 'number' || !Number.isSafeInteger(raw.amount) || raw.amount < 1 || raw.amount > DONATION_MAX) throw new RangeError('Invalid donation amount');
  return { userId: raw.userId, requestId: raw.requestId, amount: raw.amount, name: String(raw.name || '').slice(0, 24), claimId: `donation:${raw.requestId}` };
}
function donationRanking(rows) {
  return rows.filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || String(a.at).localeCompare(String(b.at)) || a.userId.localeCompare(b.userId))
    .map((row, i) => ({ userId: row.userId, name: row.name, total: row.total, at: row.at, rank: i + 1 }));
}
// v1.10.7 게임 아일랜드 당일 위치: the last island spot of an account and the Asia/Seoul day it was taken. Only that
// day's spot is used (the next day starts at the central plaza); the server checks it is somewhere one may stand.
function validatePlazaSpot(raw) {
  assertUser(raw?.userId);
  if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) throw new TypeError('Invalid plaza day');
  if (![raw.x, raw.z].every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000)) throw new RangeError('Invalid plaza spot');
  return { userId: raw.userId, day: raw.day, x: Math.round(raw.x * 100) / 100, z: Math.round(raw.z * 100) / 100 };
}
// v1.10.9 작명소: a paid nickname change, once per request. Format and uniqueness are the server's (it holds every
// nickname); the store keeps the payment, the 24-hour wait and the name it was for, all in one step.
function validateNickname(raw) {
  assertUser(raw?.userId);
  if (typeof raw.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.requestId)) throw new TypeError('Invalid nickname request');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40) throw new RangeError('Invalid nickname');
  return { userId: raw.userId, requestId: raw.requestId, name: raw.name, claimId: `nickname:${raw.requestId}` };
}
// v1.10.10 이벤트 인벤토리: a thing put in a bag (once per claim) and a bag emptied at a place (once per request).
function validateIslandGive(raw) {
  assertUser(raw?.userId);
  if (typeof raw.claimId !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(raw.claimId)) throw new TypeError('Invalid island claim');
  if (!IslandItems.itemDef(raw.itemId)) throw new RangeError('Invalid island item');
  const qty = raw.qty ?? 1;
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > IslandItems.STACK_MAX) throw new RangeError('Invalid island quantity');
  const meta = raw.meta && typeof raw.meta === 'object' ? JSON.parse(JSON.stringify(raw.meta)) : null;
  return { userId: raw.userId, claimId: `island_give:${raw.claimId}`, itemId: raw.itemId, qty, meta, entryId: `${raw.itemId}:${raw.claimId.slice(-12)}` };
}
function validateIslandSell(raw) {
  assertUser(raw?.userId);
  if (typeof raw.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.requestId)) throw new TypeError('Invalid island request');
  if (raw.place !== 'office' && raw.place !== 'merchant' && raw.place !== 'fisher') throw new RangeError('Invalid island place'); // v1.10.42 어부
  const activeLost = Array.isArray(raw.activeLost) ? raw.activeLost.map(String) : null;
  return { userId: raw.userId, place: raw.place, claimId: `island_sell:${raw.requestId}`, activeLost };
}
// v1.10.11 공용 이벤트: points paid at once (a coin, a photo, a returned lost thing), once per event, within the daily limit.
// v1.10.37 지뢰찾기: the server's own numbers for one cleared game
function validateSolo(raw) {
  assertUser(raw?.userId);
  if (typeof raw.gameId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.gameId)) throw new TypeError('Invalid solo game');
  if (raw.game !== 'minesweeper' || !/^[a-z]{3,16}$/.test(raw.level || '')) throw new RangeError('Invalid solo level');
  if (!Number.isSafeInteger(raw.ms) || raw.ms < 0 || !Number.isSafeInteger(raw.points) || raw.points < 0 || raw.points > 100_000) throw new RangeError('Invalid solo result');
  return { userId: raw.userId, claimId: `solo:${raw.gameId}`, game: raw.game, level: raw.level, ms: raw.ms, points: raw.points, title: String(raw.title || '').slice(0, 40) };
}
function validateIslandReward(raw) {
  assertUser(raw?.userId);
  if (typeof raw.claimId !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(raw.claimId)) throw new TypeError('Invalid island claim');
  if (!Number.isSafeInteger(raw.amount) || raw.amount < 1 || raw.amount > 100_000) throw new RangeError('Invalid island reward');
  const take = raw.takeEventId == null ? null : String(raw.takeEventId);
  return { userId: raw.userId, claimId: `island_reward:${raw.claimId}`, amount: raw.amount, title: String(raw.title || '').slice(0, 40), take };
}
class IslandRefused extends Error {
  constructor(reason, extra = {}) { super(reason); this.reason = reason; this.extra = extra; }
}
class NicknameRefused extends Error {
  constructor(reason, extra) { super(reason); this.reason = reason; this.extra = extra; }
}
class DonationInsufficient extends Error {
  constructor(balance) { super('insufficient'); this.balance = balance; }
}

class SkinInsufficient extends Error {
  constructor(balance) { super('Insufficient points for skin'); this.balance = balance; }
}

class InsufficientPoints extends Error {
  constructor(ids) { super('Insufficient points'); this.insufficient = ids; }
}

// Pure: applies each requested transfer in order against the payer's remaining balance.
function capTransfers(transfers, balances) {
  const remaining = new Map(Object.entries(balances).map(([id, value]) => [id, Number(value) || 0]));
  return transfers.map((item) => {
    const available = remaining.get(item.from) || 0;
    const paid = Math.max(0, Math.min(item.amount, available));
    remaining.set(item.from, available - paid);
    remaining.set(item.to, (remaining.get(item.to) || 0) + paid);
    return { ...item, requested: item.amount, paid, capped: paid < item.amount };
  });
}

function ledgerRow({ userId, before, delta, reason, matchId = null, gameType = null, settlementId = null, key = null, at }) {
  return { id: crypto.randomUUID(), userId, at, balanceBefore: before, delta, balanceAfter: before + delta,
    reason, matchId, gameType, settlementId, idempotencyKey: key };
}

function settlementMode(summary) {
  if (summary?.mode === 'matgo' || summary?.mode === 'gostop') return summary.mode;
  if (summary?.kind === 'win' && Array.isArray(summary.losers)) {
    if (summary.losers.length === 1) return 'matgo';
    if (summary.losers.length === 2) return 'gostop';
  }
  if (summary?.kind === 'forfeit') {
    const seats = new Set([...(summary.forfeiting || []), ...(summary.winners || [])].map(String));
    if (seats.size === 2) return 'matgo';
    if (seats.size === 3) return 'gostop';
  }
  return null;
}

function summarizeSettlementRows(rows, limit = 5) {
  const max = Math.max(1, Math.min(20, Number(limit) || 5));
  const grouped = new Map();
  for (const row of rows) {
    if (!row?.settlementId) continue;
    let item = grouped.get(row.settlementId);
    if (!item) {
      item = {
        settlementId: row.settlementId,
        at: row.at,
        gameType: row.gameType,
        mode: settlementMode(row.settlementSummary),
        delta: 0,
        balanceAfter: Number(row.balanceAfter) || 0,
      };
      grouped.set(row.settlementId, item);
    }
    item.delta += Number(row.delta) || 0;
  }
  return [...grouped.values()].slice(0, max);
}


const HISTORY_DEFAULT_LIMIT = 30;
const HISTORY_MAX_LIMIT = 50;

function historyLimit(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return HISTORY_DEFAULT_LIMIT;
  return Math.min(HISTORY_MAX_LIMIT, Math.floor(value));
}

// `before` is the opaque cursor handed out as `nextBefore` (the ledger sequence of the oldest row shown).
function historyCursor(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid history cursor');
  return value;
}

// Only what the lobby needs to explain a row: no ledger/idempotency/account ids, no other player's data.
function historyItem(row, summary, seq) {
  const bonus = summary?.kind === 'bonus';
  if (summary?.kind === 'admin_grant') {
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: summary.category || null, memo: summary.memo || null };
  }
  if (summary?.kind === 'skin_purchase') { // a skin purchase shows the skin's name
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'skin', memo: summary.title || null };
  }
  if (summary?.kind === 'achievement_reward') { // achievements show their own title
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'achievement', memo: summary.title || null };
  }
  if (summary?.kind === 'mission_reward') { // mission / first-win payouts show their own title
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'mission', memo: summary.title || null };
  }
  if (summary?.kind === 'island') { // v1.10.10 게임 아일랜드: where the things were handed in (v1.10.31: or the week's life bonus)
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'island', memo: summary.title || null };
  }
  if (summary?.kind === 'look') { // v1.10.30 성형외과·염색사: what was changed
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'look', memo: summary.title || null };
  }
  if (summary?.kind === 'nickname') { // v1.10.9 작명소: the name it was for
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'nickname', memo: summary.title || null };
  }
  if (summary?.kind === 'donation') { // v1.10.5 기부: which week it counted for
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'donation', memo: summary.title || null };
  }
  if (summary?.kind === 'climb_reward') { // v1.9.4 등반 도전: the altitude the payout was for
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'climb', memo: summary.title || null };
  }
  if (summary?.kind === 'event_reward') { // the event's own name is what the lobby shows
    return { seq, at: row.at, delta: Number(row.delta), balanceBefore: Number(row.balanceBefore), balanceAfter: Number(row.balanceAfter),
      reason: row.reason, gameType: null, mode: null, detail: 'event', memo: summary.title || null };
  }
  return {
    seq,
    at: row.at,
    delta: Number(row.delta),
    balanceBefore: Number(row.balanceBefore),
    balanceAfter: Number(row.balanceAfter),
    reason: row.reason,
    gameType: row.gameType || null,
    mode: row.gameType === 'gostop' ? settlementMode(summary) : null,
    detail: bonus ? summary.reason || null : summary?.kind === 'forfeit' ? 'forfeit' : null,
  };
}

function historyPage(items, limit) {
  const more = items.length > limit;
  const page = more ? items.slice(0, limit) : items;
  return { items: page, hasMore: more, nextBefore: more ? page[page.length - 1].seq : null };
}

// v1.9.4 상시 등반 도전: one finished climb (`climbId`, made by the server when the climb started) is recorded once;
// its altitude is whatever the server's own simulation says, never a client number.
function validateClimbRecord(raw) {
  assertUser(raw?.userId);
  if (typeof raw.climbId !== 'string' || !/^[a-z0-9-]{8,60}$/.test(raw.climbId)) throw new TypeError('Invalid climb id');
  const altitude = Number(raw.altitude);
  if (typeof raw.altitude !== 'number' || !Number.isInteger(altitude) || altitude < 0 || altitude > 3000) throw new RangeError('Invalid altitude');
  return { userId: raw.userId, climbId: raw.climbId, altitude, name: String(raw.name || '').slice(0, 24) };
}
function climbOutcome({ plan, date, week, day, weekBest, delta, balance, at }) {
  return { kind: 'climb_reward', settlementId: `climb_end:${plan.climbId}`, gameType: 'climb', userId: plan.userId, at, amount: delta,
    altitude: plan.altitude, date, week, best: day.best, paid: day.paid, delta, weekBest, balance,
    summary: { kind: 'climb_reward', title: `${plan.altitude.toLocaleString('ko-KR')}m 기록` } };
}

// v1.9.5 주간 등반 랭킹: a closed week's ranking (competition ranking: 1, 1, 3), every player's prize at their rank
// (ties each get the full prize, ranks past 20 nothing) and the week's champions (everyone at rank 1).
function climbWeekPlan(week, rows) {
  const ranking = competitionRanking(rows);
  const payouts = ranking.map((row) => ({ userId: row.userId, name: row.name, rank: row.rank, best: row.best, amount: weeklyPrize(row.rank) })).filter((p) => p.amount > 0);
  return { week, ranking: ranking.slice(0, 50).map(({ userId, name, rank, best }) => ({ userId, name, rank, best })), champions: ranking.filter((row) => row.rank === 1).map((row) => row.userId), payouts };
}
const climbRankSettlement = ({ week, payout, before, after, at }) => ({ kind: 'climb_weekly_rank', settlementId: `climb_rank:${week}:${payout.userId}`, gameType: 'climb', at, userId: payout.userId,
  amount: payout.amount, balanceBefore: before, balanceAfter: after, summary: { kind: 'climb_reward', title: `${week} 주 ${payout.rank}위 · ${payout.best.toLocaleString('ko-KR')}m` } });

class JsonPointStore {
  constructor(filePath, { initialGrant = INITIAL_GRANT } = {}) {
    this.filePath = filePath;
    this.initialGrant = initialGrant;
    this.data = { accounts: {}, ledger: [], keys: {}, settlements: {}, missions: {}, skins: { owned: {}, equipped: {} }, climb: { days: {}, weeks: {} }, donation: { weeks: {} }, plaza: { spots: {} }, nicknames: {}, island: { bags: {}, days: {} }, quests: {}, solo: {} };
    this.queue = Promise.resolve();
    this.cache = new Map();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!data || typeof data.accounts !== 'object' || !Array.isArray(data.ledger)) throw new Error('포인트 저장소 형식이 올바르지 않습니다.');
      this.data = { accounts: data.accounts, ledger: data.ledger, keys: data.keys || {}, settlements: data.settlements || {}, missions: data.missions || {}, skins: data.skins || { owned: {}, equipped: {} }, climb: data.climb || { days: {}, weeks: {} }, donation: data.donation || { weeks: {} }, plaza: data.plaza || { spots: {} }, nicknames: data.nicknames || {}, island: data.island || { bags: {}, days: {} }, quests: data.quests || {}, solo: data.solo || {} };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // never silently reset balances
      await fs.writeFile(this.filePath, JSON.stringify(this.data), { flag: 'wx', mode: 0o600 });
    }
    for (const [id, account] of Object.entries(this.data.accounts)) this.cache.set(id, account.balance);
    await this.resetEconomy();
  }

  // v1.10.35: see ECONOMY_RESET
  async resetEconomy() {
    if (this.data.keys[ECONOMY_RESET]) return { applied: false };
    return this.#mutate((draft, at) => {
      let accounts = 0;
      for (const [userId, account] of Object.entries(draft.accounts)) {
        if (account.balance > 0) {
          draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: -account.balance, reason: 'economy_reset', key: `${ECONOMY_RESET}:${userId}`, at }));
          draft.keys[`${ECONOMY_RESET}:${userId}`] = true;
          account.balance = 0; account.updatedAt = at; accounts += 1;
        }
      }
      draft.keys[ECONOMY_RESET] = true;
      return { changed: true, value: { applied: true, accounts } };
    });
  }

  // One mutation at a time, persisted (temp file + rename) before it is visible in memory.
  #mutate(fn) {
    const run = this.queue.catch(() => {}).then(async () => {
      const draft = structuredClone(this.data);
      const result = fn(draft, new Date().toISOString());
      if (result?.changed === false) return result.value;
      const temp = `${this.filePath}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temp, JSON.stringify(draft), { mode: 0o600 });
        await fs.rename(temp, this.filePath);
      } catch (error) {
        await fs.rm(temp, { force: true }).catch(() => {});
        throw error;
      }
      this.data = draft;
      for (const [id, account] of Object.entries(draft.accounts)) this.cache.set(id, account.balance);
      return result.value;
    });
    this.queue = run;
    return run;
  }

  #ensure(draft, userId, at) {
    if (draft.accounts[userId]) return false;
    draft.accounts[userId] = { balance: this.initialGrant, createdAt: at, updatedAt: at };
    const key = `initial:${userId}`;
    draft.keys[key] = true;
    if (this.initialGrant > 0) draft.ledger.push(ledgerRow({ userId, before: 0, delta: this.initialGrant, reason: 'initial_grant', key, at }));
    return true;
  }

  async ensureAccount(userId) {
    assertUser(userId);
    if (this.data.accounts[userId]) return { balance: this.data.accounts[userId].balance, created: false };
    return this.#mutate((draft, at) => {
      const created = this.#ensure(draft, userId, at);
      return { changed: created, value: { balance: draft.accounts[userId].balance, created } };
    });
  }

  async getAccount(userId, now = Date.now()) {
    const { balance } = await this.ensureAccount(userId);
    await this.queue.catch(() => {});
    const date = kstDate(now);
    return { balance: this.data.accounts[userId]?.balance ?? balance, attendance: { date, claimed: Boolean(this.data.keys[`attendance:${userId}:${date}`]) } };
  }

  async claimAttendance(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const key = `attendance:${userId}:${date}`;
    return this.#mutate((draft, at) => {
      const created = this.#ensure(draft, userId, at);
      if (draft.keys[key]) return { changed: created, value: { granted: false, balance: draft.accounts[userId].balance, date } };
      const account = draft.accounts[userId];
      draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: DAILY_ATTENDANCE, reason: 'daily_attendance', key, at }));
      account.balance += DAILY_ATTENDANCE;
      account.updatedAt = at;
      draft.keys[key] = true;
      return { value: { granted: true, amount: DAILY_ATTENDANCE, balance: account.balance, date } };
    });
  }

  async settle(raw) {
    const plan = validateSettlement(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.settlementId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.settlementId] } };
      for (const item of plan.transfers) { this.#ensure(draft, item.from, at); this.#ensure(draft, item.to, at); }
      const ids = [...new Set(plan.transfers.flatMap(item => [item.from, item.to]))];
      const balances = Object.fromEntries(ids.map(id => [id, draft.accounts[id].balance]));
      const results = capTransfers(plan.transfers, balances).map(item => ({ ...item, credited: creditAfterBurn(item.paid, plan.burnPercent) }))
        .map(item => ({ ...item, burned: item.paid - item.credited }));
      for (const item of results) {
        if (!item.paid) continue;
        for (const [userId, delta, reason] of [[item.from, -item.paid, 'game_loss'], [item.to, item.credited, 'game_win']]) {
          if (!delta) continue;
          const account = draft.accounts[userId];
          draft.ledger.push(ledgerRow({ userId, before: account.balance, delta, reason, matchId: plan.matchId, gameType: plan.gameType, settlementId: plan.settlementId, at }));
          account.balance += delta;
          account.updatedAt = at;
        }
      }
      const record = { settlementId: plan.settlementId, matchId: plan.matchId, gameType: plan.gameType, at, transfers: results, summary: plan.summary,
        burnPercent: plan.burnPercent, burned: results.reduce((sum, item) => sum + item.burned, 0),
        balancesBefore: balances, balances: Object.fromEntries(ids.map(id => [id, draft.accounts[id].balance])) };
      draft.settlements[plan.settlementId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // One game's entry fee from every seated player at once, or from nobody: if anyone is short the
  // whole charge is refused (nothing is written) and the short accounts are reported.
  async chargeEntry(raw) {
    const plan = validateEntry(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.entryId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.entryId] } };
      for (const id of plan.participants) this.#ensure(draft, id, at);
      const balances = Object.fromEntries(plan.participants.map(id => [id, draft.accounts[id].balance]));
      const insufficient = plan.participants.filter(id => balances[id] < plan.fee);
      if (insufficient.length) return { changed: false, value: { applied: false, insufficient } };
      for (const id of plan.participants) {
        const account = draft.accounts[id];
        draft.ledger.push(ledgerRow({ userId: id, before: account.balance, delta: -plan.fee, reason: 'game_entry', matchId: plan.matchId, gameType: plan.gameType, settlementId: plan.entryId, at }));
        account.balance -= plan.fee;
        account.updatedAt = at;
      }
      const record = { kind: 'entry', settlementId: plan.entryId, matchId: plan.matchId, gameType: plan.gameType, at, fee: plan.fee,
        participants: plan.participants, pool: plan.fee * plan.participants.length, closed: null, summary: { kind: 'entry', fee: plan.fee },
        balancesBefore: balances, balances: Object.fromEntries(plan.participants.map(id => [id, draft.accounts[id].balance])) };
      draft.settlements[plan.entryId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // Pays a finished game's pool to its winners (or burns it). Exactly once per entry, and never
  // after the same entry was refunded.
  async settleEntry({ resultId, entryId, winners = [], burnPercent = ENTRY_BURN_PERCENT }) {
    validId(resultId, 'game-result:'); validId(entryId, 'game-entry:');
    const winnerIds = [...new Set(winners)].filter(validUserId);
    return this.#mutate((draft, at) => {
      if (draft.settlements[resultId]) return { changed: false, value: { applied: false, ...draft.settlements[resultId] } };
      const entry = draft.settlements[entryId];
      if (entry?.kind !== 'entry' || entry.closed) return { changed: false, value: { applied: false, closed: entry?.closed || null } };
      const split = entryPayout(entry, winnerIds, burnPercent);
      for (const id of split.winners) {
        if (!split.each) break;
        const account = draft.accounts[id];
        draft.ledger.push(ledgerRow({ userId: id, before: account.balance, delta: split.each, reason: 'game_reward', matchId: entry.matchId, gameType: entry.gameType, settlementId: resultId, at }));
        account.balance += split.each;
        account.updatedAt = at;
      }
      entry.closed = resultId;
      const record = { kind: 'result', settlementId: resultId, entryId, matchId: entry.matchId, gameType: entry.gameType, at, pool: entry.pool,
        burnPercent, ...split, summary: { kind: 'result', pool: entry.pool, each: split.each, burned: split.burned },
        balances: Object.fromEntries(split.winners.map(id => [id, draft.accounts[id].balance])) };
      draft.settlements[resultId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // A game the system could not finish: every paid entry fee goes back, once, unless it was paid out.
  async refundEntry({ refundId, entryId, reason = 'system' }) {
    validId(refundId, 'game-refund:'); validId(entryId, 'game-entry:');
    return this.#mutate((draft, at) => {
      if (draft.settlements[refundId]) return { changed: false, value: { applied: false, ...draft.settlements[refundId] } };
      const entry = draft.settlements[entryId];
      if (entry?.kind !== 'entry' || entry.closed) return { changed: false, value: { applied: false, closed: entry?.closed || null } };
      for (const id of entry.participants) {
        const account = draft.accounts[id];
        draft.ledger.push(ledgerRow({ userId: id, before: account.balance, delta: entry.fee, reason: 'game_refund', matchId: entry.matchId, gameType: entry.gameType, settlementId: refundId, at }));
        account.balance += entry.fee;
        account.updatedAt = at;
      }
      entry.closed = refundId;
      const record = { kind: 'refund', settlementId: refundId, entryId, matchId: entry.matchId, gameType: entry.gameType, at, fee: entry.fee,
        participants: entry.participants, summary: { kind: 'refund', reason: String(reason).slice(0, 40) } };
      draft.settlements[refundId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // Test-only helper (server exposes it under NODE_ENV=test): spend down to `balance`.
  async testSpendTo(userId, balance) {
    assertUser(userId);
    return this.#mutate((draft, at) => {
      this.#ensure(draft, userId, at);
      const account = draft.accounts[userId];
      const target = Math.max(0, Math.min(account.balance, Math.floor(Number(balance) || 0)));
      draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: target - account.balance, reason: 'test_spend', at }));
      account.balance = target;
      return { value: { balance: target } };
    });
  }

  async openEntries() {
    await this.queue.catch(() => {});
    return Object.values(this.data.settlements).filter(item => item.kind === 'entry' && !item.closed).map(item => item.settlementId);
  }

  // Operator grant: whole amount, no burn, recorded with its reason; once per grant id.
  async adminGrant(raw) {
    const plan = validateGrant(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.grantId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.grantId] } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      const before = account.balance;
      draft.ledger.push(ledgerRow({ userId: plan.userId, before, delta: plan.amount, reason: 'admin_grant', settlementId: plan.grantId, key: plan.grantId, at }));
      account.balance += plan.amount;
      account.updatedAt = at;
      const record = { kind: 'admin_grant', settlementId: plan.grantId, gameType: 'admin', at, userId: plan.userId, amount: plan.amount,
        balanceBefore: before, balanceAfter: account.balance, summary: { kind: 'admin_grant', category: plan.category, memo: plan.memo } };
      draft.settlements[plan.grantId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // Event reward: the whole amount, no burn, once per account and event id. The claim record, the ledger
  // row and the balance change are written together (one persisted mutation), never one without the others.
  async claimEvent(raw) {
    const plan = validateEventClaim(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId] } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      const before = account.balance;
      draft.ledger.push(ledgerRow({ userId: plan.userId, before, delta: plan.amount, reason: 'event_reward', settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance += plan.amount;
      account.updatedAt = at;
      const record = { kind: 'event_reward', settlementId: plan.claimId, gameType: 'event', at, userId: plan.userId, eventId: plan.eventId, amount: plan.amount,
        balanceBefore: before, balanceAfter: account.balance, summary: { kind: 'event_reward', eventId: plan.eventId, title: plan.title } };
      draft.settlements[plan.claimId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  // Which of these events this account has already claimed (read-only).
  async claimedEvents(userId, eventIds) {
    assertUser(userId);
    await this.queue.catch(() => {});
    return eventIds.filter(id => this.data.settlements[eventClaimId(id, userId)]);
  }

  // v1.7.16 daily missions. The day document (three missions, counters, what is done) is created on first
  // touch and kept for a week; progress and payouts are written together in one persisted mutation.
  async missions(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const week = weekStart(date);
    const key = `${userId}|${date}`;
    const weekKey = `${userId}|w:${week}`;
    await this.queue.catch(() => {});
    if (!this.data.missions[key] || !this.data.missions[weekKey]) {
      await this.#mutate((draft) => {
        draft.missions ||= {};
        const oldest = kstDate(now - MISSION_KEEP_MS);
        for (const old of Object.keys(draft.missions)) if (old.startsWith(`${userId}|`) && missionDayOf(old.split('|')[1]) < oldest) delete draft.missions[old];
        draft.missions[key] ||= newDay(userId, date);
        draft.missions[weekKey] ||= newWeek(week);
        return { value: null };
      });
    }
    return { ...dayView(this.data.missions[key]), weekly: weekView(this.data.missions[weekKey]) };
  }

  async recordMissionMatch(raw, now = Date.now()) {
    const input = validateMissionInput(raw);
    const date = kstDate(now);
    return this.#mutate((draft, at) => {
      draft.missions ||= {};
      const week = weekStart(date);
      const doc = (draft.missions[`${input.userId}|${date}`] ||= newDay(input.userId, date));
      const weekDoc = (draft.missions[`${input.userId}|w:${week}`] ||= newWeek(week));
      const plan = applyMissionMatch(doc, input, at);
      const weekPlan = applyWeekMatch(weekDoc, input, at);
      if (!plan.changed && !weekPlan.changed) return { changed: false, value: { applied: false, rewards: [], progress: [], view: dayView(doc), weekly: weekView(weekDoc) } };
      this.#ensure(draft, input.userId, at);
      const account = draft.accounts[input.userId];
      const paid = [];
      for (const reward of [...plan.rewards, ...weekPlan.rewards]) {
        const claimId = rewardKey(reward, date, input.userId);
        if (draft.settlements[claimId]) continue; // never pay the same mission/day twice
        const before = account.balance;
        draft.ledger.push(ledgerRow({ userId: input.userId, before, delta: reward.amount, reason: reward.reason, settlementId: claimId, key: claimId, at }));
        account.balance += reward.amount;
        account.updatedAt = at;
        draft.settlements[claimId] = missionSettlement({ claimId, reward, userId: input.userId, before, after: account.balance, at });
        paid.push(reward);
      }
      return { value: { applied: true, rewards: paid, progress: plan.progress, balance: account.balance, view: dayView(doc), weekly: weekView(weekDoc) } };
    });
  }

  // Test-only (NODE_ENV=test): set this week's counters (to reach a weekly target without playing 20 games).
  async testSetWeekly(userId, counters, now = Date.now()) {
    assertUser(userId);
    const week = weekStart(kstDate(now));
    return this.#mutate((draft) => {
      draft.missions ||= {};
      const doc = (draft.missions[`${userId}|w:${week}`] ||= newWeek(week));
      doc.counters = { played: Number(counters.played) || 0, wins: Number(counters.wins) || 0, games: (Array.isArray(counters.games) ? counters.games : []).filter(g => /^[a-z0-9]+$/.test(g)) };
      return { value: weekView(doc) };
    });
  }

  // Test-only (NODE_ENV=test): deal a chosen set of missions for today.
  async testSetMissions(userId, ids, now = Date.now()) {
    assertUser(userId);
    if (!ids.every(id => missionById(id))) throw new RangeError('Unknown mission');
    const date = kstDate(now);
    return this.#mutate((draft) => {
      draft.missions ||= {};
      const doc = (draft.missions[`${userId}|${date}`] ||= newDay(userId, date));
      doc.ids = ids;
      return { value: dayView(doc) };
    });
  }

  // v1.7.17 achievements: pay each not-yet-paid achievement once, all in one persisted mutation.
  async grantAchievements(userId, raw) {
    const plans = validateAchievementGrant(userId, raw);
    return this.#mutate((draft, at) => {
      const fresh = plans.filter(plan => !draft.settlements[plan.claimId]);
      if (!fresh.length) return { changed: false, value: { granted: [], balance: draft.accounts[userId]?.balance ?? null } };
      this.#ensure(draft, userId, at);
      const account = draft.accounts[userId];
      for (const plan of fresh) {
        const before = account.balance;
        draft.ledger.push(ledgerRow({ userId, before, delta: plan.amount, reason: 'achievement', settlementId: plan.claimId, key: plan.claimId, at }));
        account.balance += plan.amount;
        draft.settlements[plan.claimId] = achievementSettlement({ plan, userId, before, after: account.balance, at });
      }
      account.updatedAt = at;
      return { value: { granted: fresh.map(({ id, title, amount }) => ({ id, title, amount })), balance: account.balance } };
    });
  }

  // v1.7.30 skins (see the notes above validateSkinPurchase). One persisted mutation per purchase: the balance,
  // the ledger row, the settlement record and the ownership are written together or not at all.
  async skinState(userId) {
    assertUser(userId);
    await this.queue.catch(() => {});
    return { owned: Object.keys(this.data.skins.owned[userId] || {}), equipped: structuredClone(this.data.skins.equipped[userId] || {}) };
  }

  async buySkin(raw) {
    const plan = validateSkinPurchase(raw);
    return this.#mutate((draft, at) => {
      draft.skins ||= { owned: {}, equipped: {} };
      const owned = (draft.skins.owned[plan.userId] ||= {});
      if (owned[plan.skinId]) return { changed: false, value: { applied: false, reason: 'owned', balance: draft.accounts[plan.userId]?.balance ?? null } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      if (account.balance < plan.price) return { changed: false, value: { applied: false, reason: 'insufficient', balance: account.balance, price: plan.price } };
      const before = account.balance;
      draft.ledger.push(ledgerRow({ userId: plan.userId, before, delta: -plan.price, reason: 'skin_purchase', settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance -= plan.price;
      account.updatedAt = at;
      owned[plan.skinId] = { at, price: plan.price };
      draft.settlements[plan.claimId] = { kind: 'skin_purchase', settlementId: plan.claimId, gameType: 'skin', at, userId: plan.userId, amount: plan.price,
        balanceBefore: before, balanceAfter: account.balance, summary: { kind: 'skin_purchase', skinId: plan.skinId, title: plan.title } };
      return { value: { applied: true, balance: account.balance } };
    });
  }

  // skinId null takes the slot's skin off. Only a skin the account owns can be equipped.
  // v1.10.3: { ok, gender, chosen } -- `chosen` is false when the account had already chosen (that choice stays).
  async setAvatarGender(raw) {
    const plan = validateGender(raw);
    return this.#mutate((draft) => {
      draft.skins ||= { owned: {}, equipped: {} };
      const slots = ((draft.skins.equipped[plan.userId] ||= {}).avatar ||= {});
      if (slots.gender) return { changed: false, value: { ok: true, gender: slots.gender, chosen: false, equipped: structuredClone(draft.skins.equipped[plan.userId]) } };
      slots.gender = plan.gender;
      return { value: { ok: true, gender: plan.gender, chosen: true, equipped: structuredClone(draft.skins.equipped[plan.userId]) } };
    });
  }

  async equipSkin(raw) {
    const plan = validateSkinEquip(raw);
    return this.#mutate((draft) => {
      draft.skins ||= { owned: {}, equipped: {} };
      if (plan.skinId && !plan.free && !draft.skins.owned[plan.userId]?.[plan.skinId]) return { changed: false, value: { ok: false, reason: 'not-owned' } };
      const slots = ((draft.skins.equipped[plan.userId] ||= {})[plan.game] ||= {});
      if (plan.skinId) slots[plan.slot] = plan.skinId; else delete slots[plan.slot];
      return { value: { ok: true, equipped: structuredClone(draft.skins.equipped[plan.userId]) } };
    });
  }

  async grantedAchievements(userId, ids) {
    assertUser(userId);
    await this.queue.catch(() => {});
    return ids.filter(id => this.data.settlements[achievementClaimId(id, userId)]);
  }

  cachedBalance(userId) { return this.cache.has(userId) ? this.cache.get(userId) : null; }

  // v1.9.4 상시 등반 도전 (JSON): today's best and what it has paid, this week's best.
  async climbStatus(userId, now) {
    assertUser(userId);
    await this.queue.catch(() => {});
    const date = kstDate(now); const week = climbWeekOf(now);
    const day = this.data.climb?.days?.[`${userId}|${date}`] || { best: 0, paid: 0 };
    return { date, week, today: { best: day.best, paid: day.paid }, weekBest: this.data.climb?.weeks?.[`${week}|${userId}`]?.best || 0 };
  }

  // Record one finished climb: raise today's best (paying only the difference of the day's total) and this week's best.
  // `now` is the one time captured for this finish; the same climb id is never recorded twice.
  async recordClimb(raw, now) {
    const plan = validateClimbRecord(raw);
    const date = kstDate(now); const week = climbWeekOf(now);
    const endKey = `climb_end:${plan.climbId}`;
    return this.#mutate((draft, at) => {
      draft.climb ||= { days: {}, weeks: {} };
      if (draft.settlements[endKey]) return { changed: false, value: { applied: false, ...draft.settlements[endKey] } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      const day = (draft.climb.days[`${plan.userId}|${date}`] ||= { best: 0, paid: 0 });
      let delta = 0;
      if (plan.altitude > day.best) {
        const total = dailyClimbReward(plan.altitude);
        const key = `climb_daily:${plan.userId}:${date}:${total}`;
        if (total > day.paid && !draft.keys[key]) {
          delta = total - day.paid;
          draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta, reason: 'climb_daily', gameType: 'climb', settlementId: endKey, key, at }));
          account.balance += delta; account.updatedAt = at; draft.keys[key] = true;
        }
        day.best = plan.altitude; day.paid = Math.max(day.paid, total);
      }
      const weekRow = (draft.climb.weeks[`${week}|${plan.userId}`] ||= { userId: plan.userId, best: 0, name: plan.name, at });
      if (plan.altitude > weekRow.best) Object.assign(weekRow, { best: plan.altitude, name: plan.name || weekRow.name, at });
      const outcome = climbOutcome({ plan, date, week, day, weekBest: weekRow.best, delta, balance: account.balance, at });
      draft.settlements[endKey] = outcome;
      return { value: { applied: true, ...outcome } };
    });
  }

  // Everyone's best of a week (name as of their best), for the ranking.
  async climbWeekRows(week) {
    await this.queue.catch(() => {});
    return Object.entries(this.data.climb?.weeks || {}).filter(([key]) => key.startsWith(`${week}|`)).map(([, row]) => ({ ...row }));
  }

  // v1.9.5: weeks that ended and still wait for their ranking prizes.
  async climbUnsettledWeeks(currentWeek) {
    await this.queue.catch(() => {});
    const weeks = new Set(Object.keys(this.data.climb?.weeks || {}).map((key) => key.split('|')[0]));
    return [...weeks].filter((week) => week < currentWeek && !this.data.settlements[`climb_week:${week}`]).sort();
  }

  // Close a week once: pay each ranked player once (ledger key per week and account) and remember the champions.
  async settleClimbWeek(week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week))) throw new RangeError('Invalid week');
    const weekKey = `climb_week:${week}`;
    return this.#mutate((draft, at) => {
      if (draft.settlements[weekKey]) return { changed: false, value: { applied: false, ...draft.settlements[weekKey] } };
      const rows = Object.entries(draft.climb?.weeks || {}).filter(([key]) => key.startsWith(`${week}|`)).map(([, row]) => ({ ...row }));
      const plan = climbWeekPlan(week, rows);
      for (const payout of plan.payouts) {
        const key = `climb_rank:${week}:${payout.userId}`;
        if (draft.keys[key]) continue;
        this.#ensure(draft, payout.userId, at);
        const account = draft.accounts[payout.userId]; const before = account.balance;
        draft.ledger.push(ledgerRow({ userId: payout.userId, before, delta: payout.amount, reason: 'climb_weekly_rank', gameType: 'climb', settlementId: key, key, at }));
        account.balance += payout.amount; account.updatedAt = at; draft.keys[key] = true;
        draft.settlements[key] = climbRankSettlement({ week, payout, before, after: account.balance, at });
      }
      draft.settlements[weekKey] = { kind: 'climb_week', settlementId: weekKey, gameType: 'climb', at, ...plan };
      return { value: { applied: true, ...draft.settlements[weekKey] } };
    });
  }

  // Test-only (NODE_ENV=test): open a settled week again so a retried test can settle it with its own records. The
  // per-account payout keys stay, so nobody is paid twice.
  async testReopenClimbWeek(week) {
    return this.#mutate((draft) => { delete draft.settlements[`climb_week:${week}`]; return { value: true }; });
  }

  // v1.10.5 기부 (JSON): burn the points once per request and add them to this week's total.
  async donate(raw, now) {
    const plan = validateDonation(raw);
    const week = climbWeekOf(now);
    return this.#mutate((draft, at) => {
      draft.donation ||= { weeks: {} };
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId] } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      if (account.balance < plan.amount) return { changed: false, value: { applied: false, reason: 'insufficient', balance: account.balance } };
      draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta: -plan.amount, reason: 'donation', settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance -= plan.amount; account.updatedAt = at;
      const row = (draft.donation.weeks[`${week}|${plan.userId}`] ||= { userId: plan.userId, total: 0, name: plan.name, at });
      Object.assign(row, { total: row.total + plan.amount, name: plan.name || row.name, at });
      const record = { kind: 'donation', settlementId: plan.claimId, gameType: 'donation', at, userId: plan.userId, amount: plan.amount, week, total: row.total,
        balanceBefore: account.balance + plan.amount, balanceAfter: account.balance, summary: { kind: 'donation', title: `${week} 주` } };
      draft.settlements[plan.claimId] = record;
      return { value: { applied: true, ...record, balance: account.balance } };
    });
  }

  // v1.10.30 성형외과·염색사 (JSON): { applied, balance, equipped } or { applied: false, reason: 'insufficient' }.
  async chargeLook(raw) {
    const plan = validateLook(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId] } };
      draft.skins ||= { owned: {}, equipped: {} };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      if (account.balance < plan.price) return { changed: false, value: { applied: false, reason: 'insufficient', balance: account.balance } };
      const before = account.balance;
      if (plan.price > 0) draft.ledger.push(ledgerRow({ userId: plan.userId, before, delta: -plan.price, reason: plan.kind, settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance -= plan.price; account.updatedAt = at;
      const slots = ((draft.skins.equipped[plan.userId] ||= {}).avatar ||= {});
      if (plan.value) slots[plan.slot] = plan.value; else delete slots[plan.slot];
      const record = { kind: 'look', look: plan.kind, settlementId: plan.claimId, gameType: plan.kind, at, userId: plan.userId, slot: plan.slot, value: plan.value,
        balanceBefore: before, balanceAfter: account.balance, summary: { kind: 'look', title: plan.title } };
      draft.settlements[plan.claimId] = record;
      return { value: { applied: true, ...record, balance: account.balance, equipped: structuredClone(draft.skins.equipped[plan.userId]) } };
    });
  }

  // v1.10.9 작명소 (JSON): { applied, changedAt, name } or { applied: false, reason: 'cooldown' (until) | 'insufficient' }.
  async chargeNickname(raw, now) {
    const plan = validateNickname(raw);
    return this.#mutate((draft, at) => {
      draft.nicknames ||= {};
      const previousRequest = draft.settlements[plan.claimId];
      if (previousRequest && (previousRequest.userId !== plan.userId || previousRequest.name !== plan.name)) return { changed: false, value: { applied: false, reason: 'request' } };
      if (previousRequest && !previousRequest.refunded) return { changed: false, value: { applied: false, ...previousRequest } };
      const attempt = (previousRequest?.attempt || (previousRequest ? 1 : 0)) + 1;
      const last = draft.nicknames[plan.userId];
      if (last && now - Date.parse(last.changedAt) < NICKNAME_COOLDOWN_MS) return { changed: false, value: { applied: false, reason: 'cooldown', until: new Date(Date.parse(last.changedAt) + NICKNAME_COOLDOWN_MS).toISOString() } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      if (account.balance < NICKNAME_FEE) return { changed: false, value: { applied: false, reason: 'insufficient', balance: account.balance } };
      draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta: -NICKNAME_FEE, reason: 'nickname', settlementId: plan.claimId, key: attempt === 1 ? plan.claimId : `${plan.claimId}:charge:${attempt}`, at }));
      account.balance -= NICKNAME_FEE; account.updatedAt = at;
      const changedAt = new Date(now).toISOString();
      const record = { kind: 'nickname', settlementId: plan.claimId, gameType: 'nickname', at, userId: plan.userId, name: plan.name, changedAt, previous: last || null, attempt, pending: true,
        balanceBefore: account.balance + NICKNAME_FEE, balanceAfter: account.balance, summary: { kind: 'nickname', title: plan.name } };
      draft.settlements[plan.claimId] = record;
      draft.nicknames[plan.userId] = { changedAt, name: plan.name };
      return { value: { applied: true, ...record, balance: account.balance } };
    });
  }

  // The change could not be finished (the nickname was not saved): the points and the previous wait come back.
  async refundNickname(raw) {
    const plan = validateNickname(raw);
    return this.#mutate((draft, at) => {
      const record = draft.settlements[plan.claimId];
      if (!record || record.refunded || record.userId !== plan.userId) return { changed: false, value: false };
      const account = draft.accounts[plan.userId];
      draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta: NICKNAME_FEE, reason: 'nickname_refund', settlementId: plan.claimId, key: (record.attempt || 1) === 1 ? `${plan.claimId}:refund` : `${plan.claimId}:refund:${record.attempt}`, at }));
      account.balance += NICKNAME_FEE; account.updatedAt = at;
      record.refunded = true; record.pending = false;
      if (record.previous) draft.nicknames[plan.userId] = record.previous; else delete draft.nicknames[plan.userId];
      return { value: true };
    });
  }

  async completeNickname(raw) {
    const plan = validateNickname(raw);
    return this.#mutate(draft => {
      const record = draft.settlements[plan.claimId];
      if (!record || record.refunded || record.userId !== plan.userId || record.name !== plan.name) return { changed: false, value: false };
      if (!record.pending) return { changed: false, value: true };
      record.pending = false;
      return { value: true };
    });
  }

  async pendingNicknameRequests() {
    await this.queue.catch(() => {});
    return Object.values(this.data.settlements).filter(r => r.kind === 'nickname' && r.pending === true && !r.refunded).map(r => ({ ...r }));
  }

  async nicknameRequest(requestId) {
    await this.queue.catch(() => {});
    const record = this.data.settlements[`nickname:${requestId}`];
    return record && !record.refunded ? { ...record } : null;
  }

  async nicknameState(userId) {
    assertUser(userId);
    await this.queue.catch(() => {});
    const last = this.data.nicknames?.[userId];
    return last ? { changedAt: last.changedAt, until: new Date(Date.parse(last.changedAt) + NICKNAME_COOLDOWN_MS).toISOString() } : null;
  }

  // v1.10.31 주간 생활활동 (JSON): one more completed activity this week; the bonus at the goal, once (its points).
  #lifeActivity(draft, userId, now, at) {
    const week = weekStart(kstDate(now)); const key = `${week}|${userId}`;
    draft.island.weeks ||= {};
    const w = (draft.island.weeks[key] ||= { count: 0, paid: false });
    w.count += 1;
    if (w.count < LIFE_WEEK_GOAL || w.paid) return 0;
    w.paid = true;
    this.#ensure(draft, userId, at);
    const account = draft.accounts[userId]; const claimId = `islandweek:${week}:${userId}`;
    draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: LIFE_WEEK_BONUS, reason: 'island_week_bonus', settlementId: claimId, key: claimId, at }));
    account.balance += LIFE_WEEK_BONUS; account.updatedAt = at;
    draft.settlements[claimId] = { kind: 'island_week_bonus', settlementId: claimId, at, userId, amount: LIFE_WEEK_BONUS, week,
      balanceBefore: account.balance - LIFE_WEEK_BONUS, balanceAfter: account.balance, summary: { kind: 'island', title: `주간 생활활동 ${LIFE_WEEK_GOAL}회` } };
    return LIFE_WEEK_BONUS;
  }

  async islandWeek(userId, now) {
    assertUser(userId);
    await this.queue.catch(() => {});
    const w = this.data.island?.weeks?.[`${weekStart(kstDate(now))}|${userId}`];
    return { count: w?.count || 0, goal: LIFE_WEEK_GOAL, bonus: LIFE_WEEK_BONUS, paid: Boolean(w?.paid) };
  }

  // v1.10.31 잡초 (JSON)
  async islandWeeds() {
    await this.queue.catch(() => {});
    return structuredClone(this.data.island?.weeds || emptyWeeds());
  }

  async islandWeedRoll(raw) {
    const plan = validateWeedRoll(raw);
    return this.#mutate((draft) => {
      draft.island ||= { bags: {}, days: {} };
      const next = rollWeeds(draft.island.weeds || emptyWeeds(), plan);
      if (!next) return { changed: false, value: structuredClone(draft.island.weeds) };
      draft.island.weeds = next;
      return { value: structuredClone(next) };
    });
  }

  async islandPullWeed(raw, now) {
    const plan = validateWeedPull(raw);
    return this.#mutate((draft, at) => {
      draft.island ||= { bags: {}, days: {} };
      const bag = draft.island.bags[plan.userId] || [];
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId], bag: IslandItems.bagView(bag) } };
      const next = pullFrom(draft.island.weeds || emptyWeeds(), plan.weedId);
      if (!next) return { changed: false, value: { applied: false, reason: 'gone', bag: IslandItems.bagView(bag) } };
      const filled = IslandItems.addToBag(bag, 'weed', 1, 'weed');
      if (!filled) return { changed: false, value: { applied: false, reason: 'full', bag: IslandItems.bagView(bag) } };
      draft.island.weeds = next; draft.island.bags[plan.userId] = filled;
      const bonus = this.#lifeActivity(draft, plan.userId, now, at);
      draft.settlements[plan.claimId] = { kind: 'island_weed', settlementId: plan.claimId, at, userId: plan.userId, weedId: plan.weedId };
      return { value: { applied: true, weedId: plan.weedId, bonus, bag: IslandItems.bagView(filled), balance: draft.accounts[plan.userId]?.balance ?? null } };
    });
  }

  // v1.10.10 이벤트 인벤토리 (JSON) ----------------------------------------------------------------------------
  async islandBag(userId) {
    assertUser(userId);
    await this.queue.catch(() => {});
    return IslandItems.bagView(structuredClone(this.data.island?.bags?.[userId] || []));
  }

  // Put something in a bag, once per claim: { applied, bag } or { applied: false, reason: 'full' }.
  async islandGive(raw, now = Date.now()) {
    const plan = validateIslandGive(raw);
    return this.#mutate((draft, at) => {
      draft.island ||= { bags: {}, days: {} };
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId], bag: IslandItems.bagView(draft.island.bags[plan.userId] || []) } };
      const next = IslandItems.addToBag(draft.island.bags[plan.userId] || [], plan.itemId, plan.qty, plan.entryId, plan.meta);
      if (!next) return { changed: false, value: { applied: false, reason: 'full', bag: IslandItems.bagView(draft.island.bags[plan.userId] || []) } };
      draft.island.bags[plan.userId] = next;
      // v1.10.31: a find counts as a life activity (a lost thing counts once, when it is given back: islandReward)
      const bonus = plan.itemId === 'lost' ? 0 : this.#lifeActivity(draft, plan.userId, now, at);
      draft.settlements[plan.claimId] = { kind: 'island_give', settlementId: plan.claimId, at, userId: plan.userId, itemId: plan.itemId, qty: plan.qty };
      return { value: { applied: true, bonus, bag: IslandItems.bagView(next) } };
    });
  }

  // Hand in everything a place takes (as far as today's limit allows), once per request.
  async islandSell(raw, now) {
    const plan = validateIslandSell(raw);
    const day = kstDate(now);
    return this.#mutate((draft, at) => {
      draft.island ||= { bags: {}, days: {} };
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId], bag: IslandItems.bagView(draft.island.bags[plan.userId] || []) } };
      const earned = draft.island.days[`${day}|${plan.userId}`] || 0;
      const result = IslandItems.sellAt(draft.island.bags[plan.userId] || [], plan.place, earned, plan.activeLost, now);
      if (!result.paid) return { changed: false, value: { applied: false, reason: result.capped ? 'cap' : 'nothing', bag: IslandItems.bagView(draft.island.bags[plan.userId] || []) } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta: result.paid, reason: 'island_sale', settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance += result.paid; account.updatedAt = at;
      draft.island.bags[plan.userId] = result.keep;
      draft.island.days[`${day}|${plan.userId}`] = earned + result.paid - result.uncappedPaid; // v1.10.31: weeds are outside the daily limit
      const record = { kind: 'island_sale', settlementId: plan.claimId, at, userId: plan.userId, place: plan.place, paid: result.paid, sold: result.sold, capped: result.capped,
        balanceBefore: account.balance - result.paid, balanceAfter: account.balance, summary: { kind: 'island', title: `${IslandItems.PLACES[plan.place]} ${plan.place === 'office' ? '정산' : '판매'}` } };
      draft.settlements[plan.claimId] = record;
      return { value: { applied: true, ...record, balance: account.balance, bag: IslandItems.bagView(result.keep) } };
    });
  }

  // Points for an event, once per claim, within today's limit; `take` also removes the lost thing of that event from the
  // bag (returning it to its owner) -- the reward only when it is there.
  // v1.10.37 연계 퀘스트: one account's quest document for a week, changed by `fn(doc, bag)` (lib/island-quests.js talk /
  // note) in one step with what it pays (reason `quest`, once per key) and what it takes from the bag
  async questApply(userId, week, fn) {
    assertUser(userId);
    return this.#mutate((draft, at) => {
      draft.quests ||= {};
      const key = `${userId}|${week}`; const doc = draft.quests[key] || {};
      const bag = draft.island?.bags?.[userId] || [];
      const out = fn(doc, bag);
      if (!out || out.error || out.doc === doc) return { changed: false, value: out || null };
      let keep = bag;
      if (out.take) { keep = IslandItems.takeFromBag(bag, out.take.itemId, out.take.qty); if (!keep) return { changed: false, value: { error: 'MISSING' } }; }
      this.#ensure(draft, userId, at);
      const account = draft.accounts[userId];
      if (out.reward > 0) {
        if (draft.keys[out.payKey]) return { changed: false, value: { error: 'PAID' } };
        draft.keys[out.payKey] = true;
        draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: out.reward, reason: 'quest', key: out.payKey, at }));
        account.balance += out.reward; account.updatedAt = at;
      }
      (draft.island ||= { bags: {}, days: {} }).bags[userId] = keep;
      draft.quests[key] = out.doc;
      return { value: { ...out, balance: account.balance, bag: IslandItems.bagView(keep) } };
    });
  }
  async questDoc(userId, week) {
    await this.queue.catch(() => {});
    return { doc: this.data.quests?.[`${userId}|${week}`] || {}, bag: this.data.island?.bags?.[userId] || [] };
  }

  // v1.10.37 지뢰찾기: a cleared board -- its points (reason `solo_game`, once per game) and the best time and clears per
  // level; a clear worth nothing (too fast to trust) still counts as a clear and a time
  async soloClear(raw) {
    const plan = validateSolo(raw);
    return this.#mutate((draft, at) => {
      draft.solo ||= {};
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId] } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId]; const before = account.balance;
      if (plan.points > 0) {
        draft.ledger.push(ledgerRow({ userId: plan.userId, before, delta: plan.points, reason: 'solo_game', settlementId: plan.claimId, key: plan.claimId, at }));
        account.balance += plan.points; account.updatedAt = at;
      }
      const rec = (draft.solo[`${plan.userId}|${plan.game}|${plan.level}`] ||= { best: null, clears: 0 });
      const newBest = rec.best === null || plan.ms < rec.best; if (newBest) rec.best = plan.ms; rec.clears += 1;
      const record = { kind: 'solo', settlementId: plan.claimId, at, userId: plan.userId, game: plan.game, level: plan.level, ms: plan.ms, points: plan.points,
        balanceBefore: before, balanceAfter: account.balance, best: rec.best, clears: rec.clears, newBest, summary: { kind: 'solo', title: plan.title } };
      draft.settlements[plan.claimId] = record;
      return { value: { applied: true, ...record, balance: account.balance } };
    });
  }
  // v1.10.42 도감: an account's finds (an entry id from lib/island-fishing.js DEX) -- how many and since when
  async dexNote(raw) {
    const plan = validateDex(raw);
    return this.#mutate((draft, at) => {
      draft.dex ||= {};
      const rec = (draft.dex[`${plan.userId}|${plan.entry}`] ||= { count: 0, first: typeof at === 'number' ? at : Date.parse(at) || Date.now() }); rec.count += 1; // epoch ms, as PostgreSQL keeps it
      return { value: { entry: plan.entry, count: rec.count, first: rec.count === 1 } };
    });
  }
  async dexOf(userId) {
    await this.queue.catch(() => {});
    const out = {};
    for (const [key, rec] of Object.entries(this.data.dex || {})) { const [u, entry] = key.split('|'); if (u === userId) out[entry] = { ...rec }; }
    return out;
  }
  async soloRecords(userId) {
    await this.queue.catch(() => {});
    const out = {};
    for (const [key, rec] of Object.entries(this.data.solo || {})) { const [u, game, level] = key.split('|'); if (u === userId) (out[game] ||= {})[level] = { ...rec }; }
    return out;
  }

  async islandReward(raw, now) {
    const plan = validateIslandReward(raw);
    const day = kstDate(now);
    return this.#mutate((draft, at) => {
      draft.island ||= { bags: {}, days: {} };
      if (draft.settlements[plan.claimId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.claimId] } };
      const bag = draft.island.bags[plan.userId] || [];
      const keep = plan.take ? bag.filter((e) => !(e.itemId === 'lost' && e.meta?.eventId === plan.take)) : bag;
      if (plan.take && keep.length === bag.length) return { changed: false, value: { applied: false, reason: 'missing' } };
      const earned = draft.island.days[`${day}|${plan.userId}`] || 0;
      if (earned + plan.amount > IslandItems.DAILY_CAP) return { changed: false, value: { applied: false, reason: 'cap' } };
      this.#ensure(draft, plan.userId, at);
      const account = draft.accounts[plan.userId];
      draft.ledger.push(ledgerRow({ userId: plan.userId, before: account.balance, delta: plan.amount, reason: 'island_reward', settlementId: plan.claimId, key: plan.claimId, at }));
      account.balance += plan.amount; account.updatedAt = at;
      draft.island.bags[plan.userId] = keep;
      draft.island.days[`${day}|${plan.userId}`] = earned + plan.amount;
      const record = { kind: 'island_reward', settlementId: plan.claimId, at, userId: plan.userId, amount: plan.amount,
        balanceBefore: account.balance - plan.amount, balanceAfter: account.balance, summary: { kind: 'island', title: plan.title } };
      draft.settlements[plan.claimId] = record;
      const bonus = this.#lifeActivity(draft, plan.userId, now, at); // v1.10.31
      return { value: { applied: true, ...record, bonus, balance: draft.accounts[plan.userId].balance, bag: IslandItems.bagView(keep) } };
    });
  }

  // Test-only (NODE_ENV=test): empty a bag.
  async testClearIsland(userId) {
    return this.#mutate((draft) => { draft.island ||= { bags: {}, days: {} }; delete draft.island.bags[userId]; for (const key of Object.keys(draft.island.days)) if (key.endsWith(`|${userId}`)) delete draft.island.days[key]; for (const key of Object.keys(draft.island.weeks || {})) if (key.endsWith(`|${userId}`)) delete draft.island.weeks[key]; return { value: true }; });
  }

  // v1.10.7 당일 위치 (JSON): one write for every spot that changed since the last save.
  async savePlazaSpots(list) {
    const plans = list.map(validatePlazaSpot);
    if (!plans.length) return 0;
    return this.#mutate((draft) => {
      draft.plaza ||= { spots: {} };
      for (const p of plans) draft.plaza.spots[p.userId] = { day: p.day, x: p.x, z: p.z };
      return { value: plans.length };
    });
  }

  async plazaSpot(userId) {
    assertUser(userId);
    await this.queue.catch(() => {});
    const spot = this.data.plaza?.spots?.[userId];
    return spot ? { ...spot } : null;
  }

  async donationWeekRows(week) {
    await this.queue.catch(() => {});
    return Object.entries(this.data.donation?.weeks || {}).filter(([key]) => key.startsWith(`${week}|`)).map(([, row]) => ({ ...row }));
  }

  async donationUnsettledWeeks(currentWeek) {
    await this.queue.catch(() => {});
    const weeks = new Set(Object.keys(this.data.donation?.weeks || {}).map((key) => key.split('|')[0]));
    return [...weeks].filter((week) => week < currentWeek && !this.data.settlements[`donation_week:${week}`]).sort();
  }

  // Close a week once. `statues` are the server's snapshot of the top two (rank, name, look) taken when it closed.
  async settleDonationWeek(week, statues) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week))) throw new RangeError('Invalid week');
    const weekKey = `donation_week:${week}`;
    return this.#mutate((draft, at) => {
      if (draft.settlements[weekKey]) return { changed: false, value: { applied: false, ...draft.settlements[weekKey] } };
      const ranking = donationRanking(Object.entries(draft.donation?.weeks || {}).filter(([key]) => key.startsWith(`${week}|`)).map(([, row]) => ({ ...row })));
      const result = { kind: 'donation_week', settlementId: weekKey, gameType: 'donation', at, week, hoguking: ranking[0]?.userId || null,
        ranking: ranking.slice(0, 10).map(({ userId, name, total, rank }) => ({ userId, name, total, rank })), statues: statues || [] };
      draft.settlements[weekKey] = result;
      return { value: { applied: true, ...result } };
    });
  }

  async testReopenDonationWeek(week) {
    return this.#mutate((draft) => { delete draft.settlements[`donation_week:${week}`]; return { value: true }; });
  }

  async donationWeekResult(week) {
    await this.queue.catch(() => {});
    const result = this.data.settlements[`donation_week:${week}`];
    return result ? structuredClone({ week, hoguking: result.hoguking, ranking: result.ranking, statues: result.statues }) : null;
  }

  // The champions of a closed week (empty until it is settled).
  async climbWeekResult(week) {
    await this.queue.catch(() => {});
    const result = this.data.settlements[`climb_week:${week}`];
    return result ? { week, champions: [...result.champions], ranking: result.ranking.map((row) => ({ ...row })) } : null;
  }

  async ledger(userId, limit = 50) {
    await this.queue.catch(() => {});
    return this.data.ledger.filter(row => row.userId === userId).slice(-limit).reverse();
  }

  // Read-only: newest first, `limit` rows per page, continued with the `nextBefore` cursor.
  async history(userId, { limit, before } = {}) {
    assertUser(userId);
    const max = historyLimit(limit);
    const cursor = historyCursor(before);
    await this.queue.catch(() => {});
    const items = [];
    const rows = this.data.ledger;
    for (let index = (cursor ? Math.min(cursor - 1, rows.length) : rows.length) - 1; index >= 0 && items.length <= max; index -= 1) {
      const row = rows[index];
      if (row.userId !== userId) continue;
      items.push(historyItem(row, row.settlementId ? this.data.settlements[row.settlementId]?.summary : null, index + 1));
    }
    return historyPage(items, max);
  }

  async recentSettlements(userId, gameType = 'gostop', limit = 5) {
    assertUser(userId);
    await this.queue.catch(() => {});
    const rows = this.data.ledger
      .filter(row => row.userId === userId && row.gameType === gameType && row.settlementId)
      .slice().reverse()
      .map((row) => {
        const settlement = this.data.settlements[row.settlementId] || null;
        return {
          ...row,
          balanceAfter: Number(settlement?.balances?.[userId] ?? row.balanceAfter),
          settlementSummary: settlement?.summary || null,
        };
      });
    return summarizeSettlementRows(rows, limit);
  }
}

class PostgresPointStore {
  constructor(connectionString, { initialGrant = INITIAL_GRANT } = {}) {
    this.initialGrant = initialGrant;
    const { Pool } = require('pg');
    const ssl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false, max: 3 });
    this.cache = new Map();
  }

  // Additive, idempotent migration: new tables only; nothing existing is altered or dropped.
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_accounts (
      user_id text PRIMARY KEY,
      balance bigint NOT NULL CHECK (balance >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_ledger (
      id uuid PRIMARY KEY,
      user_id text NOT NULL REFERENCES point_accounts(user_id),
      created_at timestamptz NOT NULL DEFAULT now(),
      balance_before bigint NOT NULL CHECK (balance_before >= 0),
      delta bigint NOT NULL,
      balance_after bigint NOT NULL CHECK (balance_after >= 0),
      reason text NOT NULL,
      match_id text,
      game_type text,
      settlement_id text,
      idempotency_key text UNIQUE,
      CHECK (balance_after = balance_before + delta)
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS point_ledger_user_idx ON point_ledger (user_id, created_at)');
    // v1.7.0: insertion order for the lobby history. Rows of one settlement share created_at (transaction
    // time), so paging needs a real sequence. Additive: existing rows are backfilled, nothing is rewritten.
    await this.pool.query('ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS seq bigserial');
    await this.pool.query('CREATE INDEX IF NOT EXISTS point_ledger_user_seq_idx ON point_ledger (user_id, seq DESC)');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_settlements (
      settlement_id text PRIMARY KEY,
      match_id text,
      game_type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      result jsonb NOT NULL
    )`);
    // v1.7.30 skins: what an account owns (once, for good) and what it has equipped per game and slot.
    await this.pool.query(`CREATE TABLE IF NOT EXISTS skin_owned (
      user_id text NOT NULL,
      skin_id text NOT NULL,
      price bigint NOT NULL,
      acquired_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, skin_id)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS skin_equipped (
      user_id text NOT NULL,
      game text NOT NULL,
      slot text NOT NULL,
      skin_id text NOT NULL,
      PRIMARY KEY (user_id, game, slot)
    )`);
    // v1.9.4 상시 등반 도전: a day's best and what it paid, a week's best per account.
    await this.pool.query(`CREATE TABLE IF NOT EXISTS climb_days (
      user_id text NOT NULL,
      day text NOT NULL,
      best integer NOT NULL CHECK (best BETWEEN 0 AND 3000),
      paid bigint NOT NULL CHECK (paid >= 0),
      PRIMARY KEY (user_id, day)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS climb_weeks (
      week text NOT NULL,
      user_id text NOT NULL,
      best integer NOT NULL CHECK (best BETWEEN 0 AND 3000),
      name text NOT NULL DEFAULT '',
      reached_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (week, user_id)
    )`);
    // v1.10.5 기부 동상: each account's total of a week and when it reached that total (earlier wins a tie).
    await this.pool.query(`CREATE TABLE IF NOT EXISTS donation_weeks (
      week text NOT NULL,
      user_id text NOT NULL,
      total bigint NOT NULL CHECK (total >= 0),
      name text NOT NULL DEFAULT '',
      reached_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (week, user_id)
    )`);
    // v1.10.7 게임 아일랜드 당일 위치: the last island spot of each account and its Asia/Seoul day (one row per account).
    await this.pool.query(`CREATE TABLE IF NOT EXISTS plaza_spots (
      user_id text PRIMARY KEY,
      day text NOT NULL,
      x real NOT NULL,
      z real NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    // v1.10.10 이벤트 인벤토리: what each account carries (one row per stack or unique item) and what the island paid it
    // each Asia/Seoul day (the daily limit).
    await this.pool.query(`CREATE TABLE IF NOT EXISTS island_bags (
      user_id text NOT NULL,
      entry_id text NOT NULL,
      item_id text NOT NULL,
      qty integer NOT NULL CHECK (qty > 0),
      meta jsonb,
      PRIMARY KEY (user_id, entry_id)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS island_days (
      user_id text NOT NULL,
      day text NOT NULL,
      earned bigint NOT NULL CHECK (earned >= 0),
      PRIMARY KEY (user_id, day)
    )`);
    // v1.10.31 잡초 채집·주간 생활활동: the weeds' one state document, and each account's life activities per week
    await this.pool.query(`CREATE TABLE IF NOT EXISTS island_world (
      key text PRIMARY KEY,
      value jsonb NOT NULL
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS island_weeks (
      user_id text NOT NULL,
      week text NOT NULL,
      count integer NOT NULL CHECK (count >= 0),
      paid boolean NOT NULL DEFAULT false,
      PRIMARY KEY (user_id, week)
    )`);
    // v1.10.9 작명소: each account's last paid nickname change (the 24-hour wait counts from it).
    await this.pool.query(`CREATE TABLE IF NOT EXISTS nickname_changes (
      user_id text PRIMARY KEY,
      name text NOT NULL,
      changed_at timestamptz NOT NULL
    )`);
    // v1.7.16 daily missions: one small JSON document per account and Asia/Seoul day.
    await this.pool.query(`CREATE TABLE IF NOT EXISTS mission_days (
      user_id text NOT NULL,
      day text NOT NULL,
      doc jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, day)
    )`);
    // v1.10.37 연계 퀘스트 (one document per account and week) and 혼자 게임 records (best time and clears per level)
    await this.pool.query(`CREATE TABLE IF NOT EXISTS quest_weeks (
      user_id text NOT NULL,
      week text NOT NULL,
      doc jsonb NOT NULL,
      PRIMARY KEY (user_id, week)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS solo_records (
      user_id text NOT NULL,
      game text NOT NULL,
      level text NOT NULL,
      best_ms bigint NOT NULL,
      clears integer NOT NULL,
      PRIMARY KEY (user_id, game, level)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS island_dex (
      user_id text NOT NULL,
      entry text NOT NULL,
      count integer NOT NULL,
      first_at bigint NOT NULL,
      PRIMARY KEY (user_id, entry)
    )`);
    await this.resetEconomy();
  }

  // v1.10.35: see ECONOMY_RESET -- one transaction: the marker row is claimed first, so two starting instances never
  // both reset; every account with points gets its ledger row and goes to 0
  async resetEconomy() {
    const result = await this.#tx(async (client) => {
      const claim = await client.query(`INSERT INTO island_world (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING RETURNING key`, [ECONOMY_RESET, JSON.stringify({ at: new Date().toISOString() })]);
      if (claim.rowCount === 0) return { applied: false };
      const rows = (await client.query('SELECT user_id, balance FROM point_accounts WHERE balance > 0 ORDER BY user_id FOR UPDATE')).rows;
      for (const r of rows) {
        await this.#insertLedger(client, { userId: r.user_id, before: Number(r.balance), delta: -Number(r.balance), reason: 'economy_reset', key: `${ECONOMY_RESET}:${r.user_id}` });
        await client.query('UPDATE point_accounts SET balance = 0, updated_at = now() WHERE user_id = $1', [r.user_id]);
      }
      await client.query(`UPDATE island_world SET value = $2::jsonb WHERE key = $1`, [ECONOMY_RESET, JSON.stringify({ at: new Date().toISOString(), accounts: rows.length })]);
      return { applied: true, accounts: rows.length };
    });
    if (result.applied) this.cache.clear();
    return result;
  }

  async #tx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async #ensure(client, userId) {
    const inserted = await client.query(`INSERT INTO point_accounts (user_id, balance) VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING RETURNING balance`, [userId, this.initialGrant]);
    if (inserted.rowCount === 1) {
      if (this.initialGrant > 0) await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, idempotency_key)
        VALUES ($1, $2, 0, $3, $3, 'initial_grant', $4)`, [crypto.randomUUID(), userId, this.initialGrant, `initial:${userId}`]);
      return true;
    }
    return false;
  }

  async #lockBalances(client, ids) {
    const rows = await client.query('SELECT user_id, balance FROM point_accounts WHERE user_id = ANY($1::text[]) ORDER BY user_id FOR UPDATE', [ids]);
    return Object.fromEntries(rows.rows.map(row => [row.user_id, Number(row.balance)]));
  }

  async ensureAccount(userId) {
    assertUser(userId);
    return this.#tx(async (client) => {
      const created = await this.#ensure(client, userId);
      const balance = (await this.#lockBalances(client, [userId]))[userId];
      this.cache.set(userId, balance);
      return { balance, created };
    });
  }

  async getAccount(userId, now = Date.now()) {
    const { balance } = await this.ensureAccount(userId);
    const date = kstDate(now);
    const claimed = await this.pool.query('SELECT 1 FROM point_ledger WHERE idempotency_key = $1', [`attendance:${userId}:${date}`]);
    return { balance, attendance: { date, claimed: claimed.rowCount === 1 } };
  }

  async claimAttendance(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const key = `attendance:${userId}:${date}`;
    return this.#tx(async (client) => {
      await this.#ensure(client, userId);
      const balance = (await this.#lockBalances(client, [userId]))[userId];
      const exists = await client.query('SELECT 1 FROM point_ledger WHERE idempotency_key = $1', [key]);
      if (exists.rowCount) { this.cache.set(userId, balance); return { granted: false, balance, date }; }
      await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, idempotency_key)
        VALUES ($1, $2, $3, $4, $5, 'daily_attendance', $6)`, [crypto.randomUUID(), userId, balance, DAILY_ATTENDANCE, balance + DAILY_ATTENDANCE, key]);
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, balance + DAILY_ATTENDANCE]);
      this.cache.set(userId, balance + DAILY_ATTENDANCE);
      return { granted: true, amount: DAILY_ATTENDANCE, balance: balance + DAILY_ATTENDANCE, date };
    });
  }

  async settle(raw) {
    const plan = validateSettlement(raw);
    return this.#tx(async (client) => {
      // Claim the settlement id first: a concurrent duplicate blocks here, then sees the row.
      const claim = await client.query(`INSERT INTO point_settlements (settlement_id, match_id, game_type, result)
        VALUES ($1, $2, $3, '{}'::jsonb) ON CONFLICT (settlement_id) DO NOTHING RETURNING settlement_id`, [plan.settlementId, plan.matchId, plan.gameType]);
      if (claim.rowCount === 0) {
        const existing = await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [plan.settlementId]);
        return { applied: false, ...(existing.rows[0]?.result || {}) };
      }
      const ids = [...new Set(plan.transfers.flatMap(item => [item.from, item.to]))];
      for (const id of ids) await this.#ensure(client, id);
      const balances = await this.#lockBalances(client, ids);
      const results = capTransfers(plan.transfers, balances).map(item => ({ ...item, credited: creditAfterBurn(item.paid, plan.burnPercent) }))
        .map(item => ({ ...item, burned: item.paid - item.credited }));
      const current = { ...balances };
      for (const item of results) {
        if (!item.paid) continue;
        for (const [userId, delta, reason] of [[item.from, -item.paid, 'game_loss'], [item.to, item.credited, 'game_win']]) {
          if (!delta) continue;
          const before = current[userId];
          await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, match_id, game_type, settlement_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [crypto.randomUUID(), userId, before, delta, before + delta, reason, plan.matchId, plan.gameType, plan.settlementId]);
          current[userId] = before + delta;
        }
      }
      for (const id of ids) await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [id, current[id]]);
      const record = { settlementId: plan.settlementId, matchId: plan.matchId, gameType: plan.gameType, at: new Date().toISOString(), transfers: results, summary: plan.summary,
        burnPercent: plan.burnPercent, burned: results.reduce((sum, item) => sum + item.burned, 0), balancesBefore: balances, balances: current };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.settlementId, JSON.stringify(record)]);
      // The match history row commits (or rolls back) together with the ledger and settlement rows.
      if (plan.match) {
        const table = await client.query("SELECT to_regclass('game_match_history') AS name");
        if (table.rows[0]?.name) {
          await client.query(`INSERT INTO game_match_history (match_id, game_type, played_at, outcomes) VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (match_id) DO NOTHING`, [plan.match.id, plan.match.gameType, plan.match.at, JSON.stringify(plan.match.outcomes)]);
        }
      }
      for (const id of ids) this.cache.set(id, current[id]);
      return { applied: true, ...record };
    });
  }

  async #insertLedger(client, { userId, before, delta, reason, matchId = null, gameType = null, settlementId = null, key = null }) {
    await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, match_id, game_type, settlement_id, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [crypto.randomUUID(), userId, before, delta, before + delta, reason, matchId, gameType, settlementId, key]);
  }

  async #claim(client, id, matchId, gameType) {
    const claim = await client.query(`INSERT INTO point_settlements (settlement_id, match_id, game_type, result)
      VALUES ($1, $2, $3, '{}'::jsonb) ON CONFLICT (settlement_id) DO NOTHING RETURNING settlement_id`, [id, matchId, gameType]);
    if (claim.rowCount === 1) return null;
    const existing = await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [id]);
    return { applied: false, ...(existing.rows[0]?.result || {}) };
  }

  async chargeEntry(raw) {
    const plan = validateEntry(raw);
    try {
      return await this.#tx(async (client) => {
        const existing = await this.#claim(client, plan.entryId, plan.matchId, plan.gameType);
        if (existing) return existing;
        for (const id of plan.participants) await this.#ensure(client, id);
        const balances = await this.#lockBalances(client, plan.participants);
        const insufficient = plan.participants.filter(id => balances[id] < plan.fee);
        if (insufficient.length) throw new InsufficientPoints(insufficient); // rolls back the claim too
        const current = { ...balances };
        for (const id of plan.participants) {
          await this.#insertLedger(client, { userId: id, before: current[id], delta: -plan.fee, reason: 'game_entry', matchId: plan.matchId, gameType: plan.gameType, settlementId: plan.entryId });
          current[id] -= plan.fee;
          await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [id, current[id]]);
        }
        const record = { kind: 'entry', settlementId: plan.entryId, matchId: plan.matchId, gameType: plan.gameType, at: new Date().toISOString(), fee: plan.fee,
          participants: plan.participants, pool: plan.fee * plan.participants.length, closed: null, summary: { kind: 'entry', fee: plan.fee }, balancesBefore: balances, balances: current };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.entryId, JSON.stringify(record)]);
        for (const id of plan.participants) this.cache.set(id, current[id]);
        return { applied: true, ...record };
      });
    } catch (error) {
      if (error instanceof InsufficientPoints) return { applied: false, insufficient: error.insufficient };
      throw error;
    }
  }

  // Payout and refund both lock the entry row first, so exactly one of them can close it.
  async #closeEntry(client, entryId) {
    const row = await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1 FOR UPDATE', [entryId]);
    const entry = row.rows[0]?.result;
    return entry?.kind === 'entry' ? entry : null;
  }

  async settleEntry({ resultId, entryId, winners = [], burnPercent = ENTRY_BURN_PERCENT }) {
    validId(resultId, 'game-result:'); validId(entryId, 'game-entry:');
    const winnerIds = [...new Set(winners)].filter(validUserId);
    return this.#tx(async (client) => {
      const entry = await this.#closeEntry(client, entryId);
      if (!entry || entry.closed) {
        const done = await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [resultId]);
        return { applied: false, ...(done.rows[0]?.result || {}), closed: entry?.closed || null };
      }
      const existing = await this.#claim(client, resultId, entry.matchId, entry.gameType);
      if (existing) return existing;
      const split = entryPayout(entry, winnerIds, burnPercent);
      const balances = split.winners.length ? await this.#lockBalances(client, split.winners) : {};
      for (const id of split.winners) {
        if (!split.each) break;
        await this.#insertLedger(client, { userId: id, before: balances[id], delta: split.each, reason: 'game_reward', matchId: entry.matchId, gameType: entry.gameType, settlementId: resultId });
        balances[id] += split.each;
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [id, balances[id]]);
      }
      const record = { kind: 'result', settlementId: resultId, entryId, matchId: entry.matchId, gameType: entry.gameType, at: new Date().toISOString(), pool: entry.pool,
        burnPercent, ...split, summary: { kind: 'result', pool: entry.pool, each: split.each, burned: split.burned }, balances };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [resultId, JSON.stringify(record)]);
      await client.query(`UPDATE point_settlements SET result = jsonb_set(result, '{closed}', to_jsonb($2::text)) WHERE settlement_id = $1`, [entryId, resultId]);
      for (const id of split.winners) this.cache.set(id, balances[id]);
      return { applied: true, ...record };
    });
  }

  async refundEntry({ refundId, entryId, reason = 'system' }) {
    validId(refundId, 'game-refund:'); validId(entryId, 'game-entry:');
    return this.#tx(async (client) => {
      const entry = await this.#closeEntry(client, entryId);
      if (!entry || entry.closed) return { applied: false, closed: entry?.closed || null };
      const existing = await this.#claim(client, refundId, entry.matchId, entry.gameType);
      if (existing) return existing;
      const balances = await this.#lockBalances(client, entry.participants);
      for (const id of entry.participants) {
        await this.#insertLedger(client, { userId: id, before: balances[id], delta: entry.fee, reason: 'game_refund', matchId: entry.matchId, gameType: entry.gameType, settlementId: refundId });
        balances[id] += entry.fee;
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [id, balances[id]]);
      }
      const record = { kind: 'refund', settlementId: refundId, entryId, matchId: entry.matchId, gameType: entry.gameType, at: new Date().toISOString(), fee: entry.fee,
        participants: entry.participants, summary: { kind: 'refund', reason: String(reason).slice(0, 40) } };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [refundId, JSON.stringify(record)]);
      await client.query(`UPDATE point_settlements SET result = jsonb_set(result, '{closed}', to_jsonb($2::text)) WHERE settlement_id = $1`, [entryId, refundId]);
      for (const id of entry.participants) this.cache.set(id, balances[id]);
      return { applied: true, ...record };
    });
  }

  async testSpendTo(userId, balance) {
    assertUser(userId);
    return this.#tx(async (client) => {
      await this.#ensure(client, userId);
      const before = (await this.#lockBalances(client, [userId]))[userId];
      const target = Math.max(0, Math.min(before, Math.floor(Number(balance) || 0)));
      await this.#insertLedger(client, { userId, before, delta: target - before, reason: 'test_spend' });
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, target]);
      this.cache.set(userId, target);
      return { balance: target };
    });
  }

  async openEntries() {
    const rows = await this.pool.query(`SELECT settlement_id FROM point_settlements
      WHERE result->>'kind' = 'entry' AND (result->>'closed') IS NULL ORDER BY created_at`);
    return rows.rows.map(row => row.settlement_id);
  }

  async adminGrant(raw) {
    const plan = validateGrant(raw);
    return this.#tx(async (client) => {
      const existing = await this.#claim(client, plan.grantId, null, 'admin');
      if (existing) return existing;
      await this.#ensure(client, plan.userId);
      const before = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
      await this.#insertLedger(client, { userId: plan.userId, before, delta: plan.amount, reason: 'admin_grant', settlementId: plan.grantId, key: plan.grantId });
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, before + plan.amount]);
      const record = { kind: 'admin_grant', settlementId: plan.grantId, gameType: 'admin', at: new Date().toISOString(), userId: plan.userId, amount: plan.amount,
        balanceBefore: before, balanceAfter: before + plan.amount, summary: { kind: 'admin_grant', category: plan.category, memo: plan.memo } };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.grantId, JSON.stringify(record)]);
      this.cache.set(plan.userId, before + plan.amount);
      return { applied: true, ...record };
    });
  }

  // Same contract as the JSON store: the claim row (unique settlement id), the ledger row (unique
  // idempotency key) and the balance update commit in one transaction; a concurrent second claim waits
  // on the unique claim row and then returns the stored result without paying.
  async claimEvent(raw) {
    const plan = validateEventClaim(raw);
    return this.#tx(async (client) => {
      const existing = await this.#claim(client, plan.claimId, null, 'event');
      if (existing) return existing;
      await this.#ensure(client, plan.userId);
      const before = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
      await this.#insertLedger(client, { userId: plan.userId, before, delta: plan.amount, reason: 'event_reward', settlementId: plan.claimId, key: plan.claimId });
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, before + plan.amount]);
      const record = { kind: 'event_reward', settlementId: plan.claimId, gameType: 'event', at: new Date().toISOString(), userId: plan.userId, eventId: plan.eventId, amount: plan.amount,
        balanceBefore: before, balanceAfter: before + plan.amount, summary: { kind: 'event_reward', eventId: plan.eventId, title: plan.title } };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
      this.cache.set(plan.userId, before + plan.amount);
      return { applied: true, ...record };
    });
  }

  async claimedEvents(userId, eventIds) {
    assertUser(userId);
    if (!eventIds.length) return [];
    const rows = await this.pool.query('SELECT settlement_id FROM point_settlements WHERE settlement_id = ANY($1::text[])', [eventIds.map(id => eventClaimId(id, userId))]);
    const claimed = new Set(rows.rows.map(row => row.settlement_id));
    return eventIds.filter(id => claimed.has(eventClaimId(id, userId)));
  }

  // v1.7.16 daily missions (same contract as the JSON store). The account row lock serializes one account's
  // matches; the day document, the payout ledger rows (unique idempotency key / settlement id) and the
  // balance commit in one transaction.
  async #missionDay(client, userId, day, initial = () => newDay(userId, day)) {
    await client.query('INSERT INTO mission_days (user_id, day, doc) VALUES ($1, $2, $3::jsonb) ON CONFLICT (user_id, day) DO NOTHING', [userId, day, JSON.stringify(initial())]);
    return (await client.query('SELECT doc FROM mission_days WHERE user_id = $1 AND day = $2 FOR UPDATE', [userId, day])).rows[0].doc;
  }

  #missionWeek(client, userId, week) { return this.#missionDay(client, userId, `w:${week}`, () => newWeek(week)); }

  async #saveMissionDay(client, userId, day, doc) {
    await client.query('UPDATE mission_days SET doc = $3::jsonb, updated_at = now() WHERE user_id = $1 AND day = $2', [userId, day, JSON.stringify(doc)]);
  }

  async missions(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const week = weekStart(date);
    return this.#tx(async (client) => {
      await client.query("DELETE FROM mission_days WHERE user_id = $1 AND regexp_replace(day, '^w:', '') < $2", [userId, kstDate(now - MISSION_KEEP_MS)]);
      const doc = await this.#missionDay(client, userId, date);
      return { ...dayView(doc), weekly: weekView(await this.#missionWeek(client, userId, week)) };
    });
  }

  async recordMissionMatch(raw, now = Date.now()) {
    const input = validateMissionInput(raw);
    const date = kstDate(now);
    return this.#tx(async (client) => {
      await this.#ensure(client, input.userId);
      let balance = (await this.#lockBalances(client, [input.userId]))[input.userId];
      const week = weekStart(date);
      const doc = await this.#missionDay(client, input.userId, date);
      const weekDoc = await this.#missionWeek(client, input.userId, week);
      const now2 = new Date().toISOString();
      const plan = applyMissionMatch(doc, input, now2);
      const weekPlan = applyWeekMatch(weekDoc, input, now2);
      if (!plan.changed && !weekPlan.changed) return { applied: false, rewards: [], progress: [], view: dayView(doc), weekly: weekView(weekDoc) };
      if (plan.changed) await this.#saveMissionDay(client, input.userId, date, doc);
      if (weekPlan.changed) await this.#saveMissionDay(client, input.userId, `w:${week}`, weekDoc);
      const paid = [];
      for (const reward of [...plan.rewards, ...weekPlan.rewards]) {
        const claimId = rewardKey(reward, date, input.userId);
        if (await this.#claim(client, claimId, null, 'mission')) continue; // already paid
        const before = balance;
        await this.#insertLedger(client, { userId: input.userId, before, delta: reward.amount, reason: reward.reason, settlementId: claimId, key: claimId });
        balance += reward.amount;
        const record = missionSettlement({ claimId, reward, userId: input.userId, before, after: balance, at: new Date().toISOString() });
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [claimId, JSON.stringify(record)]);
        paid.push(reward);
      }
      if (paid.length) await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [input.userId, balance]);
      this.cache.set(input.userId, balance);
      return { applied: true, rewards: paid, progress: plan.progress, balance, view: dayView(doc), weekly: weekView(weekDoc) };
    });
  }

  async testSetWeekly(userId, counters, now = Date.now()) {
    assertUser(userId);
    const week = weekStart(kstDate(now));
    return this.#tx(async (client) => {
      const doc = await this.#missionWeek(client, userId, week);
      doc.counters = { played: Number(counters.played) || 0, wins: Number(counters.wins) || 0, games: (Array.isArray(counters.games) ? counters.games : []).filter(g => /^[a-z0-9]+$/.test(g)) };
      await this.#saveMissionDay(client, userId, `w:${week}`, doc);
      return weekView(doc);
    });
  }

  async testSetMissions(userId, ids, now = Date.now()) {
    assertUser(userId);
    if (!ids.every(id => missionById(id))) throw new RangeError('Unknown mission');
    const date = kstDate(now);
    return this.#tx(async (client) => {
      const doc = await this.#missionDay(client, userId, date);
      doc.ids = ids;
      await client.query('UPDATE mission_days SET doc = $3::jsonb, updated_at = now() WHERE user_id = $1 AND day = $2', [userId, date, JSON.stringify(doc)]);
      return dayView(doc);
    });
  }

  // Same contract as the JSON store: every claim row (unique settlement id), ledger row (unique idempotency key)
  // and the balance update commit in one transaction; an achievement another request already paid is skipped.
  async grantAchievements(userId, raw) {
    const plans = validateAchievementGrant(userId, raw);
    return this.#tx(async (client) => {
      await this.#ensure(client, userId);
      let balance = (await this.#lockBalances(client, [userId]))[userId];
      const granted = [];
      for (const plan of plans) {
        if (await this.#claim(client, plan.claimId, null, 'achievement')) continue;
        const before = balance;
        await this.#insertLedger(client, { userId, before, delta: plan.amount, reason: 'achievement', settlementId: plan.claimId, key: plan.claimId });
        balance += plan.amount;
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId,
          JSON.stringify(achievementSettlement({ plan, userId, before, after: balance, at: new Date().toISOString() }))]);
        granted.push({ id: plan.id, title: plan.title, amount: plan.amount });
      }
      if (granted.length) await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, balance]);
      this.cache.set(userId, balance);
      return { granted, balance };
    });
  }

  // v1.7.30 skins, same contract as the JSON store. The unique settlement id makes a second purchase of the same
  // skin a no-op (also under concurrency); the balance check happens under the account row lock, and an
  // unaffordable purchase rolls the whole transaction back (nothing is claimed, charged or owned).
  async skinState(userId) {
    assertUser(userId);
    const owned = await this.pool.query('SELECT skin_id FROM skin_owned WHERE user_id = $1 ORDER BY acquired_at, skin_id', [userId]);
    const equipped = await this.pool.query('SELECT game, slot, skin_id FROM skin_equipped WHERE user_id = $1', [userId]);
    const map = {};
    for (const row of equipped.rows) (map[row.game] ||= {})[row.slot] = row.skin_id;
    return { owned: owned.rows.map(row => row.skin_id), equipped: map };
  }

  async buySkin(raw) {
    const plan = validateSkinPurchase(raw);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        if (await this.#claim(client, plan.claimId, null, 'skin')) return { applied: false, reason: 'owned', balance };
        if (balance < plan.price) throw new SkinInsufficient(balance);
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: -plan.price, reason: 'skin_purchase', settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance - plan.price]);
        await client.query('INSERT INTO skin_owned (user_id, skin_id, price) VALUES ($1, $2, $3)', [plan.userId, plan.skinId, plan.price]);
        const record = { kind: 'skin_purchase', settlementId: plan.claimId, gameType: 'skin', at: new Date().toISOString(), userId: plan.userId, amount: plan.price,
          balanceBefore: balance, balanceAfter: balance - plan.price, summary: { kind: 'skin_purchase', skinId: plan.skinId, title: plan.title } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        this.cache.set(plan.userId, balance - plan.price);
        return { applied: true, balance: balance - plan.price };
      });
    } catch (error) {
      if (error instanceof SkinInsufficient) return { applied: false, reason: 'insufficient', balance: error.balance, price: plan.price };
      throw error;
    }
  }

  async setAvatarGender(raw) {
    const plan = validateGender(raw);
    return this.#tx(async (client) => {
      const inserted = await client.query(`INSERT INTO skin_equipped (user_id, game, slot, skin_id) VALUES ($1, 'avatar', 'gender', $2)
        ON CONFLICT (user_id, game, slot) DO NOTHING`, [plan.userId, plan.gender]);
      const rows = await client.query('SELECT game, slot, skin_id FROM skin_equipped WHERE user_id = $1', [plan.userId]);
      const map = {};
      for (const row of rows.rows) (map[row.game] ||= {})[row.slot] = row.skin_id;
      return { ok: true, gender: map.avatar?.gender, chosen: inserted.rowCount === 1, equipped: map };
    });
  }

  async equipSkin(raw) {
    const plan = validateSkinEquip(raw);
    return this.#tx(async (client) => {
      if (plan.skinId) {
        const owns = plan.free ? { rowCount: 1 } : await client.query('SELECT 1 FROM skin_owned WHERE user_id = $1 AND skin_id = $2', [plan.userId, plan.skinId]);
        if (!owns.rowCount) return { ok: false, reason: 'not-owned' };
        await client.query(`INSERT INTO skin_equipped (user_id, game, slot, skin_id) VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, game, slot) DO UPDATE SET skin_id = EXCLUDED.skin_id`, [plan.userId, plan.game, plan.slot, plan.skinId]);
      } else {
        await client.query('DELETE FROM skin_equipped WHERE user_id = $1 AND game = $2 AND slot = $3', [plan.userId, plan.game, plan.slot]);
      }
      const rows = await client.query('SELECT game, slot, skin_id FROM skin_equipped WHERE user_id = $1', [plan.userId]);
      const map = {};
      for (const row of rows.rows) (map[row.game] ||= {})[row.slot] = row.skin_id;
      return { ok: true, equipped: map };
    });
  }

  async grantedAchievements(userId, ids) {
    assertUser(userId);
    if (!ids.length) return [];
    const rows = await this.pool.query('SELECT settlement_id FROM point_settlements WHERE settlement_id = ANY($1::text[])', [ids.map(id => achievementClaimId(id, userId))]);
    const paid = new Set(rows.rows.map(row => row.settlement_id));
    return ids.filter(id => paid.has(achievementClaimId(id, userId)));
  }

  cachedBalance(userId) { return this.cache.has(userId) ? this.cache.get(userId) : null; }

  // v1.9.4 상시 등반 도전 (PostgreSQL): same rules as the JSON store, one transaction per finished climb.
  async climbStatus(userId, now) {
    assertUser(userId);
    const date = kstDate(now); const week = climbWeekOf(now);
    const day = await this.pool.query('SELECT best, paid FROM climb_days WHERE user_id = $1 AND day = $2', [userId, date]);
    const weekRow = await this.pool.query('SELECT best FROM climb_weeks WHERE week = $1 AND user_id = $2', [week, userId]);
    return { date, week, today: { best: Number(day.rows[0]?.best || 0), paid: Number(day.rows[0]?.paid || 0) }, weekBest: Number(weekRow.rows[0]?.best || 0) };
  }

  async recordClimb(raw, now) {
    const plan = validateClimbRecord(raw);
    const date = kstDate(now); const week = climbWeekOf(now);
    const endKey = `climb_end:${plan.climbId}`;
    return this.#tx(async (client) => {
      const existing = await this.#claim(client, endKey, null, 'climb');
      if (existing) return existing;
      await this.#ensure(client, plan.userId);
      let balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
      await client.query('INSERT INTO climb_days (user_id, day, best, paid) VALUES ($1, $2, 0, 0) ON CONFLICT DO NOTHING', [plan.userId, date]);
      const row = (await client.query('SELECT best, paid FROM climb_days WHERE user_id = $1 AND day = $2 FOR UPDATE', [plan.userId, date])).rows[0];
      const day = { best: Number(row.best), paid: Number(row.paid) };
      let delta = 0;
      if (plan.altitude > day.best) {
        const total = dailyClimbReward(plan.altitude);
        if (total > day.paid) {
          delta = total - day.paid;
          await this.#insertLedger(client, { userId: plan.userId, before: balance, delta, reason: 'climb_daily', gameType: 'climb', settlementId: endKey, key: `climb_daily:${plan.userId}:${date}:${total}` });
          balance += delta;
          await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance]);
        }
        day.best = plan.altitude; day.paid = Math.max(day.paid, total);
        await client.query('UPDATE climb_days SET best = $3, paid = $4 WHERE user_id = $1 AND day = $2', [plan.userId, date, day.best, day.paid]);
      }
      const raised = (await client.query(`INSERT INTO climb_weeks (week, user_id, best, name) VALUES ($1, $2, $3, $4)
        ON CONFLICT (week, user_id) DO UPDATE SET best = EXCLUDED.best, name = EXCLUDED.name, reached_at = now() WHERE climb_weeks.best < EXCLUDED.best
        RETURNING best`, [week, plan.userId, plan.altitude, plan.name])).rows[0];
      const weekBest = raised ? Number(raised.best) : Number((await client.query('SELECT best FROM climb_weeks WHERE week = $1 AND user_id = $2', [week, plan.userId])).rows[0].best);
      this.cache.set(plan.userId, balance);
      const outcome = climbOutcome({ plan, date, week, day, weekBest, delta, balance, at: new Date().toISOString() });
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [endKey, JSON.stringify(outcome)]);
      return { applied: true, ...outcome };
    });
  }

  async climbWeekRows(week) {
    const rows = await this.pool.query('SELECT user_id, best, name, reached_at FROM climb_weeks WHERE week = $1', [week]);
    return rows.rows.map((row) => ({ userId: row.user_id, best: Number(row.best), name: row.name, at: row.reached_at?.toISOString?.() || row.reached_at }));
  }

  async climbUnsettledWeeks(currentWeek) {
    const rows = await this.pool.query(`SELECT DISTINCT w.week FROM climb_weeks w WHERE w.week < $1
      AND NOT EXISTS (SELECT 1 FROM point_settlements s WHERE s.settlement_id = 'climb_week:' || w.week) ORDER BY w.week`, [currentWeek]);
    return rows.rows.map((row) => row.week);
  }

  async settleClimbWeek(week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week))) throw new RangeError('Invalid week');
    const weekKey = `climb_week:${week}`;
    return this.#tx(async (client) => {
      const existing = await this.#claim(client, weekKey, null, 'climb');
      if (existing) return existing;
      const rows = (await client.query('SELECT user_id, best, name, reached_at FROM climb_weeks WHERE week = $1', [week])).rows
        .map((row) => ({ userId: row.user_id, best: Number(row.best), name: row.name, at: row.reached_at?.toISOString?.() || row.reached_at }));
      const plan = climbWeekPlan(week, rows);
      const at = new Date().toISOString();
      for (const payout of plan.payouts) {
        const key = `climb_rank:${week}:${payout.userId}`;
        if (await this.#claim(client, key, null, 'climb')) continue; // already paid
        await this.#ensure(client, payout.userId);
        const before = (await this.#lockBalances(client, [payout.userId]))[payout.userId];
        await this.#insertLedger(client, { userId: payout.userId, before, delta: payout.amount, reason: 'climb_weekly_rank', gameType: 'climb', settlementId: key, key });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [payout.userId, before + payout.amount]);
        this.cache.set(payout.userId, before + payout.amount);
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [key, JSON.stringify(climbRankSettlement({ week, payout, before, after: before + payout.amount, at }))]);
      }
      const result = { kind: 'climb_week', settlementId: weekKey, gameType: 'climb', at, ...plan };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [weekKey, JSON.stringify(result)]);
      return { applied: true, ...result };
    });
  }

  async donate(raw, now) {
    const plan = validateDonation(raw);
    const week = climbWeekOf(now);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, 'donation');
        if (existing) return existing;
        if (balance < plan.amount) throw new DonationInsufficient(balance); // rolls the claim back: the same request may come again
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: -plan.amount, reason: 'donation', settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance - plan.amount]);
        const row = (await client.query(`INSERT INTO donation_weeks (week, user_id, total, name) VALUES ($1, $2, $3, $4)
          ON CONFLICT (week, user_id) DO UPDATE SET total = donation_weeks.total + EXCLUDED.total, name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE donation_weeks.name END, reached_at = now()
          RETURNING total`, [week, plan.userId, plan.amount, plan.name])).rows[0];
        const at = new Date().toISOString();
        const record = { kind: 'donation', settlementId: plan.claimId, gameType: 'donation', at, userId: plan.userId, amount: plan.amount, week, total: Number(row.total),
          balanceBefore: balance, balanceAfter: balance - plan.amount, summary: { kind: 'donation', title: `${week} 주` } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        this.cache.set(plan.userId, balance - plan.amount);
        return { applied: true, ...record, balance: balance - plan.amount };
      });
    } catch (error) {
      if (error instanceof DonationInsufficient) return { applied: false, reason: 'insufficient', balance: error.balance };
      throw error;
    }
  }

  // v1.10.30 성형외과·염색사 (PostgreSQL): the payment and the look slot in one transaction, once per request.
  async chargeLook(raw) {
    const plan = validateLook(raw);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, plan.kind);
        if (existing) return existing;
        if (balance < plan.price) throw new LookRefused(balance); // rolls the claim back
        if (plan.price > 0) await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: -plan.price, reason: plan.kind, settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance - plan.price]);
        if (plan.value) await client.query(`INSERT INTO skin_equipped (user_id, game, slot, skin_id) VALUES ($1, 'avatar', $2, $3)
          ON CONFLICT (user_id, game, slot) DO UPDATE SET skin_id = EXCLUDED.skin_id`, [plan.userId, plan.slot, plan.value]);
        else await client.query("DELETE FROM skin_equipped WHERE user_id = $1 AND game = 'avatar' AND slot = $2", [plan.userId, plan.slot]);
        const record = { kind: 'look', look: plan.kind, settlementId: plan.claimId, gameType: plan.kind, at: new Date().toISOString(), userId: plan.userId, slot: plan.slot, value: plan.value,
          balanceBefore: balance, balanceAfter: balance - plan.price, summary: { kind: 'look', title: plan.title } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        const rows = await client.query('SELECT game, slot, skin_id FROM skin_equipped WHERE user_id = $1', [plan.userId]);
        const equipped = {}; for (const row of rows.rows) (equipped[row.game] ||= {})[row.slot] = row.skin_id;
        this.cache.set(plan.userId, balance - plan.price);
        return { applied: true, ...record, balance: balance - plan.price, equipped };
      });
    } catch (error) {
      if (error instanceof LookRefused) return { applied: false, reason: 'insufficient', balance: error.balance };
      throw error;
    }
  }

  // v1.10.9 작명소 (PostgreSQL): the payment, the wait and the name in one transaction, once per request.
  async chargeNickname(raw, now) {
    const plan = validateNickname(raw);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, 'nickname');
        if (existing && (existing.userId !== plan.userId || existing.name !== plan.name)) return { applied: false, reason: 'request' };
        if (existing && !existing.refunded) return existing;
        const attempt = (existing?.attempt || (existing ? 1 : 0)) + 1;
        const lastRow = (await client.query('SELECT name, changed_at FROM nickname_changes WHERE user_id = $1 FOR UPDATE', [plan.userId])).rows[0];
        const last = lastRow ? { name: lastRow.name, changedAt: new Date(lastRow.changed_at).toISOString() } : null;
        if (last && now - Date.parse(last.changedAt) < NICKNAME_COOLDOWN_MS) throw new NicknameRefused('cooldown', { until: new Date(Date.parse(last.changedAt) + NICKNAME_COOLDOWN_MS).toISOString() });
        if (balance < NICKNAME_FEE) throw new NicknameRefused('insufficient', { balance }); // rolls the claim back
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: -NICKNAME_FEE, reason: 'nickname', settlementId: plan.claimId, key: attempt === 1 ? plan.claimId : `${plan.claimId}:charge:${attempt}` });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance - NICKNAME_FEE]);
        const changedAt = new Date(now).toISOString();
        await client.query(`INSERT INTO nickname_changes (user_id, name, changed_at) VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, changed_at = EXCLUDED.changed_at`, [plan.userId, plan.name, changedAt]);
        const record = { kind: 'nickname', settlementId: plan.claimId, gameType: 'nickname', at: new Date().toISOString(), userId: plan.userId, name: plan.name, changedAt, previous: last, attempt, pending: true,
          balanceBefore: balance, balanceAfter: balance - NICKNAME_FEE, summary: { kind: 'nickname', title: plan.name } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        this.cache.set(plan.userId, balance - NICKNAME_FEE);
        return { applied: true, ...record, balance: balance - NICKNAME_FEE };
      });
    } catch (error) {
      if (error instanceof NicknameRefused) return { applied: false, reason: error.reason, ...error.extra };
      throw error;
    }
  }

  async refundNickname(raw) {
    const plan = validateNickname(raw);
    return this.#tx(async (client) => {
      const row = (await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1 FOR UPDATE', [plan.claimId])).rows[0];
      const record = row?.result;
      if (!record?.kind || record.refunded || record.userId !== plan.userId) return false;
      const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
      await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: NICKNAME_FEE, reason: 'nickname_refund', settlementId: plan.claimId, key: (record.attempt || 1) === 1 ? `${plan.claimId}:refund` : `${plan.claimId}:refund:${record.attempt}` });
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance + NICKNAME_FEE]);
      if (record.previous) await client.query('UPDATE nickname_changes SET name = $2, changed_at = $3 WHERE user_id = $1', [plan.userId, record.previous.name, record.previous.changedAt]);
      else await client.query('DELETE FROM nickname_changes WHERE user_id = $1', [plan.userId]);
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify({ ...record, refunded: true, pending: false })]);
      this.cache.set(plan.userId, balance + NICKNAME_FEE);
      return true;
    });
  }

  async completeNickname(raw) {
    const plan = validateNickname(raw);
    return this.#tx(async client => {
      const record = (await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1 FOR UPDATE', [plan.claimId])).rows[0]?.result;
      if (!record || record.refunded || record.userId !== plan.userId || record.name !== plan.name) return false;
      if (record.pending) await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify({ ...record, pending: false })]);
      return true;
    });
  }

  async pendingNicknameRequests() {
    return (await this.pool.query("SELECT result FROM point_settlements WHERE game_type = 'nickname' AND result->>'pending' = 'true' AND COALESCE(result->>'refunded', 'false') = 'false'")).rows.map(row => row.result);
  }

  async nicknameRequest(requestId) {
    const row = (await this.pool.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [`nickname:${requestId}`])).rows[0];
    return row?.result?.kind === 'nickname' && !row.result.refunded ? row.result : null;
  }

  async nicknameState(userId) {
    assertUser(userId);
    const row = (await this.pool.query('SELECT changed_at FROM nickname_changes WHERE user_id = $1', [userId])).rows[0];
    if (!row) return null;
    const changedAt = new Date(row.changed_at).toISOString();
    return { changedAt, until: new Date(Date.parse(changedAt) + NICKNAME_COOLDOWN_MS).toISOString() };
  }

  // v1.10.31 주간 생활활동 (PostgreSQL): `balance` is the account's locked balance; returns the bonus paid (0 or the bonus).
  async #lifeActivity(client, userId, now, balance) {
    const week = weekStart(kstDate(now));
    const row = (await client.query(`INSERT INTO island_weeks (user_id, week, count) VALUES ($1, $2, 1)
      ON CONFLICT (user_id, week) DO UPDATE SET count = island_weeks.count + 1 RETURNING count, paid`, [userId, week])).rows[0];
    if (Number(row.count) < LIFE_WEEK_GOAL || row.paid) return 0;
    const claimId = `islandweek:${week}:${userId}`;
    if (await this.#claim(client, claimId, null, 'island')) return 0;
    await client.query('UPDATE island_weeks SET paid = true WHERE user_id = $1 AND week = $2', [userId, week]);
    await this.#insertLedger(client, { userId, before: balance, delta: LIFE_WEEK_BONUS, reason: 'island_week_bonus', settlementId: claimId, key: claimId });
    await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, balance + LIFE_WEEK_BONUS]);
    const record = { kind: 'island_week_bonus', settlementId: claimId, at: new Date().toISOString(), userId, amount: LIFE_WEEK_BONUS, week,
      balanceBefore: balance, balanceAfter: balance + LIFE_WEEK_BONUS, summary: { kind: 'island', title: `주간 생활활동 ${LIFE_WEEK_GOAL}회` } };
    await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [claimId, JSON.stringify(record)]);
    this.cache.set(userId, balance + LIFE_WEEK_BONUS);
    return LIFE_WEEK_BONUS;
  }

  async islandWeek(userId, now) {
    assertUser(userId);
    const row = (await this.pool.query('SELECT count, paid FROM island_weeks WHERE user_id = $1 AND week = $2', [userId, weekStart(kstDate(now))])).rows[0];
    return { count: Number(row?.count || 0), goal: LIFE_WEEK_GOAL, bonus: LIFE_WEEK_BONUS, paid: Boolean(row?.paid) };
  }

  // v1.10.31 잡초 (PostgreSQL): the one state row is the lock, so a weed is pulled once however many pull it at once
  async #weeds(client, lock = false) {
    const row = (await client.query(`SELECT value FROM island_world WHERE key = 'weeds'${lock ? ' FOR UPDATE' : ''}`)).rows[0];
    if (row) return row.value;
    if (lock) { await client.query(`INSERT INTO island_world (key, value) VALUES ('weeds', $1::jsonb) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(emptyWeeds())]); return this.#weeds(client, true); }
    return emptyWeeds();
  }

  async islandWeeds() { return this.#weeds(this.pool); }

  async islandWeedRoll(raw) {
    const plan = validateWeedRoll(raw);
    return this.#tx(async (client) => {
      const state = await this.#weeds(client, true);
      const next = rollWeeds(state, plan);
      if (!next) return state;
      await client.query(`UPDATE island_world SET value = $1::jsonb WHERE key = 'weeds'`, [JSON.stringify(next)]);
      return next;
    });
  }

  async islandPullWeed(raw, now) {
    const plan = validateWeedPull(raw);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const state = await this.#weeds(client, true);
        const existing = await this.#claim(client, plan.claimId, null, 'island');
        const entries = await this.#bagRows(client, plan.userId);
        if (existing) return { ...existing, bag: IslandItems.bagView(entries) };
        const next = pullFrom(state, plan.weedId);
        if (!next) throw new WeedRefused('gone', { bag: IslandItems.bagView(entries) }); // rolls the claim back
        const filled = IslandItems.addToBag(entries, 'weed', 1, 'weed');
        if (!filled) throw new WeedRefused('full', { bag: IslandItems.bagView(entries) });
        await client.query(`UPDATE island_world SET value = $1::jsonb WHERE key = 'weeds'`, [JSON.stringify(next)]);
        await this.#writeBag(client, plan.userId, filled);
        const bonus = await this.#lifeActivity(client, plan.userId, now, balance);
        const record = { kind: 'island_weed', settlementId: plan.claimId, at: new Date().toISOString(), userId: plan.userId, weedId: plan.weedId };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        return { applied: true, weedId: plan.weedId, bonus, bag: IslandItems.bagView(filled), balance: balance + bonus };
      });
    } catch (error) {
      if (error instanceof WeedRefused) return { applied: false, reason: error.reason, ...error.extra };
      throw error;
    }
  }

  // v1.10.10 이벤트 인벤토리 (PostgreSQL): the account row is the lock for its bag, so two pick-ups never both fit.
  async #bagRows(client, userId) {
    const rows = (await client.query('SELECT entry_id, item_id, qty, meta FROM island_bags WHERE user_id = $1 ORDER BY ctid', [userId])).rows;
    return rows.map((r) => ({ entryId: r.entry_id, itemId: r.item_id, qty: Number(r.qty), meta: r.meta || null }));
  }

  async #writeBag(client, userId, entries) {
    await client.query('DELETE FROM island_bags WHERE user_id = $1', [userId]);
    for (const e of entries) await client.query('INSERT INTO island_bags (user_id, entry_id, item_id, qty, meta) VALUES ($1, $2, $3, $4, $5::jsonb)', [userId, e.entryId, e.itemId, e.qty, e.meta ? JSON.stringify(e.meta) : null]);
  }

  async islandBag(userId) {
    assertUser(userId);
    const rows = (await this.pool.query('SELECT entry_id, item_id, qty, meta FROM island_bags WHERE user_id = $1 ORDER BY ctid', [userId])).rows;
    return IslandItems.bagView(rows.map((r) => ({ entryId: r.entry_id, itemId: r.item_id, qty: Number(r.qty), meta: r.meta || null })));
  }

  async islandGive(raw, now = Date.now()) {
    const plan = validateIslandGive(raw);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, 'island');
        const entries = await this.#bagRows(client, plan.userId);
        if (existing) return { ...existing, bag: IslandItems.bagView(entries) };
        const next = IslandItems.addToBag(entries, plan.itemId, plan.qty, plan.entryId, plan.meta);
        if (!next) throw new IslandRefused('full', { bag: IslandItems.bagView(entries) });
        await this.#writeBag(client, plan.userId, next);
        const record = { kind: 'island_give', settlementId: plan.claimId, at: new Date().toISOString(), userId: plan.userId, itemId: plan.itemId, qty: plan.qty };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        const bonus = plan.itemId === 'lost' ? 0 : await this.#lifeActivity(client, plan.userId, now, balance); // v1.10.31
        return { applied: true, bonus, bag: IslandItems.bagView(next) };
      });
    } catch (error) {
      if (error instanceof IslandRefused) return { applied: false, reason: error.reason, ...error.extra };
      throw error;
    }
  }

  async islandSell(raw, now) {
    const plan = validateIslandSell(raw);
    const day = kstDate(now);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, 'island');
        const entries = await this.#bagRows(client, plan.userId);
        if (existing) return { ...existing, bag: IslandItems.bagView(entries) };
        const earned = Number((await client.query('SELECT earned FROM island_days WHERE user_id = $1 AND day = $2', [plan.userId, day])).rows[0]?.earned || 0);
        const result = IslandItems.sellAt(entries, plan.place, earned, plan.activeLost, now);
        if (!result.paid) throw new IslandRefused(result.capped ? 'cap' : 'nothing', { bag: IslandItems.bagView(entries) }); // rolls the claim back
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: result.paid, reason: 'island_sale', settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance + result.paid]);
        await this.#writeBag(client, plan.userId, result.keep);
        await client.query(`INSERT INTO island_days (user_id, day, earned) VALUES ($1, $2, $3)
          ON CONFLICT (user_id, day) DO UPDATE SET earned = island_days.earned + EXCLUDED.earned`, [plan.userId, day, result.paid - result.uncappedPaid]); // v1.10.31: weeds outside the limit
        const record = { kind: 'island_sale', settlementId: plan.claimId, at: new Date().toISOString(), userId: plan.userId, place: plan.place, paid: result.paid, sold: result.sold, capped: result.capped,
          balanceBefore: balance, balanceAfter: balance + result.paid, summary: { kind: 'island', title: `${IslandItems.PLACES[plan.place]} ${plan.place === 'office' ? '정산' : '판매'}` } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        this.cache.set(plan.userId, balance + result.paid);
        return { applied: true, ...record, balance: balance + result.paid, bag: IslandItems.bagView(result.keep) };
      });
    } catch (error) {
      if (error instanceof IslandRefused) return { applied: false, reason: error.reason, ...error.extra };
      throw error;
    }
  }

  // v1.10.37 연계 퀘스트 (PostgreSQL): see the JSON store -- the document row locked, the bag, the payment, in one transaction
  async questApply(userId, week, fn) {
    assertUser(userId);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, userId);
        const balance = (await this.#lockBalances(client, [userId]))[userId];
        await client.query(`INSERT INTO quest_weeks (user_id, week, doc) VALUES ($1, $2, '{}'::jsonb) ON CONFLICT (user_id, week) DO NOTHING`, [userId, week]);
        const doc = (await client.query('SELECT doc FROM quest_weeks WHERE user_id = $1 AND week = $2 FOR UPDATE', [userId, week])).rows[0].doc || {};
        const bag = await this.#bagRows(client, userId);
        const out = fn(doc, bag);
        if (!out || out.error || out.doc === doc) throw new IslandRefused('none', { value: out || null });
        let keep = bag;
        if (out.take) { keep = IslandItems.takeFromBag(bag, out.take.itemId, out.take.qty); if (!keep) throw new IslandRefused('none', { value: { error: 'MISSING' } }); await this.#writeBag(client, userId, keep); }
        let after = balance;
        if (out.reward > 0) {
          const dup = await client.query('SELECT 1 FROM point_ledger WHERE idempotency_key = $1', [out.payKey]);
          if (dup.rowCount) throw new IslandRefused('none', { value: { error: 'PAID' } });
          await this.#insertLedger(client, { userId, before: balance, delta: out.reward, reason: 'quest', key: out.payKey });
          after = balance + out.reward;
          await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, after]);
          this.cache.set(userId, after);
        }
        await client.query('UPDATE quest_weeks SET doc = $3::jsonb WHERE user_id = $1 AND week = $2', [userId, week, JSON.stringify(out.doc)]);
        return { ...out, balance: after, bag: IslandItems.bagView(keep) };
      });
    } catch (error) {
      if (error instanceof IslandRefused && error.reason === 'none') return error.extra.value;
      throw error;
    }
  }
  async questDoc(userId, week) {
    const row = (await this.pool.query('SELECT doc FROM quest_weeks WHERE user_id = $1 AND week = $2', [userId, week])).rows[0];
    const bag = (await this.pool.query('SELECT entry_id, item_id, qty, meta FROM island_bags WHERE user_id = $1 ORDER BY ctid', [userId])).rows.map((r) => ({ entryId: r.entry_id, itemId: r.item_id, qty: Number(r.qty), meta: r.meta || null }));
    return { doc: row?.doc || {}, bag };
  }

  // v1.10.37 지뢰찾기 (PostgreSQL): see the JSON store
  async soloClear(raw) {
    const plan = validateSolo(raw);
    return this.#tx(async (client) => {
      await this.#ensure(client, plan.userId);
      const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
      const existing = await this.#claim(client, plan.claimId, null, 'solo');
      if (existing) return existing;
      if (plan.points > 0) {
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: plan.points, reason: 'solo_game', settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance + plan.points]);
        this.cache.set(plan.userId, balance + plan.points);
      }
      const old = (await client.query('SELECT best_ms FROM solo_records WHERE user_id = $1 AND game = $2 AND level = $3 FOR UPDATE', [plan.userId, plan.game, plan.level])).rows[0];
      const rec = (await client.query(`INSERT INTO solo_records (user_id, game, level, best_ms, clears) VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (user_id, game, level) DO UPDATE SET best_ms = LEAST(solo_records.best_ms, EXCLUDED.best_ms), clears = solo_records.clears + 1 RETURNING best_ms, clears`, [plan.userId, plan.game, plan.level, plan.ms])).rows[0];
      const record = { kind: 'solo', settlementId: plan.claimId, at: new Date().toISOString(), userId: plan.userId, game: plan.game, level: plan.level, ms: plan.ms, points: plan.points,
        balanceBefore: balance, balanceAfter: balance + plan.points, best: Number(rec.best_ms), clears: Number(rec.clears), newBest: !old || plan.ms < Number(old.best_ms), summary: { kind: 'solo', title: plan.title } };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
      return { applied: true, ...record, balance: balance + plan.points };
    });
  }
  // v1.10.42 도감 (PostgreSQL): see the JSON store
  async dexNote(raw) {
    const plan = validateDex(raw);
    const row = (await this.pool.query(`INSERT INTO island_dex (user_id, entry, count, first_at) VALUES ($1, $2, 1, $3)
      ON CONFLICT (user_id, entry) DO UPDATE SET count = island_dex.count + 1 RETURNING count`, [plan.userId, plan.entry, Date.now()])).rows[0];
    return { entry: plan.entry, count: Number(row.count), first: Number(row.count) === 1 };
  }
  async dexOf(userId) {
    const out = {};
    for (const r of (await this.pool.query('SELECT entry, count, first_at FROM island_dex WHERE user_id = $1', [userId])).rows) out[r.entry] = { count: Number(r.count), first: Number(r.first_at) };
    return out;
  }
  async soloRecords(userId) {
    const out = {};
    for (const r of (await this.pool.query('SELECT game, level, best_ms, clears FROM solo_records WHERE user_id = $1', [userId])).rows) (out[r.game] ||= {})[r.level] = { best: Number(r.best_ms), clears: Number(r.clears) };
    return out;
  }

  async islandReward(raw, now) {
    const plan = validateIslandReward(raw);
    const day = kstDate(now);
    try {
      return await this.#tx(async (client) => {
        await this.#ensure(client, plan.userId);
        const balance = (await this.#lockBalances(client, [plan.userId]))[plan.userId];
        const existing = await this.#claim(client, plan.claimId, null, 'island');
        if (existing) return existing;
        const entries = await this.#bagRows(client, plan.userId);
        const keep = plan.take ? entries.filter((e) => !(e.itemId === 'lost' && e.meta?.eventId === plan.take)) : entries;
        if (plan.take && keep.length === entries.length) throw new IslandRefused('missing');
        const earned = Number((await client.query('SELECT earned FROM island_days WHERE user_id = $1 AND day = $2', [plan.userId, day])).rows[0]?.earned || 0);
        if (earned + plan.amount > IslandItems.DAILY_CAP) throw new IslandRefused('cap');
        await this.#insertLedger(client, { userId: plan.userId, before: balance, delta: plan.amount, reason: 'island_reward', settlementId: plan.claimId, key: plan.claimId });
        await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [plan.userId, balance + plan.amount]);
        if (plan.take) await this.#writeBag(client, plan.userId, keep);
        await client.query(`INSERT INTO island_days (user_id, day, earned) VALUES ($1, $2, $3)
          ON CONFLICT (user_id, day) DO UPDATE SET earned = island_days.earned + EXCLUDED.earned`, [plan.userId, day, plan.amount]);
        const record = { kind: 'island_reward', settlementId: plan.claimId, at: new Date().toISOString(), userId: plan.userId, amount: plan.amount,
          balanceBefore: balance, balanceAfter: balance + plan.amount, summary: { kind: 'island', title: plan.title } };
        await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.claimId, JSON.stringify(record)]);
        this.cache.set(plan.userId, balance + plan.amount);
        const bonus = await this.#lifeActivity(client, plan.userId, now, balance + plan.amount); // v1.10.31
        return { applied: true, ...record, bonus, balance: balance + plan.amount + bonus, bag: IslandItems.bagView(keep) };
      });
    } catch (error) {
      if (error instanceof IslandRefused) return { applied: false, reason: error.reason, ...error.extra };
      throw error;
    }
  }

  async testClearIsland(userId) {
    await this.pool.query('DELETE FROM island_bags WHERE user_id = $1', [userId]);
    await this.pool.query('DELETE FROM island_days WHERE user_id = $1', [userId]);
    await this.pool.query('DELETE FROM island_weeks WHERE user_id = $1', [userId]);
    return true;
  }

  // v1.10.7 당일 위치 (PostgreSQL): every changed spot in one statement.
  async savePlazaSpots(list) {
    const plans = list.map(validatePlazaSpot);
    if (!plans.length) return 0;
    await this.pool.query(`INSERT INTO plaza_spots (user_id, day, x, z)
      SELECT * FROM unnest($1::text[], $2::text[], $3::real[], $4::real[])
      ON CONFLICT (user_id) DO UPDATE SET day = EXCLUDED.day, x = EXCLUDED.x, z = EXCLUDED.z, updated_at = now()`,
    [plans.map((p) => p.userId), plans.map((p) => p.day), plans.map((p) => p.x), plans.map((p) => p.z)]);
    return plans.length;
  }

  async plazaSpot(userId) {
    assertUser(userId);
    const row = (await this.pool.query('SELECT day, x, z FROM plaza_spots WHERE user_id = $1', [userId])).rows[0];
    return row ? { day: row.day, x: Math.round(Number(row.x) * 100) / 100, z: Math.round(Number(row.z) * 100) / 100 } : null;
  }

  async donationWeekRows(week) {
    const rows = await this.pool.query('SELECT user_id, total, name, reached_at FROM donation_weeks WHERE week = $1', [week]);
    return rows.rows.map((row) => ({ userId: row.user_id, total: Number(row.total), name: row.name, at: row.reached_at?.toISOString?.() || row.reached_at }));
  }

  async donationUnsettledWeeks(currentWeek) {
    const rows = await this.pool.query(`SELECT DISTINCT w.week FROM donation_weeks w WHERE w.week < $1
      AND NOT EXISTS (SELECT 1 FROM point_settlements s WHERE s.settlement_id = 'donation_week:' || w.week) ORDER BY w.week`, [currentWeek]);
    return rows.rows.map((row) => row.week);
  }

  async settleDonationWeek(week, statues) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week))) throw new RangeError('Invalid week');
    const weekKey = `donation_week:${week}`;
    return this.#tx(async (client) => {
      const existing = await this.#claim(client, weekKey, null, 'donation');
      if (existing) return existing;
      const ranking = donationRanking((await client.query('SELECT user_id, total, name, reached_at FROM donation_weeks WHERE week = $1', [week])).rows
        .map((row) => ({ userId: row.user_id, total: Number(row.total), name: row.name, at: row.reached_at?.toISOString?.() || row.reached_at })));
      const result = { kind: 'donation_week', settlementId: weekKey, gameType: 'donation', at: new Date().toISOString(), week, hoguking: ranking[0]?.userId || null,
        ranking: ranking.slice(0, 10).map(({ userId, name, total, rank }) => ({ userId, name, total, rank })), statues: statues || [] };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [weekKey, JSON.stringify(result)]);
      return { applied: true, ...result };
    });
  }

  async testReopenDonationWeek(week) {
    await this.pool.query('DELETE FROM point_settlements WHERE settlement_id = $1', [`donation_week:${week}`]);
    return true;
  }

  async donationWeekResult(week) {
    const result = (await this.pool.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [`donation_week:${week}`])).rows[0]?.result;
    return result && Array.isArray(result.ranking) ? { week, hoguking: result.hoguking || null, ranking: result.ranking, statues: result.statues || [] } : null;
  }

  async climbWeekResult(week) {
    const row = (await this.pool.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [`climb_week:${week}`])).rows[0];
    const result = row?.result;
    return result && Array.isArray(result.champions) ? { week, champions: result.champions, ranking: result.ranking || [] } : null;
  }

  async ledger(userId, limit = 50) {
    const rows = await this.pool.query(`SELECT id, user_id, created_at, balance_before, delta, balance_after, reason, match_id, game_type, settlement_id, idempotency_key
      FROM point_ledger WHERE user_id = $1 ORDER BY seq DESC LIMIT $2`, [userId, limit]); // insertion order (rows of one transaction share created_at)
    return rows.rows.map(row => ({ id: row.id, userId: row.user_id, at: row.created_at?.toISOString?.() || row.created_at,
      balanceBefore: Number(row.balance_before), delta: Number(row.delta), balanceAfter: Number(row.balance_after), reason: row.reason,
      matchId: row.match_id, gameType: row.game_type, settlementId: row.settlement_id, idempotencyKey: row.idempotency_key }));
  }

  async history(userId, { limit, before } = {}) {
    assertUser(userId);
    const max = historyLimit(limit);
    const cursor = historyCursor(before);
    const rows = await this.pool.query(`SELECT l.seq, l.created_at, l.balance_before, l.delta, l.balance_after, l.reason, l.game_type, s.result -> 'summary' AS summary
      FROM point_ledger l LEFT JOIN point_settlements s ON s.settlement_id = l.settlement_id
      WHERE l.user_id = $1 AND ($2::bigint IS NULL OR l.seq < $2::bigint)
      ORDER BY l.seq DESC LIMIT $3`, [userId, cursor, max + 1]);
    return historyPage(rows.rows.map(row => historyItem({
      at: row.created_at?.toISOString?.() || row.created_at, delta: row.delta, balanceBefore: row.balance_before,
      balanceAfter: row.balance_after, reason: row.reason, gameType: row.game_type,
    }, row.summary, Number(row.seq))), max);
  }

  async recentSettlements(userId, gameType = 'gostop', limit = 5) {
    assertUser(userId);
    const max = Math.max(1, Math.min(20, Number(limit) || 5));
    const rows = await this.pool.query(`SELECT l.id, l.created_at, l.delta, l.balance_after, l.game_type, l.settlement_id, s.result
      FROM point_ledger l
      LEFT JOIN point_settlements s ON s.settlement_id = l.settlement_id
      WHERE l.user_id = $1 AND l.game_type = $2 AND l.settlement_id IS NOT NULL
      ORDER BY l.created_at DESC, l.id DESC LIMIT $3`, [userId, gameType, max * 4]);
    return summarizeSettlementRows(rows.rows.map(row => ({
      id: row.id, at: row.created_at?.toISOString?.() || row.created_at, delta: Number(row.delta),
      balanceAfter: Number(row.result?.balances?.[userId] ?? row.balance_after), gameType: row.game_type, settlementId: row.settlement_id,
      settlementSummary: row.result?.summary || null,
    })), max);
  }
}

async function createPointStore({ dataDir, databaseUrl, initialGrant }) {
  // Like match history: with a database configured, never fall back to a local file.
  const options = initialGrant === undefined ? {} : { initialGrant };
  const store = databaseUrl ? new PostgresPointStore(databaseUrl, options) : new JsonPointStore(path.join(dataDir, 'points.json'), options);
  await store.init();
  return store;
}

module.exports = { donationRanking, createPointStore, JsonPointStore, PostgresPointStore, capTransfers, creditAfterBurn, entryPayout, kstDate, validUserId, summarizeSettlementRows, HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT, INITIAL_GRANT, DAILY_ATTENDANCE,
  ENTRY_FEE, ENTRY_BURN_PERCENT, SETTLEMENT_BURN_PERCENT, ADMIN_GRANT_UNIT, ADMIN_GRANT_MAX, ADMIN_GRANT_CATEGORIES, EVENT_REWARD_MAX, DONATION_MAX, NICKNAME_FEE, NICKNAME_COOLDOWN_MS, eventClaimId };
