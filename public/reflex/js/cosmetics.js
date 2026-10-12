// 아일랜드 v1.10.71: 한판마당 cosmetics.js is not part of the material (its 꾸미기 shop); gomoku.js only asks it for the
// board and stone colours, so this gives the plain wooden board and black/white stones every time.
const GOMOKU = Object.freeze({ black: ['#4a4d57', '#0f1013'], white: ['#ffffff', '#cfd2d8'], board: ['#e3b46a', '#c48f45'], line: 'rgba(60,35,10,.55)', star: 'rgba(60,35,10,.8)', glow: false });
export const skinOf = () => GOMOKU;
