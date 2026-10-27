import { useEffect, useRef, useState } from 'react';
import { api, ws } from '@appdeploy/client';
import TugOfWar from './TugOfWar';
import { ArrowRight, Check, Copy, Gamepad2, LogIn, Plus, Trophy, Users, X, Timer, Volume2, VolumeX, CircleCheck, CircleX, Sparkles } from 'lucide-react';
import { Flag } from 'lucide-react';

type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';
type QuizQuestion = { prompt: string; choices: string[]; correctIndex?: number; type?: QuestionType; correctAnswer?: string; category?: string };
type QuizPlayer = { id: string; name: string; score: number; answeredCurrent: boolean; isHost: boolean; currentAnswer?: number | string; answerCorrect?: boolean };
type QuizRoom = {
  roomCode: string; status: 'waiting' | 'countdown' | 'playing' | 'finished'; hostId: string; currentQuestionIndex: number;
  players: QuizPlayer[]; questions: QuizQuestion[]; questionType?: QuestionType; timeLimit?: number; questionStartedAt?: number; countdownStartedAt?: number;
};
function makePlayerId() {
  try { return window.crypto.randomUUID(); } catch { return 'player-' + Math.random().toString(36).slice(2); }
}
export default function QuizGame() {
  const [tugMode, setTugMode] = useState(false);
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [playerId] = useState(makePlayerId);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [countdownLeft, setCountdownLeft] = useState(3);
  const lastBeginRef = useRef<string>('');
  const [source, setSource] = useState<'random' | 'custom'>('random');
  const [questionType, setQuestionType] = useState<QuestionType>('multiple-choice');
  const [timeLimit, setTimeLimit] = useState(20);
  const [customQuestions, setCustomQuestions] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastEndSoundRef = useRef<string>('');
  const lastAutoNextRef = useRef<string>('');
  const connRef = useRef<ReturnType<typeof ws.connect> | null>(null);
  const currentPlayer = room?.players.find(player => player.id === playerId);
  const isHost = Boolean(hostToken) && room?.hostId === playerId;
  const question = room?.questions[room.currentQuestionIndex];
  const allPlayersAnswered = Boolean(room && room.players.length > 0 && room.players.every(player => player.answeredCurrent));
  const customQuestionCount = customQuestions.split(/\r?\n/).filter(line => line.trim()).length;
  const answerRevealed = Boolean(room && (room.status === 'finished' || (room.status === 'playing' && (allPlayersAnswered || secondsLeft <= 0) && question?.correctAnswer !== undefined)));
  function playQuizSound(kind: 'start' | 'tick' | 'correct' | 'wrong' | 'reveal') {
    if (!soundOn || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const notes = kind === 'correct' ? [660, 880, 1046] : kind === 'wrong' ? [280, 220] : kind === 'reveal' ? [523, 659, 784] : kind === 'start' ? [392, 587, 784] : [740];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + index * (kind === 'tick' ? 0 : 0.085);
        oscillator.type = kind === 'wrong' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(startAt); oscillator.stop(startAt + 0.17);
      });
    } catch { /* Audio is optional; the quiz must still work if blocked. */ }
  }
  useEffect(() => {
    const conn = ws.connect(); connRef.current = conn;
    conn.onMessage((message: any) => {
      if (message?.type !== 'entity.update') return;
      const payload = message.payload;
      if (payload?.entity_type === 'quiz_room' && payload?.data) setRoom(current => (!current || current.roomCode === payload.entity_id) ? payload.data as QuizRoom : current);
    });
    conn.onClose(() => setNotice('Connection lost. Reopen the room to reconnect.'));
    conn.onError(() => setNotice('Live updates are reconnecting. You can still use the room controls.'));
    return () => { conn.disconnect(); connRef.current = null; };
  }, []);
  useEffect(() => {
    if (!roomCode) return;
    let active = true; const conn = connRef.current;
    const loadAndSubscribe = async () => {
      try {
        if (conn) {
          await conn.ready;
          if (!active || !conn.connectionId) return;
          await api.post('/api/subscriptions', { entity_type: 'quiz_room', entity_id: roomCode, connection_id: conn.connectionId, player_id: playerId });
        }
        const response = await api.get('/api/quiz/room/' + encodeURIComponent(roomCode));
        if (active) setRoom(response.data.room as QuizRoom);
      } catch (error: any) { if (active) setNotice(error?.response?.data?.error || 'Could not load this room.'); }
    };
    void loadAndSubscribe();
    return () => { active = false; if (conn?.connectionId) void api.post('/api/subscriptions/remove', { entity_type: 'quiz_room', entity_id: roomCode, connection_id: conn.connectionId }).catch(() => undefined); };
  }, [roomCode, playerId]);
  useEffect(() => {
    if (!roomCode || room?.status === 'finished') return;
    let active = true; let inFlight = false;
    const refreshRoom = async () => {
      if (inFlight) return; inFlight = true;
      try { const response = await api.get('/api/quiz/room/' + encodeURIComponent(roomCode)); if (active && response.data?.room?.roomCode === roomCode) setRoom(response.data.room as QuizRoom); }
      catch { /* keep last known room during network interruptions */ }
      finally { inFlight = false; }
    };
    void refreshRoom(); const id = window.setInterval(() => void refreshRoom(), 1500);
    return () => { active = false; window.clearInterval(id); };
  }, [roomCode, room?.status]);
  useEffect(() => { setSelectedIndex(null); setTextAnswer(''); }, [room?.currentQuestionIndex, room?.status]);
  useEffect(() => {
    if (!roomCode || !room || room.hostId !== playerId || hostToken) return;
    let active = true;
    api.post('/api/quiz/claim-host', { roomCode, playerId }).then(response => { if (active) setHostToken(response.data.hostToken as string); }).catch(() => { if (active) setNotice('Host controls are reconnecting.'); });
    return () => { active = false; };
  }, [roomCode, room?.hostId, playerId, hostToken]);
  useEffect(() => {
    if (room?.status !== 'countdown' || !room.countdownStartedAt) { setCountdownLeft(3); return; }
    const update = () => setCountdownLeft(Math.max(0, Math.ceil(((room.countdownStartedAt || Date.now()) + 3000 - Date.now()) / 1000)));
    update(); const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [room?.status, room?.countdownStartedAt, room?.currentQuestionIndex]);
  useEffect(() => {
    if (!room || room.status !== 'countdown' || countdownLeft !== 0 || !isHost || !hostToken || !room.countdownStartedAt) return;
    const key = room.roomCode + ':' + room.currentQuestionIndex + ':' + room.countdownStartedAt;
    if (lastBeginRef.current === key) return;
    lastBeginRef.current = key;
    api.post('/api/quiz/action', { roomCode: room.roomCode, playerId, hostToken, action: 'begin-question' })
      .then(response => { setRoom(response.data.room as QuizRoom); playQuizSound('start'); })
      .catch((error: any) => { lastBeginRef.current = ''; setNotice(error?.response?.data?.error || 'Could not start the question.'); });
  }, [room?.roomCode, room?.status, room?.currentQuestionIndex, room?.countdownStartedAt, countdownLeft, isHost, hostToken, playerId]);
  useEffect(() => {
    if (room?.status !== 'playing' || !room.questionStartedAt) { setSecondsLeft(room?.timeLimit || 20); return; }
    const update = () => setSecondsLeft(Math.max(0, Math.ceil(((room.questionStartedAt || Date.now()) + (room.timeLimit || 20) * 1000 - Date.now()) / 1000)));
    update(); const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [room?.status, room?.questionStartedAt, room?.timeLimit, room?.currentQuestionIndex]);
  useEffect(() => {
    if (room?.status !== 'playing' || secondsLeft !== 0) return;
    const key = room.roomCode + ':' + room.currentQuestionIndex;
    if (lastEndSoundRef.current !== key) { lastEndSoundRef.current = key; playQuizSound('reveal'); }
  }, [room?.status, room?.roomCode, room?.currentQuestionIndex, secondsLeft, soundOn]);
  useEffect(() => {
    if (!room || room.status !== 'playing' || !isHost || !hostToken) return;
    const key = room.roomCode + ':' + room.currentQuestionIndex;
    const timerExpired = secondsLeft <= 0;
    if ((!allPlayersAnswered && !timerExpired) || lastAutoNextRef.current === key) return;
    lastAutoNextRef.current = key;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await api.post('/api/quiz/action', { roomCode: room.roomCode, playerId, hostToken, action: 'next' });
        setRoom(response.data.room as QuizRoom);
        playQuizSound('start');
      } catch (error: any) {
        lastAutoNextRef.current = '';
        setNotice(error?.response?.data?.error || 'Could not automatically advance the quiz.');
      }
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [room?.roomCode, room?.status, room?.currentQuestionIndex, room?.questionStartedAt, room?.timeLimit, secondsLeft, allPlayersAnswered, isHost, hostToken, playerId]);
  async function createRoom(event?: React.FormEvent) {
    event?.preventDefault(); const name = nickname.trim().slice(0, 20);
    if (!name) { setNotice('Enter a nickname first.'); return; }
    if (source === 'custom' && !customQuestions.trim()) { setNotice('Add at least one custom question first.'); return; }
    setBusy(true); setNotice('');
    try {
      const response = await api.post('/api/quiz/create', { nickname: name, playerId, source, questionType, timeLimit, customQuestions });
      setRoom(response.data.room as QuizRoom); setHostToken(response.data.hostToken as string); setRoomCode(response.data.room.roomCode as string);
    } catch (error: any) { setNotice(error?.response?.data?.error || 'Could not create a room. Please try again.'); }
    finally { setBusy(false); }
  }
  async function joinRoom(event?: React.FormEvent) {
    event?.preventDefault(); const name = nickname.trim().slice(0, 20); const code = joinCode.replace(/\D/g, '').slice(0, 6);
    if (!name) { setNotice('Enter a nickname first.'); return; }
    if (code.length !== 6) { setNotice('Enter the 6-digit room code.'); return; }
    setBusy(true); setNotice('');
    try { const response = await api.post('/api/quiz/join', { roomCode: code, nickname: name, playerId }); setRoom(response.data.room as QuizRoom); setHostToken(null); setRoomCode(code); }
    catch (error: any) { setNotice(error?.response?.data?.error || 'Could not join that room.'); }
    finally { setBusy(false); }
  }
  async function doAction(action: string, choiceIndex?: number, answerText?: string) {
    if (!room) return; setBusy(true); setNotice('');
    try {
      const response = await api.post('/api/quiz/action', { roomCode: room.roomCode, playerId, hostToken, action, choiceIndex, answerText });
      setRoom(response.data.room as QuizRoom);
      if (action === 'answer') { setSelectedIndex(choiceIndex ?? null); playQuizSound('tick'); }
      if (action === 'start' || action === 'next') playQuizSound('tick');
    } catch (error: any) { setNotice(error?.response?.data?.error || 'That action could not be completed.'); }
    finally { setBusy(false); }
  }
  function copyCode() {
    if (!room) return;
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(room.roomCode).then(() => setNotice('Room code copied!')).catch(() => setNotice('Your room code is ' + room.roomCode));
    else setNotice('Your room code is ' + room.roomCode);
  }
  function leaveRoom() {
    const code = roomCode; const conn = connRef.current;
    if (code && conn?.connectionId) void api.post('/api/subscriptions/remove', { entity_type: 'quiz_room', entity_id: code, connection_id: conn.connectionId }).catch(() => undefined);
    setRoomCode(''); setRoom(null); setHostToken(null); setSelectedIndex(null); setTextAnswer(''); setNotice('');
  }
  const leaderboard = [...(room?.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const answered = Boolean(currentPlayer?.answeredCurrent);
  if (tugMode) return <TugOfWar onBack={() => setTugMode(false)} />;
  return (
    <div className="content quiz-page"><section className="surface-card resource-card quiz-card">
      <div className="resource-heading quiz-heading"><div className="section-label"><Gamepad2 size={17} /> STUDYMATE MULTIPLAYER</div><h2>Learn together. Compete in real time.</h2><p>Create a room, choose your question style and timer, then challenge friends. Correct answers earn up to 1,000 points, with points dropping as the clock runs.</p><button className="quiz-sound-toggle" type="button" onClick={() => setSoundOn(value => !value)}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}{soundOn ? 'Sound on' : 'Sound off'}</button>{!room && <button className="quiz-secondary-button" type="button" onClick={() => setTugMode(true)}><Flag size={16} /> Play Tug of War</button>}</div>
      {!room ? <div className="quiz-lobby">
        <form className="quiz-name-form" onSubmit={event => event.preventDefault()}><label className="dictionary-search">Your nickname<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={20} placeholder="Enter a nickname" autoComplete="nickname" /></label></form>
        <article className="quiz-entry-card quiz-settings-card"><div className="quiz-settings-title"><span className="quiz-settings-badge"><Sparkles size={17} /></span><div><h3>Build your game</h3><p>Customize the round before inviting friends.</p></div></div>
          <label className="dictionary-search">Question source<select value={source} onChange={event => setSource(event.target.value as 'random' | 'custom')}><option value="random">Random StudyMate problem-solving questions</option><option value="custom">My own questions</option></select></label>
          <label className="dictionary-search">Answer format<select value={questionType} onChange={event => setQuestionType(event.target.value as QuestionType)}><option value="multiple-choice">Multiple choice</option><option value="true-false">True or false</option><option value="short-answer">Type the answer</option></select></label>
          <label className="dictionary-search">Answer timer<select value={timeLimit} onChange={event => setTimeLimit(Number(event.target.value))}><option value={10}>10 seconds</option><option value={20}>20 seconds</option><option value={30}>30 seconds</option></select></label>
          {source === 'custom' && <div className="quiz-custom-builder"><div className="quiz-custom-heading"><div><strong>Your question bank</strong><span>Add as many questions as you need. Every non-empty line becomes one question.</span></div><span className="quiz-question-count">{customQuestionCount} {customQuestionCount === 1 ? 'question' : 'questions'}</span></div><label className="dictionary-search">Write or paste your questions<textarea value={customQuestions} onChange={event => setCustomQuestions(event.target.value)} rows={9} placeholder={'One question per line. Use | between fields.\nMultiple choice: 2+2? | 4 | 3 | 5 | 6\nTrue/false: The Earth orbits the Sun. | True\nType answer: 12 × 3 = ? | 36'} /><small>Multiple choice: Question | correct answer | wrong choice 1 | wrong choice 2 | wrong choice 3. True/false: Statement | True or False. Typed answer: Question | correct answer. Custom games use every question you enter, in a randomized order.</small></label></div>}
          <div className="quiz-settings-note"><Sparkles size={16} /><span><strong>Speed bonus</strong> Start at 1,000 points. Lose 60 points per second, so answer quickly!</span></div>
        </article>
        <div className="quiz-entry-grid">
          <article className="quiz-entry-card"><div className="quiz-entry-icon"><Plus size={22} /></div><h3>Host a game</h3><p>Create a room using the settings above and invite friends with a code.</p><button className="quiz-primary-button" disabled={busy} onClick={() => void createRoom()}>{busy ? 'Creating…' : 'Create room'} <ArrowRight size={17} /></button></article>
          <article className="quiz-entry-card"><div className="quiz-entry-icon"><LogIn size={22} /></div><h3>Join a game</h3><p>Already have a room code? Enter it below to play with the host's settings.</p><form onSubmit={joinRoom}><label className="dictionary-search">6-digit room code<input value={joinCode} onChange={event => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="123456" /></label><button className="quiz-secondary-button" disabled={busy} type="submit">{busy ? 'Joining…' : 'Join room'} <ArrowRight size={17} /></button></form></article>
        </div>
      </div> : <div className="quiz-room">
        <div className="quiz-room-top"><div><span className="quiz-eyebrow">{room.status === 'waiting' ? 'WAITING ROOM' : room.status === 'countdown' ? 'GET READY' : room.status === 'playing' ? 'LIVE QUIZ' : 'GAME COMPLETE'}</span><h3>{room.status === 'waiting' ? 'Ready for training?' : room.status === 'countdown' ? 'Question ' + (room.currentQuestionIndex + 1) + ' is up next' : room.status === 'playing' ? 'Question ' + (room.currentQuestionIndex + 1) + ' of ' + room.questions.length : 'Final leaderboard'}</h3><p>{room.status === 'waiting' ? 'Start solo for practice, or invite friends for a competition.' : room.status === 'countdown' ? 'Get ready. The question begins in 3 seconds.' : room.status === 'playing' ? 'Answer before time runs out. Faster correct answers earn more points.' : 'Great game! Check the final scores below.'}</p></div><div className="quiz-room-actions"><button className="quiz-sound-toggle compact" type="button" onClick={() => setSoundOn(value => !value)}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}{soundOn ? 'Sound on' : 'Sound off'}</button><button className="quiz-leave-button" onClick={leaveRoom} aria-label="Leave room"><X size={17} /> Leave</button></div></div>
        <div className="quiz-code-card"><div><span>ROOM CODE</span><strong>{room.roomCode}</strong><small>Share this code with your friends</small></div><button onClick={copyCode}><Copy size={17} /> Copy code</button></div>
        {room.status === 'waiting' && <div className="quiz-waiting-layout"><section className="quiz-player-panel"><div className="quiz-panel-title"><Users size={18} /><strong>Players in room</strong><span>{room.players.length}</span></div><div className="quiz-player-list">{room.players.map((player, index) => <div className="quiz-player-row" key={player.id}><span className="quiz-player-number">{index + 1}</span><strong>{player.name}</strong>{player.isHost && <span className="quiz-host-tag">HOST</span>}</div>)}</div></section><section className="quiz-start-panel"><div className="quiz-entry-icon"><Gamepad2 size={25} /></div><h3>{isHost ? (room.players.length === 1 ? 'Solo training mode' : 'Ready to begin?') : 'You are in!'}</h3><p>{room.questions.length} questions · {room.timeLimit || 20}s each · {room.questionType === 'true-false' ? 'True/false' : room.questionType === 'short-answer' ? 'Typed answers' : 'Multiple choice'}{room.players.length === 1 ? ' · Practice at your own pace' : ''}</p>{isHost ? <button className="quiz-primary-button" disabled={busy} onClick={() => void doAction('start')}>{room.players.length === 1 ? 'Start training' : 'Start quiz'} <ArrowRight size={17} /></button> : <div className="quiz-waiting-message"><span className="quiz-live-dot" /> Waiting for host to start…</div>}</section></div>}
        {room.status === 'countdown' && <div className="quiz-countdown-card quiz-answer-reveal" role="status"><span className="quiz-reveal-title"><Timer size={18} /><strong>GET READY</strong></span><strong className="quiz-countdown-number" style={{ display: 'block', fontSize: '4rem', lineHeight: 1.1, textAlign: 'center', margin: '12px 0' }}>{countdownLeft > 0 ? countdownLeft : 'GO!'}</strong><p style={{ textAlign: 'center', margin: 0 }}>The next question starts in 3 seconds.</p></div>}
        {room.status === 'playing' && question && <div className="quiz-play-layout"><section className="quiz-question-card">
          <div className="quiz-question-meta"><span>QUESTION {room.currentQuestionIndex + 1}</span><span>{question.category || 'StudyMate Quiz'} · {room.questions.length} total</span></div><div className="quiz-timer-line"><span><Timer size={17} /> {allPlayersAnswered ? 0 : secondsLeft}s left</span><strong>{Math.max(0, 1000 - Math.max(0, (room.timeLimit || 20) - (allPlayersAnswered ? 0 : secondsLeft)) * 60)} pts max now</strong></div><div className="quiz-timer-track"><div className="quiz-timer-fill" style={{ width: (((allPlayersAnswered ? 0 : secondsLeft) / (room.timeLimit || 20)) * 100) + '%' }} /></div>
          <h3>{question.prompt}</h3>
          {question.choices.length > 0 ? <div className="quiz-answer-options">{question.choices.map((choice, index) => { const isCorrectChoice = answerRevealed && question.correctIndex === index; const isWrongChoice = answerRevealed && selectedIndex === index && question.correctIndex !== index; return <button key={choice + index} disabled={busy || answered || allPlayersAnswered || secondsLeft <= 0} className={'quiz-answer-option option-' + index + (selectedIndex === index ? ' selected' : '') + (isCorrectChoice ? ' answer-correct' : '') + (isWrongChoice ? ' answer-wrong' : '')} onClick={() => void doAction('answer', index)}><span>{String.fromCharCode(65 + index)}</span>{choice}{isCorrectChoice ? <CircleCheck size={20} /> : isWrongChoice ? <CircleX size={20} /> : selectedIndex === index ? <Check size={18} /> : null}</button>; })}</div> : <form className="quiz-typed-answer" onSubmit={event => { event.preventDefault(); if (textAnswer.trim()) void doAction('answer', undefined, textAnswer.trim()); }}><input value={textAnswer} onChange={event => setTextAnswer(event.target.value)} disabled={busy || answered || allPlayersAnswered || secondsLeft <= 0} placeholder="Type your answer" /><button className="quiz-primary-button" disabled={busy || answered || allPlayersAnswered || secondsLeft <= 0 || !textAnswer.trim()} type="submit">Submit answer</button></form>}
          {answerRevealed && <div className="quiz-answer-reveal"><div className="quiz-reveal-title"><Sparkles size={18} /><strong>Answer revealed</strong></div><div className="quiz-correct-answer"><CircleCheck size={22} /><div><small>CORRECT ANSWER</small><strong>{question.choices.length > 0 ? question.choices[question.correctIndex ?? 0] : question.correctAnswer}</strong></div></div>{currentPlayer && <div className={'quiz-your-result ' + (currentPlayer.answerCorrect ? 'is-correct' : 'is-wrong')}>{currentPlayer.answerCorrect ? <CircleCheck size={21} /> : <CircleX size={21} />}<div><strong>{currentPlayer.answerCorrect ? 'Your answer was correct!' : 'Not quite this time.'}</strong><span>{currentPlayer.currentAnswer === undefined ? 'You did not answer before time ran out.' : 'Your answer: ' + (typeof currentPlayer.currentAnswer === 'number' ? question.choices[currentPlayer.currentAnswer] : currentPlayer.currentAnswer)}</span></div></div>}</div>}{answered && secondsLeft > 0 && !allPlayersAnswered && <p className="quiz-submitted-message"><Check size={17} /> Answer submitted! Waiting for everyone…</p>}{(secondsLeft <= 0 || allPlayersAnswered) && !answerRevealed && <p className="quiz-notice">Revealing the answer…</p>}{answerRevealed && room.status === 'playing' && <p className="quiz-submitted-message">Press Next question to continue now, or it will continue automatically.</p>
          }{isHost && answerRevealed && <button className="quiz-primary-button quiz-next-button" disabled={busy} onClick={() => void doAction('next')}>{room.currentQuestionIndex === room.questions.length - 1 ? 'Finish quiz' : 'Next question'} <ArrowRight size={17} /></button>}
        </section><section className="quiz-player-panel"><div className="quiz-panel-title"><Trophy size={18} /><strong>Live leaderboard</strong></div><div className="quiz-player-list">{leaderboard.map((player, index) => <div className="quiz-player-row" key={player.id}><span className="quiz-player-number">{index + 1}</span><div className="quiz-leader-name"><strong>{player.name}</strong><small>{answerRevealed ? (player.currentAnswer === undefined ? 'No answer' : player.answerCorrect ? '✓ Correct' : '✕ Incorrect') : player.answeredCurrent ? 'Answered' : 'Thinking…'}</small></div><b className="quiz-score">{player.score}</b></div>)}</div></section></div>}
        {room.status === 'finished' && <div className="quiz-results"><div className="quiz-result-hero"><Trophy size={34} /><h3>{leaderboard[0]?.name || 'Players'} {leaderboard.length > 1 ? 'wins!' : 'finished!'}</h3><p>Thanks for playing StudyMate Multiplayer.</p></div><section className="quiz-player-panel"><div className="quiz-panel-title"><Trophy size={18} /><strong>Final scores</strong></div><div className="quiz-player-list">{leaderboard.map((player, index) => <div className="quiz-player-row" key={player.id}><span className="quiz-player-number">{index + 1}</span><strong>{player.name}</strong><b className="quiz-score">{player.score}</b></div>)}</div></section>{isHost && <button className="quiz-primary-button" onClick={leaveRoom}>Create another game <ArrowRight size={17} /></button>}</div>}
      </div>}
      {notice && <div className="quiz-notice" role="status">{notice}</div>}
    </section></div>
  );
}
