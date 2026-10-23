/* ==========================================================================
   AquaQuiz - Application Controller
   Liquid Water Glassmorphism MCQ Practice & Quiz System
   ========================================================================== */

// --- Global Application State ---
const state = {
  mode: 'practice',          // 'practice' | 'quiz' | 'results'
  selectedWeek: 'all',       // 'all' | 1..12
  questions: [],             // Active questions in current scope
  currentIndex: 0,           // Current question index in active questions array
  
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
    // Graceful fallback if audio is blocked
  }
}

// --- Scope & Question Management ---
function setScope(weekVal) {
  state.selectedWeek = weekVal;
  
  if (weekVal === 'all') {
    state.questions = [...QUESTIONS_DATA];
  } else {
    state.questions = QUESTIONS_DATA.filter(q => q.week === parseInt(weekVal, 10));
  }
  
  state.currentIndex = 0;
  
  // Reset session answers for new scope
  state.practiceAnswers = {};
  state.practiceScore = { correct: 0, wrong: 0 };
  state.quizAnswers = {};
  state.quizSubmitted = false;
  resetQuizTimer();

  renderWeekPills();
  renderTopicBanner();
  renderQuestion();
  renderDock();
}

function setMode(newMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  playWaterDropSound();

  // Reset timers & state if entering quiz mode
  if (newMode === 'quiz') {
    state.quizAnswers = {};
    state.quizSubmitted = false;
    startQuizTimer();
  } else {
    resetQuizTimer();
  }

  // Update mode selector UI
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === newMode);
  });

  renderTopicBanner();
  renderQuestion();
  renderDock();
}

// --- Quiz Timer Functions ---
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

