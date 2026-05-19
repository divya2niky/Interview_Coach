/* ─── State ─── */
const state = {
  role: '',
  type: 'behavioral',
  level: 'mid',
  count: 5,
  questions: [],
  answers: [],
  followUps: [],        // follow-up questions per main question
  followUpAnswers: [],  // answers to follow-ups
  feedbacks: [],
  scores: [],
  ratings: [],
  currentQ: 0,
  inFollowUp: false,    // true when answering a follow-up
};

const tips = [
  'Use the STAR method: Situation, Task, Action, Result.',
  'Be specific — vague answers are the #1 interview mistake.',
  'Quantify your impact wherever possible.',
  'Show self-awareness by mentioning what you learned.',
  'Keep answers under 3 minutes — stay concise.',
  'Focus on your contribution, not just the team\'s.',
  'Prepare a clear opening line for each answer.',
  'It\'s okay to pause and think before answering.',
  'Follow-up questions test depth — go further than your first answer.',
  'Interviewers probe weak spots — expect follow-ups on vague answers.',
];

/* ─── DOM helpers ─── */
const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

function thinkingHTML() {
  return '<div class="thinking"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
}

/* ─── Setup chips ─── */
function setupOptionGroup(containerId, stateKey) {
  const container = $(containerId);
  container.querySelectorAll('[data-val]').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('[data-val]').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      state[stateKey] = el.dataset.val;
    });
  });
}
setupOptionGroup('type-options', 'type');
setupOptionGroup('level-options', 'level');
setupOptionGroup('count-options', 'count');

/* ─── Validation ─── */
function validateSetup() {
  $('start-btn').disabled = $('role-input').value.trim().length <= 2;
}
$('role-input').addEventListener('input', e => { state.role = e.target.value.trim(); validateSetup(); });

/* ─── Navigation ─── */
$('go-to-setup').addEventListener('click', () => showScreen('setup'));
$('back-to-landing').addEventListener('click', () => showScreen('landing'));
$('start-btn').addEventListener('click', startInterview);
$('submit-btn').addEventListener('click', submitAnswer);
$('skip-btn').addEventListener('click', skipQuestion);
$('next-btn').addEventListener('click', nextQuestion);
$('skip-followup-btn').addEventListener('click', skipFollowUp);
$('retry-btn').addEventListener('click', startInterview);
$('new-session-btn').addEventListener('click', () => { resetState(); showScreen('setup'); });
$('clear-btn').addEventListener('click', () => {
  $('answer-input').value = '';
  $('submit-btn').disabled = true;
});

$('answer-input').addEventListener('input', () => {
  $('submit-btn').disabled = $('answer-input').value.trim().length < 15;
});

/* ─── Voice Recording ─── */
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const btn = $('record-btn');
    if (btn) btn.outerHTML = '<div class="no-speech-support">Voice not supported — use Chrome for voice input.</div>';
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    finalTranscript = $('answer-input').value;
    $('record-btn').style.display = 'none';
    $('recording-live').style.display = 'flex';
    $('voice-hint').style.display = 'none';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + t;
      } else {
        interimTranscript += t;
      }
    }
    $('answer-input').value = finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');
    $('submit-btn').disabled = $('answer-input').value.trim().length < 15;
  };

  recognition.onerror = (event) => {
    console.error('Speech error:', event.error);
    stopRecording();
    if (event.error === 'not-allowed') {
      $('voice-hint').textContent = 'Microphone access denied. Allow mic access in browser settings.';
      $('voice-hint').style.display = 'block';
      $('voice-hint').style.color = 'var(--red)';
    }
  };

  recognition.onend = () => { if (isRecording) stopRecording(); };
  return true;
}

function startRecording() {
  if (!recognition && !initSpeechRecognition()) return;
  try { recognition.start(); } catch(e) { console.error(e); }
}

function stopRecording() {
  isRecording = false;
  if (recognition) { try { recognition.stop(); } catch(e) {} }
  const btn = $('record-btn');
  const live = $('recording-live');
  const hint = $('voice-hint');
  if (btn) btn.style.display = 'flex';
  if (live) live.style.display = 'none';
  if (hint) { hint.style.display = 'block'; hint.textContent = 'Or type your answer below'; hint.style.color = ''; }
}

$('record-btn').addEventListener('click', startRecording);
$('stop-rec-btn').addEventListener('click', stopRecording);

