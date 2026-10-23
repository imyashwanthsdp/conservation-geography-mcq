/* ==========================================================================
   AquaQuiz - Application Controller (Single-Page Scrolling Architecture)
   Liquid Water Glassmorphism MCQ Practice & Quiz System
   ========================================================================== */

// --- Global Application State ---
const state = {
  mode: 'practice',          // 'practice' | 'quiz' | 'results'
  selectedWeek: 'all',       // 'all' | 1..12
  questions: [],             // Active questions in current scope
  
  // Practice Mode state: id -> { chosen: number, isCorrect: boolean }
  practiceAnswers: {},
  practiceScore: { correct: 0, wrong: 0 },
  
  // Quiz Mode state: id -> chosen (0..3)
  quizAnswers: {},
  quizTimerInterval: null,
  quizSeconds: 0,
  quizSubmitted: false,
  
  // Sound FX via Web Audio API
  soundEnabled: true,
  audioCtx: null
};

// --- Web Audio Synthesizer (Realistic Apple Water Droplet Sounds) ---
function initAudio() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      state.audioCtx = new AudioContext();
    }
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function playWaterDropSound(isCorrect = null) {
  if (!state.soundEnabled) return;
  try {
    initAudio();
    if (!state.audioCtx) return;
    const ctx = state.audioCtx;
    const now = ctx.currentTime;

    if (isCorrect === true) {
      // Pleasant emerald water chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

      osc2.frequency.setValueAtTime(880, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.05);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } else if (isCorrect === false) {
      // Soft gentle droplet pop for incorrect
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // Crisp subtle water droplet tap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (e) {
    // Graceful fallback
  }
}

// --- Scope Management ---
function setScope(weekVal) {
  state.selectedWeek = weekVal;
  
  if (weekVal === 'all') {
    state.questions = [...QUESTIONS_DATA];
  } else {
    state.questions = QUESTIONS_DATA.filter(q => q.week === parseInt(weekVal, 10));
  }
  
  // Clear answers for the new scope
  state.practiceAnswers = {};
  state.practiceScore = { correct: 0, wrong: 0 };
  state.quizAnswers = {};
  state.quizSubmitted = false;
  resetQuizTimer();

  if (state.mode === 'quiz') {
    startQuizTimer();
  }

  renderWeekPills();
  renderTopicBanner();
  renderAllQuestions();
  updateDock();
}

function setMode(newMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  playWaterDropSound();

  // Reset states
  state.practiceAnswers = {};
  state.practiceScore = { correct: 0, wrong: 0 };
  state.quizAnswers = {};
  state.quizSubmitted = false;

  if (newMode === 'quiz') {
    startQuizTimer();
  } else {
    resetQuizTimer();
  }

  // Update mode selector buttons
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === newMode);
  });

  renderTopicBanner();
  renderAllQuestions();
  updateDock();
}