// --- Render Topic Banner & Navigation ---
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

  // Event listeners for week pills
  container.querySelectorAll('.week-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      playWaterDropSound();
      const w = pill.dataset.week;
      setScope(w);
    });
  });

  // Scroll active pill into view smoothly
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
      ${state.mode === 'quiz' ? `
        <div id="timer-badge" class="badge-pill timer-badge">⏱️ ${formatTime(state.quizSeconds)}</div>
      ` : `
        <div class="badge-pill">✓ ${state.practiceScore.correct} / ✗ ${state.practiceScore.wrong}</div>
      `}
      <div class="badge-pill">${answeredInScope}/${state.questions.length} done</div>
    </div>
  `;
}

// --- Render Main Question View ---
function renderQuestion() {
  const container = document.getElementById('main-card-container');
  if (!container) return;

  if (state.questions.length === 0) {
    container.innerHTML = `<div class="question-card"><p>No questions found.</p></div>`;
    return;
  }

  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const progressPercent = Math.round(((state.currentIndex + 1) / total) * 100);

  // Check state for this question
  const isPracticeAnswered = state.mode === 'practice' && state.practiceAnswers[q.id];
  const practiceRecord = isPracticeAnswered ? state.practiceAnswers[q.id] : null;
  const quizSelectedOption = state.mode === 'quiz' ? state.quizAnswers[q.id] : null;

  const letters = ['A', 'B', 'C', 'D'];

  let optionsHtml = '';
  q.options.forEach((optText, idx) => {
    let extraClass = '';
    let iconContent = '';

    if (state.mode === 'practice' && isPracticeAnswered) {
      if (idx === q.answer) {
        extraClass = 'practice-correct';
        iconContent = '✓';
      } else if (idx === practiceRecord.chosen) {
        extraClass = 'practice-wrong';
        iconContent = '✗';
      } else {
        extraClass = 'practice-dimmed';
      }
    } else if (state.mode === 'quiz') {
      if (quizSelectedOption === idx) {
        extraClass = 'quiz-selected';
        iconContent = '●';
      }
    }

    const disabledAttr = (state.mode === 'practice' && isPracticeAnswered) ? 'disabled' : '';

    optionsHtml += `
      <button class="option-btn ${extraClass}" data-index="${idx}" ${disabledAttr}>
        <span class="option-letter">${letters[idx]}</span>
        <span class="option-text">${optText}</span>
        <span class="option-status-icon">${iconContent}</span>
      </button>
    `;
  });

  // Practice mode instant status banner
  let feedbackBannerHtml = '';
  if (state.mode === 'practice' && isPracticeAnswered) {
    const isCorr = practiceRecord.isCorrect;
    feedbackBannerHtml = `
      <div class="instant-feedback-banner ${isCorr ? 'correct' : 'wrong'}">
        <span>${isCorr ? '✓ Correct Answer!' : `✗ Incorrect (Correct: Option ${letters[q.answer]})`}</span>
        <span style="font-size:0.75rem; opacity:0.85;">No explanations needed • Instant Result</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="question-card">
      <div class="question-header">
        <div class="question-meta">
          <span class="q-number-chip">Q ${state.currentIndex + 1} of ${total}</span>
          <span class="mode-badge-chip">Week ${q.week} • ${state.mode === 'practice' ? '⚡ Instant Practice' : '📝 Quiz Mode'}</span>
        </div>
        <button id="shuffle-btn" class="icon-btn" title="Shuffle Questions">🔀</button>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <h3 class="question-text">${q.question}</h3>

      ${feedbackBannerHtml}

      <div class="options-grid">
        ${optionsHtml}
      </div>
    </div>
  `;

  // Option selection listeners
  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosenIdx = parseInt(btn.dataset.index, 10);
      handleOptionSelect(chosenIdx);
    });
  });

  // Shuffle button listener
  const shuffleBtn = document.getElementById('shuffle-btn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', shuffleQuestions);
  }

  renderDock();
}

// --- Option Selection Logic ---
function handleOptionSelect(chosenIdx) {
  const q = state.questions[state.currentIndex];

  if (state.mode === 'practice') {
    // If already answered, do nothing
    if (state.practiceAnswers[q.id]) return;

    const isCorrect = chosenIdx === q.answer;
    state.practiceAnswers[q.id] = { chosen: chosenIdx, isCorrect };

    if (isCorrect) {
      state.practiceScore.correct++;
    } else {
      state.practiceScore.wrong++;
    }

    playWaterDropSound(isCorrect);
    renderTopicBanner();
    renderQuestion();

  } else if (state.mode === 'quiz') {
    // Quiz mode: user can toggle or change answer anytime before submitting
    state.quizAnswers[q.id] = chosenIdx;
    playWaterDropSound();
    renderTopicBanner();
    renderQuestion();
  }
}

// --- Navigation Dock ---
function renderDock() {
  const prevBtn = document.getElementById('dock-prev-btn');
  const nextBtn = document.getElementById('dock-next-btn');
  const centerPill = document.getElementById('dock-center-pill');
  const actionSlot = document.getElementById('dock-action-slot');

  const total = state.questions.length;

  if (prevBtn) {
    prevBtn.disabled = state.currentIndex === 0;
  }

  if (centerPill) {
    centerPill.innerHTML = `📋 ${state.currentIndex + 1} / ${total}`;
  }

  if (actionSlot) {
    if (state.mode === 'quiz') {
      const answeredCount = Object.keys(state.quizAnswers).length;
      const isLast = state.currentIndex === total - 1;
      
      // If last question or all answered, show Submit button
      if (isLast || answeredCount === total) {
        actionSlot.innerHTML = `
          <button id="dock-submit-btn" class="dock-btn submit-action">
            <span>Submit</span> 🚀
          </button>
        `;
        document.getElementById('dock-submit-btn')?.addEventListener('click', submitQuiz);
      } else {
        actionSlot.innerHTML = `
          <button id="dock-next-btn" class="dock-btn primary-action">
            <span>Next</span> →
          </button>
        `;
        document.getElementById('dock-next-btn')?.addEventListener('click', goNext);
      }
    } else {
      // Practice mode
      if (state.currentIndex === total - 1) {
        actionSlot.innerHTML = `
          <button id="dock-finish-btn" class="dock-btn primary-action">
            <span>Summary</span> 🏆
          </button>
        `;
        document.getElementById('dock-finish-btn')?.addEventListener('click', showPracticeSummary);
      } else {
        actionSlot.innerHTML = `
          <button id="dock-next-btn" class="dock-btn primary-action">
            <span>Next</span> →
          </button>
        `;
        document.getElementById('dock-next-btn')?.addEventListener('click', goNext);
      }
    }
  }
}

function goPrev() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    playWaterDropSound();
    renderQuestion();
  }
}

function goNext() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    playWaterDropSound();
    renderQuestion();
  }
}

function jumpToIndex(idx) {
  if (idx >= 0 && idx < state.questions.length) {
    state.currentIndex = idx;
    playWaterDropSound();
    closeModal();
    renderQuestion();
  }
}

// --- Shuffle Function ---
function shuffleQuestions() {
  playWaterDropSound();
  for (let i = state.questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.questions[i], state.questions[j]] = [state.questions[j], state.questions[i]];
  }
  state.currentIndex = 0;
  renderQuestion();
}

// --- Submit Quiz & Calculate Results ---
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
  let unansCount = 0;

  state.questions.forEach(q => {
    const userChoice = state.quizAnswers[q.id];
    if (userChoice === undefined) {
      unansCount++;
    } else if (userChoice === q.answer) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const percent = Math.round((correctCount / total) * 100);

  // Render Celebration Results Card
  const container = document.getElementById('main-card-container');
  if (!container) return;

  const circumference = 408;
  const offset = circumference - (circumference * percent) / 100;

  let tier = "🌟 Outstanding Mastery!";
  let sub = "You have demonstrated stellar knowledge of Conservation Geography!";
  if (percent < 50) {
    tier = "🌱 Keep Practicing!";
    sub = "Try practice mode to build confidence on instant answers!";
  } else if (percent < 80) {
    tier = "👏 Great Achievement!";
    sub = "Solid understanding! A few more revisions will make it perfect.";
  }

  // Letters
  const letters = ['A', 'B', 'C', 'D'];

  // Review List
  let reviewHtml = '';
  state.questions.forEach((q, i) => {
    const userChoice = state.quizAnswers[q.id];
    const isCorrect = userChoice === q.answer;
    const isUnans = userChoice === undefined;

    reviewHtml += `
      <div class="review-item">
        <span class="review-q-num">Question ${i + 1} (Week ${q.week})</span>
        <div class="review-q-title">${q.question}</div>
        <div class="review-answer-row">
          <div class="review-your-ans ${isCorrect ? 'is-correct' : (isUnans ? '' : 'is-wrong')}">
            Your Choice: ${isUnans ? 'Unanswered ⚠️' : `Option ${letters[userChoice]} (${q.options[userChoice]})`}
          </div>
          <div class="review-correct-ans">
            Correct Answer: Option ${letters[q.answer]} (${q.options[q.answer]})
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="results-card">
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

      <h3 style="font-size: 1.1rem; margin-top: 10px; align-self: flex-start; color: #ffffff;">Detailed Question Review</h3>
      <div class="review-list-container">
        ${reviewHtml}
      </div>
    </div>
  `;

  // Attach button listeners
  document.getElementById('retry-quiz-btn')?.addEventListener('click', () => {
    state.quizAnswers = {};
    state.currentIndex = 0;
    startQuizTimer();
    renderQuestion();
  });

  document.getElementById('practice-scope-btn')?.addEventListener('click', () => {
    setMode('practice');
  });

  // Hide bottom dock during results review
  const dock = document.querySelector('.bottom-dock-container');
  if (dock) dock.style.display = 'none';
}

// --- Practice Summary View ---
function showPracticeSummary() {
  const container = document.getElementById('main-card-container');
  if (!container) return;

  const total = state.questions.length;
  const correct = state.practiceScore.correct;
  const wrong = state.practiceScore.wrong;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  playWaterDropSound(true);

  container.innerHTML = `
    <div class="results-card">
      <div class="water-logo" style="width: 60px; height: 60px; font-size: 32px;">💧</div>
      <div class="results-summary">
        <h2>Practice Completed!</h2>
        <p>You have practiced all questions in this set with instant answer reveals.</p>
      </div>

      <div class="stats-grid-row">
        <div class="stat-box">
          <span class="stat-value green">${correct}</span>
          <span class="stat-label">Correct</span>
        </div>
        <div class="stat-box">
          <span class="stat-value red">${wrong}</span>
          <span class="stat-label">Review Needed</span>
        </div>
        <div class="stat-box">
          <span class="stat-value blue">${percent}%</span>
          <span class="stat-label">Accuracy</span>
        </div>
      </div>

      <div class="results-actions">
        <button id="restart-practice-btn" class="full-btn primary-btn">
          <span>🔄 Practice Again</span>
        </button>
        <button id="try-quiz-btn" class="full-btn">
          <span>📝 Test in Quiz Mode</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('restart-practice-btn')?.addEventListener('click', () => {
    state.practiceAnswers = {};
    state.practiceScore = { correct: 0, wrong: 0 };
    state.currentIndex = 0;
    renderTopicBanner();
    renderQuestion();
  });

  document.getElementById('try-quiz-btn')?.addEventListener('click', () => {
    setMode('quiz');
  });
}