/* ─── Claude API ─── */
async function callClaude(messages, system) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, system, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

/* ─── Interview flow ─── */
function resetState() {
  Object.assign(state, {
    questions: [], answers: [], followUps: [], followUpAnswers: [],
    feedbacks: [], scores: [], ratings: [], currentQ: 0, inFollowUp: false,
  });
}

function startInterview() {
  resetState();
  state.role = $('role-input').value.trim();
  state.count = parseInt(state.count) || 5;
  $('si-role').textContent = state.role;
  $('si-meta').textContent = `${cap(state.level)} · ${cap(state.type)}`;
  buildProgressSteps();
  rotateTip();
  showScreen('interview');
  loadQuestion();
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildProgressSteps() {
  const container = $('progress-steps');
  container.innerHTML = '';
  for (let i = 0; i < state.count; i++) {
    const div = document.createElement('div');
    div.className = 'progress-step' + (i === 0 ? ' current' : '');
    div.id = `step-${i}`;
    div.innerHTML = `<div class="step-num">${i + 1}</div><span>Question ${i + 1}</span>`;
    container.appendChild(div);
  }
}

function updateProgressSteps() {
  for (let i = 0; i < state.count; i++) {
    const el = $(`step-${i}`);
    if (!el) continue;
    el.className = 'progress-step' +
      (i < state.currentQ ? ' done' : i === state.currentQ ? ' current' : '');
    el.querySelector('.step-num').textContent = i < state.currentQ ? '✓' : i + 1;
  }
}

function rotateTip() {
  $('sidebar-tip-text').textContent = tips[Math.floor(Math.random() * tips.length)];
}

async function loadQuestion() {
  state.inFollowUp = false;
  $('q-number').textContent = `Question ${state.currentQ + 1} of ${state.count}`;
  $('q-label').textContent = 'Question';
  $('q-label').className = 'q-number';
  $('q-text').innerHTML = thinkingHTML();
  $('answer-panel').style.display = 'block';
  $('feedback-panel').style.display = 'none';
  $('followup-panel').style.display = 'none';
  $('answer-input').value = '';
  $('submit-btn').disabled = true;
  $('skip-btn').style.display = '';
  $('next-btn').textContent = state.currentQ < state.count - 1 ? 'Next question →' : 'See my results →';
  stopRecording();
  updateProgressSteps();
  rotateTip();

  const previousQs = state.questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n');
  const system = `You are a senior hiring manager conducting a ${state.type} interview for a ${state.level}-level ${state.role} position.
Generate exactly ONE realistic interview question appropriate for this role and level.
Return ONLY the question — no preamble, no numbering, no quotation marks, no explanation.
Make it specific to the role, not generic.${previousQs ? `\n\nDo NOT repeat topics already covered:\n${previousQs}` : ''}`;

  try {
    const q = await callClaude([{ role: 'user', content: `Generate interview question ${state.currentQ + 1} of ${state.count}.` }], system);
    state.questions.push(q.trim());
    $('q-text').textContent = q.trim();
  } catch (e) {
    $('q-text').textContent = 'Could not load question. Please try again.';
    $('q-text').style.color = 'var(--red)';
    console.error(e);
  }
}

async function submitAnswer() {
  const answer = $('answer-input').value.trim();
  if (!answer) return;
  stopRecording();

  if (state.inFollowUp) {
    // Submitting follow-up answer
    state.followUpAnswers[state.currentQ] = answer;
    $('submit-btn').disabled = true;
    $('answer-panel').style.display = 'none';
    $('feedback-panel').style.display = 'block';
    $('fb-badges').innerHTML = '';
    $('fb-text').innerHTML = thinkingHTML();
    $('fb-example').style.display = 'none';
    await getFinalFeedback();
  } else {
    // Submitting main answer
    state.answers.push(answer);
    $('submit-btn').disabled = true;
    $('skip-btn').style.display = 'none';
    $('answer-panel').style.display = 'none';
    $('followup-panel').style.display = 'block';
    $('fu-text').innerHTML = thinkingHTML();
    $('fu-answer-input').value = '';
    $('fu-submit-btn').disabled = true;
    await loadFollowUp();
  }
}

async function loadFollowUp() {
  const system = `You are a sharp, probing hiring manager. Based on the candidate's answer, generate exactly ONE smart follow-up question that digs deeper.
Focus on: specifics they glossed over, their actual role vs the team, quantifiable outcomes, challenges faced, or lessons learned.
Return ONLY the follow-up question — no preamble, no explanation.`;

  try {
    const fu = await callClaude([{
      role: 'user',
      content: `Role: ${state.level} ${state.role}\nOriginal question: ${state.questions[state.currentQ]}\nCandidate's answer: ${state.answers[state.currentQ]}`,
    }], system);
    state.followUps[state.currentQ] = fu.trim();
    $('fu-text').textContent = fu.trim();
  } catch (e) {
    $('fu-text').textContent = 'Could not load follow-up. Click skip to continue.';
    console.error(e);
  }
}

async function getFinalFeedback() {
  const system = `You are a direct, insightful hiring manager giving structured feedback on interview answers.
Evaluate BOTH the main answer and follow-up answer together. Respond ONLY with a JSON object (no markdown, no extra text):
{
  "score": "strong" | "adequate" | "weak",
  "rating": "X/10",
  "feedback": "2-3 sentences of specific, actionable feedback on both answers combined. Name what was good and what to improve.",
  "example_tip": "One concrete sentence showing what a stronger combined answer would include (omit if already strong)"
}`;

  try {
    const raw = await callClaude([{
      role: 'user',
      content: `Role: ${state.level} ${state.role}
Main question: ${state.questions[state.currentQ]}
Main answer: ${state.answers[state.currentQ]}
Follow-up question: ${state.followUps[state.currentQ] || 'N/A'}
Follow-up answer: ${state.followUpAnswers[state.currentQ] || '(skipped)'}`,
    }], system);

    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { parsed = { score: 'adequate', rating: '6/10', feedback: 'Good effort. Be more specific in follow-ups.', example_tip: '' }; }

    state.feedbacks.push(parsed.feedback);
    state.scores.push(parsed.score);
    state.ratings.push(parsed.rating);

    const scoreClass = { strong: 'badge-strong', adequate: 'badge-adequate', weak: 'badge-weak' }[parsed.score] || 'badge-adequate';
    $('fb-badges').innerHTML = `<span class="fb-badge ${scoreClass}">${parsed.score}</span><span class="fb-badge badge-rating">${parsed.rating}</span>`;
    $('fb-text').textContent = parsed.feedback;

    if (parsed.example_tip) {
      $('fb-example-text').textContent = parsed.example_tip;
      $('fb-example').style.display = 'block';
    }
  } catch (e) {
    $('fb-text').textContent = 'Could not get feedback. Please try again.';
    state.feedbacks.push('Error loading feedback.');
    state.scores.push('adequate');
    state.ratings.push('—');
    console.error(e);
  }
}

function skipFollowUp() {
  state.followUps[state.currentQ] = state.followUps[state.currentQ] || '';
  state.followUpAnswers[state.currentQ] = '(skipped)';
  $('followup-panel').style.display = 'none';
  $('feedback-panel').style.display = 'block';
  $('fb-badges').innerHTML = '';
  $('fb-text').innerHTML = thinkingHTML();
  $('fb-example').style.display = 'none';
  getFinalFeedback();
}

function skipQuestion() {
  stopRecording();
  state.answers.push('(skipped)');
  state.followUps.push('');
  state.followUpAnswers.push('(skipped)');
  state.feedbacks.push('You skipped this question.');
  state.scores.push('weak');
  state.ratings.push('—');
  nextQuestion();
}

function nextQuestion() {
  state.currentQ++;
  if (state.currentQ >= state.count) showSummary();
  else loadQuestion();
}

/* ─── Follow-up panel voice + submit ─── */
let fuRecognition = null;
let fuIsRecording = false;

function initFuSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  fuRecognition = new SR();
  fuRecognition.continuous = true;
  fuRecognition.interimResults = true;
  fuRecognition.lang = 'en-US';
  let fuFinal = '';

  fuRecognition.onstart = () => {
    fuIsRecording = true;
    fuFinal = $('fu-answer-input').value;
    $('fu-record-btn').style.display = 'none';
    $('fu-recording-live').style.display = 'flex';
  };
  fuRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) fuFinal += (fuFinal ? ' ' : '') + t;
      else interim += t;
    }
    $('fu-answer-input').value = fuFinal + (interim ? ' ' + interim : '');
    $('fu-submit-btn').disabled = $('fu-answer-input').value.trim().length < 10;
  };
  fuRecognition.onerror = () => stopFuRecording();
  fuRecognition.onend = () => { if (fuIsRecording) stopFuRecording(); };
  return true;
}