// --- Quiz Timer ---
function startQuizTimer() {
  resetQuizTimer();
  state.quizSeconds = 0;
  updateTimerDisplay();
  state.quizTimerInterval = setInterval(() => {
    state.quizSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function resetQuizTimer() {
  if (state.quizTimerInterval) {
    clearInterval(state.quizTimerInterval);
    state.quizTimerInterval = null;
  }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateTimerDisplay() {
  const timerBadge = document.getElementById('timer-badge');
  if (timerBadge) {
    timerBadge.innerHTML = `⏱️ ${formatTime(state.quizSeconds)}`;
  }
}

// --- Reset Button Handler ---
function resetCurrentScope() {
  playWaterDropSound();

  state.practiceAnswers = {};
  state.practiceScore = { correct: 0, wrong: 0 };
  state.quizAnswers = {};
  state.quizSubmitted = false;

  if (state.mode === 'quiz') {
    startQuizTimer();
  }

  // Remove any prepended celebration card if it was rendered
  document.querySelectorAll('.results-card').forEach(el => el.remove());

  renderTopicBanner();
  renderAllQuestions();
  updateDock();

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Render Header / Topic Banner ---
function renderWeekPills() {
  const container = document.getElementById('week-pills-track');
  if (!container) return;

  let html = `
    <button class="week-pill all-weeks-pill ${state.selectedWeek === 'all' ? 'active' : ''}" data-week="all">
      ✨ All Weeks (${QUESTIONS_DATA.length})
    </button>
  `;

  for (let w = 1; w <= 12; w++) {
    const isAct = state.selectedWeek === w || state.selectedWeek === String(w);
    html += `
      <button class="week-pill ${isAct ? 'active' : ''}" data-week="${w}">
        Week ${w}
      </button>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.week-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      playWaterDropSound();
      setScope(pill.dataset.week);
    });
  });

  const activePill = container.querySelector('.week-pill.active');
  if (activePill) {
    activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function renderTopicBanner() {
  const banner = document.getElementById('topic-banner');
  if (!banner) return;

  let labelText = "Conservation Geography";
  let headingText = "All 12 Weeks (120 Questions Comprehensive)";

  if (state.selectedWeek !== 'all') {
    const weekNum = parseInt(state.selectedWeek, 10);
    const meta = WEEK_METADATA.find(m => m.week === weekNum);
    labelText = `Week ${weekNum} Assignment`;
    headingText = meta ? meta.title : `Week ${weekNum} Practice`;
  }

  const answeredInScope = state.mode === 'practice'
    ? Object.keys(state.practiceAnswers).length
    : Object.keys(state.quizAnswers).length;

  banner.innerHTML = `
    <div class="topic-title-group">
      <span class="topic-label">${labelText}</span>
      <h2 class="topic-heading">${headingText}</h2>
    </div>
    <div class="topic-stats">
      <button id="topic-reset-btn" class="topic-reset-btn" title="Reset All Answers in this scope">
        🔄 Reset
      </button>
      ${state.mode === 'quiz' ? `
        <div id="timer-badge" class="badge-pill timer-badge">⏱️ ${formatTime(state.quizSeconds)}</div>
      ` : `
        <div class="badge-pill">✓ ${state.practiceScore.correct} / ✗ ${state.practiceScore.wrong}</div>
      `}
      <div class="badge-pill" id="banner-count-badge">${answeredInScope}/${state.questions.length} answered</div>
    </div>
  `;

  document.getElementById('topic-reset-btn')?.addEventListener('click', resetCurrentScope);
}

// --- Render All Questions in a Continuous Scrolling Feed ---
function renderAllQuestions() {
  const container = document.getElementById('main-card-container');
  if (!container) return;

  if (state.questions.length === 0) {
    container.innerHTML = `<div class="question-card"><p>No questions found.</p></div>`;
    return;
  }

  const letters = ['A', 'B', 'C', 'D'];
  const total = state.questions.length;

  let streamHtml = `<div class="questions-stream">`;

  state.questions.forEach((q, idx) => {
    const isPracticeAns = state.mode === 'practice' && state.practiceAnswers[q.id];
    const practiceRecord = isPracticeAns ? state.practiceAnswers[q.id] : null;
    const quizSelected = state.mode === 'quiz' ? state.quizAnswers[q.id] : null;

    let optionsHtml = '';
    q.options.forEach((optText, optIdx) => {
      let extraClass = '';
      let iconContent = '';

      if (state.mode === 'practice' && isPracticeAns) {
        if (optIdx === q.answer) {
          extraClass = 'practice-correct';
          iconContent = '✓';
        } else if (optIdx === practiceRecord.chosen) {
          extraClass = 'practice-wrong';
          iconContent = '✗';
        } else {
          extraClass = 'practice-dimmed';
        }
      } else if (state.mode === 'quiz') {
        if (state.quizSubmitted) {
          if (optIdx === q.answer) {
            extraClass = 'quiz-review-correct';
            iconContent = '✓';
          } else if (optIdx === quizSelected) {
            extraClass = 'quiz-review-wrong';
            iconContent = '✗';
          }
        } else if (quizSelected === optIdx) {
          extraClass = 'quiz-selected';
          iconContent = '●';
        }
      }

      const disabledAttr = (state.mode === 'practice' && isPracticeAns) || state.quizSubmitted ? 'disabled' : '';

      optionsHtml += `
        <button class="option-btn ${extraClass}" data-qid="${q.id}" data-optindex="${optIdx}" ${disabledAttr}>
          <span class="option-letter">${letters[optIdx]}</span>
          <span class="option-text">${optText}</span>
          <span class="option-status-icon">${iconContent}</span>
        </button>
      `;
    });

    let feedbackHtml = '';
    if (state.mode === 'practice' && isPracticeAns) {
      const isCorr = practiceRecord.isCorrect;
      feedbackHtml = `
        <div class="instant-feedback-banner ${isCorr ? 'correct' : 'wrong'}">
          <span>${isCorr ? '✓ Correct Answer!' : `✗ Incorrect (Correct: Option ${letters[q.answer]})`}</span>
          <span style="font-size:0.75rem; opacity:0.85;">Instant Reveal</span>
        </div>
      `;
    }

    streamHtml += `
      <article class="question-card" id="q-card-${q.id}" data-id="${q.id}">
        <div class="question-header">
          <div class="question-meta">
            <span class="q-number-chip">Question ${idx + 1} of ${total}</span>
            <span class="mode-badge-chip">Week ${q.week}</span>
          </div>
        </div>

        <h3 class="question-text">${q.question}</h3>

        <div class="feedback-slot">
          ${feedbackHtml}
        </div>

        <div class="options-grid">
          ${optionsHtml}
        </div>
      </article>
    `;
  });

  // Footer action card at the bottom of the scroll stream
  let footerCardHtml = '';
  if (state.mode === 'quiz' && !state.quizSubmitted) {
    footerCardHtml = `
      <div class="stream-footer-card">
        <h3 style="font-size:1.15rem; color:#fff;">Finished answering?</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem;">Submit your answers to get your accuracy score and detailed review.</p>
        <div class="stream-footer-actions">
          <button id="stream-submit-btn" class="dock-btn submit-action" style="height:48px; padding:0 28px; font-size:0.95rem;">
            <span>🚀 Submit Quiz</span>
          </button>
          <button id="stream-reset-btn" class="dock-btn reset-action" style="height:48px; padding:0 20px;">
            <span>🔄 Reset All</span>
          </button>
        </div>
      </div>
    `;
  } else if (state.mode === 'practice') {
    footerCardHtml = `
      <div class="stream-footer-card">
        <h3 style="font-size:1.15rem; color:#fff;">End of Questions</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem;">Review your answers or reset to practice again.</p>
        <div class="stream-footer-actions">
          <button id="stream-reset-btn" class="dock-btn reset-action" style="height:48px; padding:0 24px;">
            <span>🔄 Reset Practice</span>
          </button>
          <button id="stream-to-quiz-btn" class="dock-btn primary-action" style="height:48px; padding:0 24px;">
            <span>📝 Test in Quiz Mode</span>
          </button>
        </div>
      </div>
    `;
  }

  streamHtml += footerCardHtml + `</div>`;
  container.innerHTML = streamHtml;

  // Attach option click listeners
  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const qid = btn.dataset.qid;
      const optIdx = parseInt(btn.dataset.optindex, 10);
      handleOptionSelect(qid, optIdx);
    });
  });

  // Footer button listeners
  document.getElementById('stream-submit-btn')?.addEventListener('click', submitQuiz);
  document.getElementById('stream-reset-btn')?.addEventListener('click', resetCurrentScope);
  document.getElementById('stream-to-quiz-btn')?.addEventListener('click', () => setMode('quiz'));
}

// --- Option Selection Logic with Smooth In-Place Updates ---
function handleOptionSelect(qId, chosenIdx) {
  const q = state.questions.find(item => item.id === qId);
  if (!q) return;

  const card = document.getElementById(`q-card-${qId}`);
  if (!card) return;

  const letters = ['A', 'B', 'C', 'D'];

  if (state.mode === 'practice') {
    // Already answered? Ignore further clicks
    if (state.practiceAnswers[qId]) return;

    const isCorrect = chosenIdx === q.answer;
    state.practiceAnswers[qId] = { chosen: chosenIdx, isCorrect };

    if (isCorrect) {
      state.practiceScore.correct++;
    } else {
      state.practiceScore.wrong++;
    }

    playWaterDropSound(isCorrect);

    // In-place update of options in this card without re-rendering the whole page
    const optionButtons = card.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, idx) => {
      btn.disabled = true;
      const iconSpan = btn.querySelector('.option-status-icon');

      if (idx === q.answer) {
        btn.classList.add('practice-correct');
        if (iconSpan) iconSpan.textContent = '✓';
      } else if (idx === chosenIdx) {
        btn.classList.add('practice-wrong');
        if (iconSpan) iconSpan.textContent = '✗';
      } else {
        btn.classList.add('practice-dimmed');
      }
    });

    // Insert instant feedback banner
    const feedbackSlot = card.querySelector('.feedback-slot');
    if (feedbackSlot) {
      feedbackSlot.innerHTML = `
        <div class="instant-feedback-banner ${isCorrect ? 'correct' : 'wrong'}">
          <span>${isCorrect ? '✓ Correct Answer!' : `✗ Incorrect (Correct: Option ${letters[q.answer]})`}</span>
          <span style="font-size:0.75rem; opacity:0.85;">Instant Reveal</span>
        </div>
      `;
    }

    updateStatsDisplay();

  } else if (state.mode === 'quiz' && !state.quizSubmitted) {
    // Quiz mode: user can select or change answer
    state.quizAnswers[qId] = chosenIdx;
    playWaterDropSound();

    const optionButtons = card.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, idx) => {
      const iconSpan = btn.querySelector('.option-status-icon');
      if (idx === chosenIdx) {
        btn.classList.add('quiz-selected');
        if (iconSpan) iconSpan.textContent = '●';
      } else {
        btn.classList.remove('quiz-selected');
        if (iconSpan) iconSpan.textContent = '';
      }
    });

    updateStatsDisplay();
  }
}

// --- Real-time Stats & Dock Update ---
function updateStatsDisplay() {
  const answeredInScope = state.mode === 'practice'
    ? Object.keys(state.practiceAnswers).length
    : Object.keys(state.quizAnswers).length;

  const countBadge = document.getElementById('banner-count-badge');
  if (countBadge) {
    countBadge.textContent = `${answeredInScope}/${state.questions.length} answered`;
  }

  // Update score in banner if practice mode
  if (state.mode === 'practice') {
    const banner = document.getElementById('topic-banner');
    const scoreBadge = banner?.querySelector('.badge-pill:nth-child(2)');
    if (scoreBadge && scoreBadge.id !== 'timer-badge') {
      scoreBadge.textContent = `✓ ${state.practiceScore.correct} / ✗ ${state.practiceScore.wrong}`;
    }
  }

  updateDock();
}

function updateDock() {
  const counterSpan = document.getElementById('dock-counter');
  const actionSlot = document.getElementById('dock-action-slot');
  const total = state.questions.length;

  const answeredInScope = state.mode === 'practice'
    ? Object.keys(state.practiceAnswers).length
    : Object.keys(state.quizAnswers).length;

  if (counterSpan) {
    counterSpan.textContent = `${answeredInScope} / ${total}`;
  }

  if (actionSlot) {
    if (state.mode === 'quiz' && !state.quizSubmitted) {
      actionSlot.innerHTML = `
        <button id="dock-submit-btn" class="dock-btn submit-action" title="Submit Quiz">
          <span>Submit</span> 🚀
        </button>
      `;
      document.getElementById('dock-submit-btn')?.addEventListener('click', submitQuiz);
    } else {
      actionSlot.innerHTML = `
        <button id="dock-jump-btn" class="dock-btn jump-action" title="Jump to Question">
          <span>Grid</span> 📋
        </button>
      `;
      document.getElementById('dock-jump-btn')?.addEventListener('click', openOverviewModal);
    }
  }
}

// --- Submit Quiz & Celebration Review Card ---
function submitQuiz() {
  const total = state.questions.length;
  const answeredCount = Object.keys(state.quizAnswers).length;

  if (answeredCount < total) {
    const confirmSubmit = confirm(`You have answered ${answeredCount} of ${total} questions. Are you ready to submit your quiz?`);
    if (!confirmSubmit) return;
  }

  resetQuizTimer();
  state.quizSubmitted = true;
  playWaterDropSound(true);

  let correctCount = 0;
  let wrongCount = 0;

  state.questions.forEach(q => {
    const userChoice = state.quizAnswers[q.id];
    if (userChoice === q.answer) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const percent = Math.round((correctCount / total) * 100);
  const circumference = 408;
  const offset = circumference - (circumference * percent) / 100;

  let tier = "🌟 Outstanding Mastery!";
  let sub = "You have demonstrated exceptional knowledge of Conservation Geography!";
  if (percent < 50) {
    tier = "🌱 Keep Practicing!";
    sub = "Try practice mode with instant answers to strengthen key topics.";
  } else if (percent < 80) {
    tier = "👏 Great Achievement!";
    sub = "Solid understanding! A quick revision will push you to 100%.";
  }

  // Prepend celebration card above the questions stream
  const container = document.getElementById('main-card-container');
  if (!container) return;

  const resultsHeaderHtml = `
    <div class="results-card" style="margin-bottom: 24px;">
      <div class="score-gauge-container">
        <svg class="gauge-svg" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="50%" stop-color="#818cf8" />
              <stop offset="100%" stop-color="#34d399" />
            </linearGradient>
          </defs>
          <circle class="gauge-bg" cx="80" cy="80" r="65" />
          <circle id="gauge-circle" class="gauge-fill" cx="80" cy="80" r="65" style="stroke-dashoffset: ${offset};" />
        </svg>
        <div class="gauge-center-text">
          <span class="gauge-percentage">${percent}%</span>
          <span class="gauge-subtext">${correctCount}/${total}</span>
        </div>
      </div>

      <div class="results-summary">
        <h2>${tier}</h2>
        <p>${sub}</p>
      </div>

      <div class="stats-grid-row">
        <div class="stat-box">
          <span class="stat-value green">${correctCount}</span>
          <span class="stat-label">Correct</span>
        </div>
        <div class="stat-box">
          <span class="stat-value red">${wrongCount}</span>
          <span class="stat-label">Incorrect</span>
        </div>
        <div class="stat-box">
          <span class="stat-value blue">${formatTime(state.quizSeconds)}</span>
          <span class="stat-label">Time</span>
        </div>
      </div>

      <div class="results-actions">
        <button id="retry-quiz-btn" class="full-btn primary-btn">
          <span>🔄 Retake Quiz</span>
        </button>
        <button id="practice-scope-btn" class="full-btn">
          <span>⚡ Switch to Practice Mode</span>
        </button>
      </div>
      <p style="font-size: 0.85rem; color: var(--water-cyan); margin-top: 6px;">
        👇 Scroll down to review each question with highlighted correct & chosen answers!
      </p>
    </div>
  `;

  // Re-render questions with review highlights
  renderAllQuestions();
  container.insertAdjacentHTML('afterbegin', resultsHeaderHtml);

  // Attach listeners on results card buttons
  document.getElementById('retry-quiz-btn')?.addEventListener('click', resetCurrentScope);
  document.getElementById('practice-scope-btn')?.addEventListener('click', () => setMode('practice'));

  // Smoothly scroll to results card
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Quick Jump Drawer Modal ---
function openOverviewModal() {
  const modal = document.getElementById('overview-modal');
  const gridContainer = document.getElementById('grid-pills-container');
  if (!modal || !gridContainer) return;

  let pillsHtml = '';
  state.questions.forEach((q, idx) => {
    let pillClass = '';
    if (state.mode === 'practice') {
      const ans = state.practiceAnswers[q.id];
      if (ans) {
        pillClass = ans.isCorrect ? 'correct-pill' : 'wrong-pill';
      }
    } else if (state.mode === 'quiz') {
      if (state.quizAnswers[q.id] !== undefined) {
        pillClass = 'answered';
      }
    }

    pillsHtml += `
      <button class="grid-pill-btn ${pillClass}" data-qid="${q.id}" data-index="${idx}">
        ${idx + 1}
      </button>
    `;
  });

  gridContainer.innerHTML = pillsHtml;

  gridContainer.querySelectorAll('.grid-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      closeModal();
      const targetCard = document.getElementById(`q-card-${qid}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('overview-modal');
  if (modal) modal.classList.remove('active');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Mode segments
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
    });
  });

  // Sound toggle button
  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      soundBtn.classList.toggle('active', state.soundEnabled);
      soundBtn.innerHTML = state.soundEnabled ? '🔔' : '🔕';
      playWaterDropSound();
    });
  }

  // Global Click Delegation for Reset Buttons (Dock, Banner, Stream Footer)
  document.addEventListener('click', (e) => {
    const resetTarget = e.target.closest('#dock-reset-btn, #topic-reset-btn, #stream-reset-btn, .topic-reset-btn, .reset-action');
    if (resetTarget) {
      e.preventDefault();
      resetCurrentScope();
    }
  });

  document.getElementById('dock-center-pill')?.addEventListener('click', openOverviewModal);

  // Modal close buttons
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('overview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'overview-modal') closeModal();
  });

  // Start with All Weeks scope in Practice Mode
  setScope('all');
});