// --- Overview Modal Drawer ---
function openOverviewModal() {
  const modal = document.getElementById('overview-modal');
  const gridContainer = document.getElementById('grid-pills-container');
  if (!modal || !gridContainer) return;

  let pillsHtml = '';
  state.questions.forEach((q, idx) => {
    let pillClass = '';
    if (idx === state.currentIndex) {
      pillClass = 'current';
    } else if (state.mode === 'practice') {
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
      <button class="grid-pill-btn ${pillClass}" data-index="${idx}">
        ${idx + 1}
      </button>
    `;
  });

  gridContainer.innerHTML = pillsHtml;

  gridContainer.querySelectorAll('.grid-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      jumpToIndex(idx);
    });
  });

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('overview-modal');
  if (modal) modal.classList.remove('active');
}

// --- Keyboard Navigation ---
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // If modal is open, ignore or close on Escape
    if (e.key === 'Escape') {
      closeModal();
      return;
    }

    if (e.key === 'ArrowLeft') {
      goPrev();
    } else if (e.key === 'ArrowRight') {
      goNext();
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      const optIdx = parseInt(e.key, 10) - 1;
      handleOptionSelect(optIdx);
    } else if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
      const map = { a: 0, b: 1, c: 2, d: 3 };
      handleOptionSelect(map[e.key.toLowerCase()]);
    }
  });
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

  // Bottom dock buttons
  document.getElementById('dock-prev-btn')?.addEventListener('click', goPrev);
  document.getElementById('dock-center-pill')?.addEventListener('click', openOverviewModal);

  // Modal close buttons
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('overview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'overview-modal') closeModal();
  });

  initKeyboardShortcuts();

  // Start with All Weeks scope in Practice Mode
  setScope('all');
});
