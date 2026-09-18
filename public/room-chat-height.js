/* Keep the shared room chat sidebar within the actual game board's height. */
(() => {
  const board = document.querySelector('#roomView .boardCard');
  const sidebar = document.querySelector('#roomView .gameLayout > .side');
  if (!board || !sidebar) return;

  function matchBoardHeight() {
    const height = Math.ceil(board.getBoundingClientRect().height);
    // Hidden room views measure as zero; retain the last useful measurement.
    if (height > 0) sidebar.style.setProperty('--room-board-height', `${height}px`);
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(matchBoardHeight);
    observer.observe(board);
  }
  window.addEventListener('resize', matchBoardHeight);
  matchBoardHeight();
})();
