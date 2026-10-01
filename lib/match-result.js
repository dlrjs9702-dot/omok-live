'use strict';

const TEAM_SEATS = ['1', '2', '3', '4'];
const MULTI_SEAT_GAMES = new Set(['gostop', 'bingo', 'pictionary', 'oldmaid', 'cityking', 'twentyquestions', 'davinci', 'halligalli', 'pandemic']);

function matchSeats(room) {
  if (room.gameType === 'omok2v2') return TEAM_SEATS;
  if (room.gameType === 'liar') return [...room.game.players];
  if (MULTI_SEAT_GAMES.has(room.gameType)) return [...room.game.seatOrder];
  return ['black', 'white'];
}

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
  if (!['finished', 'draw'].includes(game.status) || room.gameType === 'rpg') return [];
  const seats = matchSeats(room).filter(seat => room.players[seat]);
  if (game.status === 'draw') return seats;
  const winners = winnerIds(game);
  return seats.filter(seat => winners.includes(winningSideOf(room, seat)));
}

function buildMatchResult(room, at = new Date().toISOString()) {
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status)) return null;
  // 잿빛 원정 is co-op (1~4 players, clear or wipe together): not a win/loss record.
  if (room.gameType === 'rpg') return null;
  const seats = matchSeats(room);
  if (seats.length < 2) throw new Error('Incomplete match seats');
  const drawn = game.status === 'draw';
  const winners = winnerIds(game);
  // 팬데믹 is co-op: a lost game has no winner and every seat loses together.
  if (!drawn && !winners.length && room.gameType !== 'pandemic') throw new Error('Missing game winner');
  // Land King with 3-4 players tracks a full finish-order ranking (1st place wins, everyone
  // else loses for win-rate purposes, but their placement is preserved alongside it).
  const ranking = room.gameType === 'cityking' && Array.isArray(game.ranking) ? game.ranking.map(String) : null;
  const outcomes = seats.map(seat => {
    const token = room.players[seat];
    const person = token && room.participants[token];
    const id = person?.recordId || person?.guestKeyId;
    if (!id) throw new Error('Missing persistent player identity');
    const winningSeat = winningSideOf(room, seat);
    const outcome = { id, result: drawn ? 'draw' : winners.includes(winningSeat) ? 'win' : 'loss' };
    if (ranking) {
      const place = ranking.indexOf(String(seat));
      if (place >= 0) outcome.rank = place + 1;
    }
    return outcome;
  });
  return { id: `${room.id}:${game.round}`, gameType: room.gameType, at, outcomes };
}

module.exports = { buildMatchResult, matchSeats, winningSeats };
