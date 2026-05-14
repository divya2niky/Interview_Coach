/* ─── State ─── */
const state = {
  role: '',
  type: 'behavioral',
  level: 'mid',
  count: 5,
  questions: [],
  answers: [],
  feedbacks: [],
  scores: [],
  ratings: [],
  currentQ: 0,
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
];

/* ─── DOM helpers ─── */
const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

/* ─── Setup chip interactivity ─── */
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

/* ─── Input validation ─── */
function validateSetup() {
  const hasRole = $('role-input').value.trim().length > 2;
  $('start-btn').disabled = !hasRole;
}

$('role-input').addEventListener('input', e => { state.role = e.target.value.trim(); validateSetup(); });

/* ─── Navigation ─── */
$('go-to-setup').addEventListener('click', () => showScreen('setup'));
$('back-to-landing').addEventListener('click', () => showScreen('landing'));
$('start-btn').addEventListener('click', startInterview);
$('submit-btn').addEventListener('click', submitAnswer);
$('skip-btn').addEventListener('click', skipQuestion);
$('next-btn').addEventListener('click', nextQuestion);
$('retry-btn').addEventListener('click', startInterview);
$('new-session-btn').addEventListener('click', () => { resetState(); showScreen('setup'); });

$('answer-input').addEventListener('input', () => {
  $('submit-btn').disabled = $('answer-input').value.trim().length < 15;
});

/* ─── API proxy call ─── */
async function callClaude(messages, system) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system,
      messages,
    }),
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
    questions: [], answers: [], feedbacks: [], scores: [], ratings: [], currentQ: 0,
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
    const num = el.querySelector('.step-num');
    num.textContent = i < state.currentQ ? '✓' : i + 1;
  }
}

function rotateTip() {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  $('sidebar-tip-text').textContent = tip;
}

async function loadQuestion() {
  $('q-number').textContent = `Question ${state.currentQ + 1} of ${state.count}`;
  $('q-text').innerHTML = '<div class="thinking"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
  $('answer-panel').style.display = 'block';
  $('feedback-panel').style.display = 'none';
  $('answer-input').value = '';
  $('submit-btn').disabled = true;
  $('skip-btn').style.display = '';
  $('next-btn').textContent = state.currentQ < state.count - 1 ? 'Next question →' : 'See my results →';

  updateProgressSteps();
  rotateTip();

  const previousQs = state.questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n');
  const system = `You are a senior hiring manager conducting a ${state.type} interview for a ${state.level}-level ${state.role} position.

Generate exactly ONE realistic interview question appropriate for this role and level.
Return ONLY the question — no preamble, no numbering, no quotation marks, no explanation.
Make it specific to the role, not generic.${previousQs ? `\n\nDo NOT repeat topics already covered:\n${previousQs}` : ''}`;

  try {
    const q = await callClaude([{
      role: 'user',
      content: `Generate interview question ${state.currentQ + 1} of ${state.count}.`,
    }], system);
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

  state.answers.push(answer);
  $('submit-btn').disabled = true;
  $('skip-btn').style.display = 'none';
  $('answer-panel').style.display = 'none';
  $('feedback-panel').style.display = 'block';
  $('fb-badges').innerHTML = '';
  $('fb-text').innerHTML = '<div class="thinking"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
  $('fb-example').style.display = 'none';

  const system = `You are a direct, insightful hiring manager giving structured feedback on interview answers.

Evaluate the answer and respond ONLY with a JSON object (no markdown, no extra text):
{
  "score": "strong" | "adequate" | "weak",
  "rating": "X/10",
  "feedback": "2–3 sentences of specific, actionable feedback. Name what they did well and what specifically to improve.",
  "example_tip": "One concrete sentence showing what a stronger answer would include (optional — omit if answer was already strong)"
}`;

  try {
    const raw = await callClaude([{
      role: 'user',
      content: `Role: ${state.level} ${state.role}\nQuestion: ${state.questions[state.currentQ]}\nAnswer: ${answer}`,
    }], system);

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { score: 'adequate', rating: '6/10', feedback: 'Good effort. Try to structure your answer with the STAR method for more impact.', example_tip: '' };
    }

    state.feedbacks.push(parsed.feedback);
    state.scores.push(parsed.score);
    state.ratings.push(parsed.rating);

    const scoreClass = { strong: 'badge-strong', adequate: 'badge-adequate', weak: 'badge-weak' }[parsed.score] || 'badge-adequate';
    $('fb-badges').innerHTML = `
      <span class="fb-badge ${scoreClass}">${parsed.score}</span>
      <span class="fb-badge badge-rating">${parsed.rating}</span>
    `;
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

function skipQuestion() {
  state.answers.push('(skipped)');
  state.feedbacks.push('You skipped this question.');
  state.scores.push('weak');
  state.ratings.push('—');
  nextQuestion();
}

function nextQuestion() {
  state.currentQ++;
  if (state.currentQ >= state.count) {
    showSummary();
  } else {
    loadQuestion();
  }
}

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
    const item = document.createElement('div');
    item.className = 'qa-item';
    item.innerHTML = `
      <div class="qa-item-header">
        <div class="qa-q">${q}</div>
        <span class="qa-badge fb-badge ${scoreClass}">${score}</span>
      </div>
      <div class="qa-answer">${state.feedbacks[i] || 'No feedback available.'}</div>
    `;
    qaContainer.appendChild(item);
  });

  $('takeaways-list').innerHTML = '<div class="thinking inline"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';

  const qaPairs = state.questions.map((q, i) =>
    `Q: ${q}\nA: ${state.answers[i]}\nScore: ${state.scores[i]}\nFeedback: ${state.feedbacks[i]}`
  ).join('\n\n');

  try {
    const raw = await callClaude([{
      role: 'user',
      content: `Role: ${state.level} ${state.role}\n\n${qaPairs}`,
    }], `You are a career coach summarizing a mock interview. Based on this session, give exactly 3 concise, specific, actionable takeaways to help this candidate improve. Return ONLY a JSON array of 3 strings. No markdown, no preamble.`);

    let tips;
    try { tips = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { tips = ['Practice structuring answers with the STAR method.', 'Add specific metrics and outcomes to make answers memorable.', 'Keep answers focused — aim for 90–120 seconds each.']; }

    $('takeaways-list').innerHTML = tips.map(t =>
      `<div class="takeaway-item">${t}</div>`
    ).join('');
  } catch {
    $('takeaways-list').innerHTML = '<div class="takeaway-item">Review your answers above and look for patterns in the feedback.</div>';
  }
}
