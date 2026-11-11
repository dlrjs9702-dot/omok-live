'use strict';

const { pointPolicy } = require('./games');

const TEAM_SEATS = ['1', '2', '3', '4'];
const MULTI_SEAT_GAMES = new Set(['gostop', 'bingo', 'pictionary', 'oldmaid', 'cityking', 'twentyquestions', 'davinci', 'halligalli', 'pandemic', 'yut']); /* (윷놀이 B: its 2~4 seats in turn order -- game.seatOrder) */

function matchSeats(room) {
  if (room.gameType === 'omok2v2') return TEAM_SEATS;
  if (room.gameType === 'liar') return [...room.game.players];
  if (MULTI_SEAT_GAMES.has(room.gameType)) return [...room.game.seatOrder];
  return ['black', 'white'];
}

// 윷놀이 C (notes yut-real-rules 「나누기」): the person a seat is recorded for -- an AI's seat none, a seat an AI took over
// from someone who left that person (game.leftSeats: seat → their token)
function holderOf(room, seat) {
  const left = room.game?.leftSeats?.[seat]; if (left) return room.participants[left] || null;
  const p = room.participants[room.players[seat]]; return p?.ai ? null : p || null;
}
const recordSeats = (room) => matchSeats(room).filter((seat) => !room.participants[room.players[seat]]?.ai || room.game?.leftSeats?.[seat]);

function winnerIds(game) {
  return Array.isArray(game.winner) ? game.winner.map(String) : game.winner == null ? [] : [String(game.winner)];
}

// The side a seat plays for: its team colour (2:2 omok) or the seat itself.
function winningSideOf(room, seat) {
  return room.gameType === 'omok2v2' ? (Number(seat) % 2 ? 'black' : 'white')
    : String(seat);
}

// v1.7.3: the seats that share a finished game's reward -- every winner (a whole winning team),
// or every seat of a game the engine itself declared a draw. Never a new win/loss rule.
function winningSeats(room) {
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status) || pointPolicy(room.gameType) === 'none') return [];
  const seats = matchSeats(room).filter(seat => room.players[seat]);
  if (game.status === 'draw') return seats;
  const winners = winnerIds(game);
  return seats.filter(seat => winners.includes(winningSideOf(room, seat)));
}

function buildMatchResult(room, at = new Date().toISOString()) {
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status)) return null;
  // 잿빛 원정 is co-op (1~4 players, clear or wipe together): not a win/loss record -- nor, G-포인트, the party and co-op
  // games (그림 맞히기·라이어·스무고개·팬데믹): every game whose module says `points: 'none'`
  if (pointPolicy(room.gameType) === 'none') return null;
  const seats = recordSeats(room);
  if (seats.length < 2) { if (seats.length < matchSeats(room).length) return null; /* (윷놀이 C: one person with AIs -- practice) */ throw new Error('Incomplete match seats'); }
  const drawn = game.status === 'draw';
  const winners = winnerIds(game);
  // 팬데믹 is co-op: a lost game has no winner and every seat loses together.
  if (!drawn && !winners.length && room.gameType !== 'pandemic') throw new Error('Missing game winner');
  // Land King with 3-4 players tracks a full finish-order ranking (1st place wins, everyone
  // else loses for win-rate purposes, but their placement is preserved alongside it).
  const ranking = room.gameType === 'cityking' && Array.isArray(game.ranking) ? game.ranking.map(String) : null;
  const outcomes = seats.map(seat => {
    const person = holderOf(room, seat);
    const id = person?.recordId || person?.guestKeyId;
    if (!id) throw new Error('Missing persistent player identity');
    const winningSeat = winningSideOf(room, seat);
    const outcome = { id, result: room.game?.leftSeats?.[seat] ? 'loss' /* (left: 기권) */ : drawn ? 'draw' : winners.includes(winningSeat) ? 'win' : 'loss' };
    if (ranking) {
      const place = ranking.indexOf(String(seat));
      if (place >= 0) outcome.rank = place + 1;
    }
    return outcome;
  });
  // 윷놀이 B (총괄): three or four seats keep their own record and board -- yut3·yut4; two stay 'yut' so nothing breaks
  const all = matchSeats(room).length; /* (윷놀이 C: the board's seats, AIs too) */
  const gameType = room.gameType === 'yut' && all > 2 ? `yut${all}` : room.gameType;
  return { id: `${room.id}:${game.round}`, gameType, at, outcomes };
}

module.exports = { buildMatchResult, matchSeats, recordSeats, holderOf, winningSeats };
