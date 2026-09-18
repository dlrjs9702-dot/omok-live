'use strict';

const TEAM_SEATS = ['1', '2', '3', '4'];
const MULTI_SEAT_GAMES = new Set(['bingo', 'pictionary', 'oldmaid', 'cityking']);

function matchSeats(room) {
  if (room.gameType === 'omok2v2') return TEAM_SEATS;
  if (room.gameType === 'liar') return [...room.game.players];
  if (MULTI_SEAT_GAMES.has(room.gameType)) return [...room.game.seatOrder];
  return ['black', 'white'];
}

function buildMatchResult(room, at = new Date().toISOString()) {
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status)) return null;
  const seats = matchSeats(room);
  if (seats.length < 2) throw new Error('Incomplete match seats');
  const drawn = game.status === 'draw';
  const winners = Array.isArray(game.winner) ? game.winner.map(String)
    : game.winner == null ? [] : [String(game.winner)];
  if (!drawn && !winners.length) throw new Error('Missing game winner');
  // Land King with 3-4 players tracks a full finish-order ranking (1st place wins, everyone
  // else loses for win-rate purposes, but their placement is preserved alongside it).
  const ranking = room.gameType === 'cityking' && Array.isArray(game.ranking) ? game.ranking.map(String) : null;
  const outcomes = seats.map(seat => {
    const token = room.players[seat];
    const person = token && room.participants[token];
    const id = person?.recordId || person?.guestKeyId;
    if (!id) throw new Error('Missing persistent player identity');
    const winningSeat = room.gameType === 'omok2v2' ? (Number(seat) % 2 ? 'black' : 'white') : String(seat);
    const outcome = { id, result: drawn ? 'draw' : winners.includes(winningSeat) ? 'win' : 'loss' };
    if (ranking) {
      const place = ranking.indexOf(String(seat));
      if (place >= 0) outcome.rank = place + 1;
    }
    return outcome;
  });
  return { id: `${room.id}:${game.round}`, gameType: room.gameType, at, outcomes };
}

module.exports = { buildMatchResult, matchSeats };