function startFuRecording() {
  if (!fuRecognition && !initFuSpeech()) return;
  try { fuRecognition.start(); } catch(e) {}
}

function stopFuRecording() {
  fuIsRecording = false;
  if (fuRecognition) { try { fuRecognition.stop(); } catch(e) {} }
  $('fu-record-btn').style.display = 'flex';
  $('fu-recording-live').style.display = 'none';
}

$('fu-record-btn').addEventListener('click', startFuRecording);
$('fu-stop-rec-btn').addEventListener('click', stopFuRecording);

$('fu-answer-input').addEventListener('input', () => {
  $('fu-submit-btn').disabled = $('fu-answer-input').value.trim().length < 10;
});

$('fu-submit-btn').addEventListener('click', () => {
  const ans = $('fu-answer-input').value.trim();
  if (!ans) return;
  stopFuRecording();
  state.inFollowUp = true;
  $('answer-input').value = ans; // reuse submit flow
  // Directly call submit logic for follow-up
  state.followUpAnswers[state.currentQ] = ans;
  $('followup-panel').style.display = 'none';
  $('feedback-panel').style.display = 'block';
  $('fb-badges').innerHTML = '';
  $('fb-text').innerHTML = thinkingHTML();
  $('fb-example').style.display = 'none';
  getFinalFeedback();
});

