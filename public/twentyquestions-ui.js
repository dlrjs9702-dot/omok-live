(() => {
  'use strict';
  let submit = null;
  let lastState = null;
  let busy = false;
  const $ = id => document.getElementById(id);
  const hidden = (id, yes) => $(id).classList.toggle('hidden', Boolean(yes));
  const nameFor = (state, seat) => state.players?.[seat]?.label || `${seat}번`; 
  const setText = (id, text) => { $(id).textContent = text; };

  function init(roomAction) {
    if (submit) return;
    submit = roomAction;
    const handle = async (action, payload, clearId) => {
      if (busy || !lastState || lastState.gameType !== 'twentyquestions') return;
      busy = true;
      render(lastState);
      try {
        const result = await submit(action, payload);
        if (result?.ok && clearId) $(clearId).value = '';
      } finally {
        busy = false;
        if (lastState?.gameType === 'twentyquestions') render(lastState);
      }
    };
    const form = (id, action, input, key) => $(id).addEventListener('submit', ev => {
      ev.preventDefault();
      const value = $(input).value.trim();
      if (value) handle(action, { [key]: value }, input);
    });
    form('twentySecretForm', 'twenty-secret', 'twentySecretInput', 'secret');
    form('twentyQuestionForm', 'twenty-question', 'twentyQuestionInput', 'question');
    form('twentyGuessForm', 'twenty-guess', 'twentyGuessInput', 'guess');
    $('twentyStartBtn').addEventListener('click', () => handle('twenty-start', {
      mode: $('twentyModeSelect').value,
      totalRounds: Number($('twentyRoundsSelect').value),
    }));
    $('twentyNextBtn').addEventListener('click', () => handle('twenty-next'));
    $('twentyAnswerButtons').addEventListener('click', ev => {
      const button = ev.target.closest('[data-twenty-answer]');
      if (button) handle('twenty-answer', { reply: button.dataset.twentyAnswer });
    });
    $('twentyJudgeCorrect').addEventListener('click', () => handle('twenty-judge', { correct: true }));
    $('twentyJudgeWrong').addEventListener('click', () => handle('twenty-judge', { correct: false }));
    $('twentyRecommendations').addEventListener('click', ev => {
      const button = ev.target.closest('[data-round-count]');
      if (button) $('twentyRoundsSelect').value = button.dataset.roundCount;
    });
  }

  function render(state) {
    lastState = state;
    if (!state || state.gameType !== 'twentyquestions') return;
    const g = state.game || {};
    const seat = state.me?.seat || null;
    const host = Boolean(state.me?.isHost);
    const drawer = Boolean(seat && seat === g.drawerSeat);
    const myTurn = Boolean(seat && seat === g.turnSeat && !g.paused && !busy);
    const waiting = g.status === 'selecting';
    const playing = g.status === 'playing' && !g.paused;
    const phase = g.phase;
    const seatCount = Object.values(state.players || {}).filter(Boolean).length;
    const recentApi = window.GameRecentAction;
    const latestQuestion = (g.questions || []).at(-1);
    const latestGuess = (g.guessHistory || []).at(-1);
    const twentyRecent = recentApi?.observe(
      g.pendingGuess ? `pending-guess:${g.moveCount}:${g.pendingGuess.seat}:${g.pendingGuess.text}`
        : g.pendingQuestion ? `pending-question:${g.moveCount}:${g.pendingQuestion.seat}:${g.pendingQuestion.text}`
          : phase === 'result' && latestGuess ? `guess:${g.moveCount}:${latestGuess.seat}:${latestGuess.text}:${latestGuess.correct}`
            : latestQuestion ? `question:${g.moveCount}:${latestQuestion.seat}:${latestQuestion.text}:${latestQuestion.reply}`
              : latestGuess ? `guess:${g.moveCount}:${latestGuess.seat}:${latestGuess.text}:${latestGuess.correct}` : null
    );
    const recentClasses = () => recentApi?.classes(twentyRecent) || '';
    hidden('twentyHostSetup', !(waiting && host));
    hidden('twentySecretForm', !(playing && phase === 'secret' && drawer));
    hidden('twentyQuestionForm', !(playing && phase === 'asking' && myTurn));
    hidden('twentyGuessForm', !(playing && (phase === 'asking' || phase === 'final-guesses') && myTurn));
    hidden('twentyAnswerBox', !(playing && phase === 'answering' && drawer));
    hidden('twentyJudgeBox', !(playing && phase === 'judging' && drawer));
    hidden('twentyNextBtn', !(g.status === 'round-ended' && host));
    $('twentyStartBtn').disabled = busy || seatCount < 2;
    $('twentyStartBtn').textContent = seatCount < 2 ? '2명 이상 필요' : '스무고개 시작';
    $('twentyNextBtn').disabled = busy;
    $('twentyAnswerButtons').querySelectorAll('button').forEach(button => { button.disabled = busy; });
    $('twentyJudgeCorrect').disabled = busy;
    $('twentyJudgeWrong').disabled = busy;

    const suggestions = [1, 2, 3].map(n => seatCount * n).filter(n => n >= 2 && n <= 10);
    const recommendationBox = $('twentyRecommendations');
    const signature = suggestions.join(',');
    if (recommendationBox.dataset.signature !== signature) {
      recommendationBox.dataset.signature = signature;
      recommendationBox.replaceChildren();
      for (const count of suggestions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost tiny';
        button.dataset.roundCount = String(count);
        button.textContent = `추천 ${count}판 · 1인당 ${count / seatCount}회 출제`;
        recommendationBox.appendChild(button);
      }
    }
    setText('twentyCategory', g.category ? `🎲 이번 카테고리: ${g.category}` : '방장이 모드와 라운드를 정한 뒤 시작합니다.');
    setText('twentyProgress', `라운드 ${g.roundNumber || 0}/${g.totalRounds || '미설정'} · 질문/정답 기회 ${g.questionsUsed || 0}/20 · ${g.mode === 'cooperative' ? '협동전' : '개인전'}`);
    const drawerLabel = g.drawerSeat ? nameFor(state, g.drawerSeat) : '미정';
    const currentLabel = g.turnSeat ? nameFor(state, g.turnSeat) : '대기 중';
    const phaseText = {
      secret: `${drawerLabel}님이 카테고리에 맞는 정답을 정하는 중입니다.`,
      asking: `${currentLabel}님 차례 · 질문 또는 정답 제출`,
      answering: `${drawerLabel}님이 질문에 답변하는 중입니다.`,
      judging: `${drawerLabel}님이 제출된 정답을 판정하는 중입니다.`,
      'final-guesses': `최종 정답 기회 · ${currentLabel}님 (각 도전자 1회)`,
      result: '이번 라운드가 끝났습니다.',
    };
    setText('twentyStatus', waiting ? '2~8명이 자리를 고른 후 방장이 시작합니다.'
      : g.paused ? '연결이 끊기거나 응답이 없는 참가자가 있어 일시정지 중입니다.'
      : g.status === 'finished' ? '전체 게임 종료 · 누적 점수를 확인하세요.'
      : phaseText[phase] || '진행 중');
    setText('twentyMySecret', drawer && state.me?.myTwentySecret && playing
      ? `내 정답: ${state.me.myTwentySecret} (다른 참가자에게는 비공개)` : '정답은 라운드 종료 전까지 출제자에게만 공개됩니다.');
    setText('twentyPendingQuestion', g.pendingQuestion
      ? `${nameFor(state, g.pendingQuestion.seat)}님: ${g.pendingQuestion.text}` : '질문 대기 중');
    setText('twentyPendingGuess', g.pendingGuess
      ? `${nameFor(state, g.pendingGuess.seat)}님: ${g.pendingGuess.text}` : '정답 대기 중');
    for (const id of ['twentyPendingQuestion','twentyPendingGuess']) {
      $(id).classList.remove('recentActionTarget','recentActionFresh');
    }
    if (g.pendingGuess) $('twentyPendingGuess').className += recentClasses();
    else if (g.pendingQuestion) $('twentyPendingQuestion').className += recentClasses();

    const scoreboard = $('twentyScoreboard');
    scoreboard.replaceChildren();
    const sorted = (g.seats || []).slice().sort((a, b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0) || Number(a) - Number(b));
    for (const player of sorted) {
      const line = document.createElement('div');
      line.className = 'twentyScore';
      const label = document.createElement('span');
      label.textContent = `${nameFor(state, player)}${player === g.drawerSeat && g.status === 'playing' ? ' · 출제자' : ''}`;
      const score = document.createElement('strong');
      score.textContent = `${g.scores?.[player] || 0}점`;
      line.append(label, score);
      scoreboard.appendChild(line);
    }
    const log = $('twentyQuestionLog');
    log.replaceChildren();
    for (const [index, question] of (g.questions || []).entries()) {
      const item = document.createElement('li');
      const isLatest = index === (g.questions || []).length - 1 && !g.pendingQuestion && !g.pendingGuess && phase !== 'result';
      item.className = isLatest ? recentClasses().trim() : '';
      item.textContent = `${index + 1}. ${nameFor(state, question.seat)}: ${question.text} → ${question.reply}`;
      log.appendChild(item);
    }
    if (!(g.questions || []).length) { const p = document.createElement('li'); p.textContent = '아직 질문이 없습니다.'; log.appendChild(p); }
    const guesses = $('twentyGuessLog');
    guesses.replaceChildren();
    for (const [index, entry] of (g.guessHistory || []).entries()) {
      const p = document.createElement('p');
      const isLatest = index === (g.guessHistory || []).length - 1 && !g.pendingGuess && (phase === 'result' || !latestQuestion);
      p.className = isLatest ? recentClasses().trim() : '';
      p.textContent = `${nameFor(state, entry.seat)}님: ${entry.text} → ${entry.correct ? '정답' : '오답'}`;
      guesses.appendChild(p);
    }
    const last = (g.roundResults || []).at(-1);
    if (last && (g.status === 'round-ended' || g.status === 'finished')) {
      if (last.voided) {
        setText('twentyRoundResult', `지난 라운드: 출제자 응답/연결 시간 초과로 무효 · 점수 변동 없음`);
      } else {
        setText('twentyRoundResult', `지난 라운드 정답: ${last.secret} · ${last.success ? '도전자 정답 성공' : '출제자 방어 성공'} · 획득: ${last.winners.map(n => nameFor(state, n)).join(', ')}`);
      }
      hidden('twentyRoundResult', false);
    } else hidden('twentyRoundResult', true);
    if (g.status === 'finished') {
      setText('twentyFinalResult', `최종 승자: ${(g.winners || []).map(n => nameFor(state, n)).join(', ')} · 동점은 공동 승리`);
      hidden('twentyFinalResult', false);
    } else hidden('twentyFinalResult', true);
  }

  window.TwentyQuestionsUI = { init, render };
})();
