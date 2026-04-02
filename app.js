// Cinematic Sites — Pipeline Controller
const PHASES = ['brand', 'image', 'audio', 'build', 'deploy'];
const PHASE_NAMES = {
  brand: 'Analyzing brand...',
  image: 'Generating visuals...',
  audio: 'Creating audio...',
  build: 'Assembling website...',
  deploy: 'Deploying...'
};

let currentPhase = -1;

// Node references
const nodes = {};
PHASES.forEach(p => {
  nodes[p] = {
    el: document.getElementById(`node-${p}`),
    dot: document.querySelector(`#node-${p} .status-dot`),
    text: document.querySelector(`#node-${p} .status-text`),
    fill: document.querySelector(`#node-${p} .node-progress-fill`)
  };
});

function setNodeState(phase, state, progress = 0, statusText = '') {
  const n = nodes[phase];
  if (!n) return;

  // Reset classes
  n.el.classList.remove('waiting', 'active', 'done', 'error');
  n.dot.classList.remove('waiting', 'active', 'done', 'error');

  n.el.classList.add(state);
  n.dot.classList.add(state);

  if (statusText) n.text.textContent = statusText;
  else {
    const labels = { waiting: 'Waiting', active: 'Processing...', done: 'Complete', error: 'Failed' };
    n.text.textContent = labels[state] || state;
  }

  n.fill.style.width = progress + '%';
}

function setConnector(fromIdx, state) {
  const id = `conn-${fromIdx + 1}-${fromIdx + 2}`;
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('done', 'active');
  if (state) el.classList.add(state);
}

// Show approval bar for brand phase
function showApproval(phase) {
  const bar = document.getElementById(`approval-${phase}`);
  if (bar) bar.classList.add('show');
}

function hideApproval(phase) {
  const bar = document.getElementById(`approval-${phase}`);
  if (bar) bar.classList.remove('show');
}

function approvePhase(phaseNum) {
  hideApproval('brand');
  setNodeState('brand', 'done', 100, 'Approved');
  setConnector(0, 'done');
  advancePipeline();
}

function rejectPhase(phaseNum) {
  setNodeState('brand', 'active', 30, 'Revising...');
  hideApproval('brand');
  // In real implementation, this would trigger re-analysis
}

// Simulate pipeline progression (replace with real webhook polling)
function advancePipeline() {
  currentPhase++;
  if (currentPhase >= PHASES.length) {
    // All done — show live URL
    document.getElementById('liveUrl').classList.add('show');
    return;
  }

  const phase = PHASES[currentPhase];
  setNodeState(phase, 'active', 0, PHASE_NAMES[phase]);

  if (currentPhase > 0) {
    setConnector(currentPhase - 1, 'active');
  }

  // Simulate progress (replace with real polling)
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setNodeState(phase, 'done', 100, 'Complete');
      if (currentPhase > 0) setConnector(currentPhase - 1, 'done');

      // Phase 1 needs approval
      if (phase === 'brand') {
        setNodeState(phase, 'done', 100, 'Awaiting approval');
        showApproval('brand');
        return;
      }

      // Auto-advance other phases
      setTimeout(() => advancePipeline(), 500);
    } else {
      setNodeState(phase, 'active', progress, PHASE_NAMES[phase]);
    }
  }, 800);
}

// Start button
document.getElementById('startBtn').addEventListener('click', () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) { document.getElementById('urlInput').focus(); return; }

  document.getElementById('startBtn').disabled = true;
  document.getElementById('startBtn').textContent = 'Building...';

  // Reset all nodes
  PHASES.forEach((p, i) => {
    setNodeState(p, 'waiting');
    if (i < PHASES.length - 1) {
      const conn = document.getElementById(`conn-${i + 1}-${i + 2}`);
      if (conn) conn.classList.remove('done', 'active');
    }
  });
  document.getElementById('liveUrl').classList.remove('show');

  currentPhase = -1;
  advancePipeline();
});

// Enter key
document.getElementById('urlInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('startBtn').click();
});