/* ─── Summary ─── */
async function showSummary() {
  showScreen('summary');
  const scoreMap = { strong: 10, adequate: 6, weak: 3 };
  const scores = state.scores.map(s => scoreMap[s] || 5);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const strongCount = state.scores.filter(s => s === 'strong').length;
  const answeredCount = state.answers.filter(a => a !== '(skipped)').length;

  $('sc-avg').textContent = `${avg}/10`;
  $('sc-strong').textContent = strongCount;
  $('sc-total').textContent = answeredCount;
  $('summary-role').textContent = `${cap(state.level)} ${state.role} · ${cap(state.type)} interview`;

  const qaContainer = $('qa-review');
  qaContainer.innerHTML = '';
  state.questions.forEach((q, i) => {
    const score = state.scores[i] || 'adequate';
    const scoreClass = { strong: 'badge-strong', adequate: 'badge-adequate', weak: 'badge-weak' }[score];
    const fuQ = state.followUps[i];
    const fuA = state.followUpAnswers[i];
    const item = document.createElement('div');
    item.className = 'qa-item';
    item.innerHTML = `
      <div class="qa-item-header">
        <div class="qa-q">${q}</div>
        <span class="qa-badge fb-badge ${scoreClass}">${score}</span>
      </div>
      ${fuQ ? `<div class="qa-followup-q">↳ Follow-up: ${fuQ}</div>` : ''}
      <div class="qa-answer">${state.feedbacks[i] || 'No feedback available.'}</div>
    `;
    qaContainer.appendChild(item);
  });

  $('takeaways-list').innerHTML = '<div class="thinking inline"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
  const qaPairs = state.questions.map((q, i) =>
    `Q: ${q}\nA: ${state.answers[i]}\nFollow-up: ${state.followUps[i] || 'N/A'}\nFollow-up answer: ${state.followUpAnswers[i] || 'skipped'}\nScore: ${state.scores[i]}\nFeedback: ${state.feedbacks[i]}`
  ).join('\n\n');

  try {
    const raw = await callClaude([{ role: 'user', content: `Role: ${state.level} ${state.role}\n\n${qaPairs}` }],
      `You are a career coach summarizing a mock interview with follow-up questions. Give exactly 3 concise, specific, actionable takeaways. Return ONLY a JSON array of 3 strings. No markdown, no preamble.`);
    let t;
    try { t = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { t = ['Practice structuring answers with the STAR method.', 'Add specific metrics and outcomes to make answers memorable.', 'Give deeper answers on follow-ups — interviewers probe for specifics.']; }
    $('takeaways-list').innerHTML = t.map(x => `<div class="takeaway-item">${x}</div>`).join('');
  } catch {
    $('takeaways-list').innerHTML = '<div class="takeaway-item">Review your answers above and look for patterns in the feedback.</div>';
  }
}
