// Cinematic Sites — Pipeline Controller
const WEBHOOK_URL = 'https://n8n.srv1125818.hstgr.cloud/webhook/cinematic-sites';
const STATUS_URL = 'https://n8n.srv1125818.hstgr.cloud/webhook/cinematic-sites/status';

const PHASES = ['brand', 'image', 'audio', 'build', 'deploy'];
const PHASE_NAMES = {
  brand: 'Analyzing brand...',
  image: 'Generating visuals...',
  video: 'Animating video...',
  audio: 'Creating audio...',
  build: 'Assembling website...',
  deploy: 'Deploying...'
};

// Map backend currentPhase values to frontend phase index
const PHASE_MAP = { brand: 0, image: 1, video: 1, audio: 2, build: 3, deploy: 4, done: 5 };

let currentPhase = -1;
let execId = null;
let pollInterval = null;

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

function resetPipeline() {
  PHASES.forEach((p, i) => {
    setNodeState(p, 'waiting');
    if (i < PHASES.length - 1) {
      const conn = document.getElementById(`conn-${i + 1}-${i + 2}`);
      if (conn) conn.classList.remove('done', 'active');
    }
  });
  document.getElementById('liveUrl').classList.remove('show');
  hideApproval('brand');
  hideBrandCard();
  currentPhase = -1;
}

// Brand card display
function showBrandCard(brand) {
  const container = document.getElementById('output-brand');
  if (!container || !brand) return;
  container.innerHTML = `
    <div style="width:100%;background:#1A1A25;border-radius:8px;padding:12px;font-size:.75rem;line-height:1.5">
      <div style="font-weight:700;color:#E8E8F0;margin-bottom:6px">${brand.headline || ''}</div>
      <div style="color:#888899;margin-bottom:4px">${brand.tagline || ''}</div>
      <div style="color:#888899;margin-bottom:8px">${brand.story || ''}</div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        ${(brand.colors || []).map(c => `<div style="width:24px;height:24px;border-radius:4px;background:${c};border:1px solid #333" title="${c}"></div>`).join('')}
      </div>
      <div style="color:#555566;font-size:.625rem">Industry: ${brand.industry || '?'} | Theme: ${brand.theme || '?'}</div>
    </div>
  `;
  container.classList.add('show');
}

function hideBrandCard() {
  const container = document.getElementById('output-brand');
  if (container) { container.innerHTML = ''; container.classList.remove('show'); }
}

// Show image previews
function showImagePreviews(urls) {
  const container = document.getElementById('output-image');
  if (!container || !urls?.length) return;
  container.innerHTML = urls.map(url =>
    `<div class="output-thumb"><img src="${url}" alt="Generated image"></div>`
  ).join('');
  container.classList.add('show');
}

// Approval
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
}

function rejectPhase(phaseNum) {
  setNodeState('brand', 'active', 30, 'Revising...');
  hideApproval('brand');
}

// Update pipeline based on backend status
function updatePipelineFromStatus(data) {
  if (data.status === 'processing') {
    const backendPhase = data.currentPhase || 'brand';
    const phaseIdx = PHASE_MAP[backendPhase] ?? 0;

    // Mark previous phases as done
    for (let i = 0; i < phaseIdx && i < PHASES.length; i++) {
      setNodeState(PHASES[i], 'done', 100, 'Complete');
      if (i < PHASES.length - 1) setConnector(i, 'done');
    }

    // Mark current phase as active
    if (phaseIdx < PHASES.length) {
      const label = PHASE_NAMES[backendPhase] || PHASE_NAMES[PHASES[phaseIdx]] || 'Processing...';
      setNodeState(PHASES[phaseIdx], 'active', 50, label);
      if (phaseIdx > 0) setConnector(phaseIdx - 1, 'active');
    }
  }

  if (data.status === 'done') {
    stopPolling();

    if (data.success && !data.error) {
      // Show brand card
      if (data.brand) showBrandCard(data.brand);

      // Show image previews
      if (data.imageUrls?.length) showImagePreviews(data.imageUrls);

      // Mark completed phases
      const completedPhases = ['brand', 'image'];
      if (data.audioBase64) completedPhases.push('audio');
      else if (data.audioBase64 === '') completedPhases.push('audio'); // skipped but ok

      completedPhases.forEach((p, i) => {
        setNodeState(p, 'done', 100, 'Complete');
        if (i < completedPhases.length - 1) setConnector(i, 'done');
      });

      // Phases 4 & 5 (build + deploy) are manual for now
      setNodeState('build', 'waiting', 0, 'Ready — use Claude Code');
      setNodeState('deploy', 'waiting', 0, 'Ready — use Vercel CLI');

      document.getElementById('startBtn').disabled = false;
      document.getElementById('startBtn').textContent = 'BUILD CINEMATIC SITE';
    } else {
      // Error state
      const errorPhase = PHASES[Math.min(data.phase - 1, PHASES.length - 1)] || 'brand';
      setNodeState(errorPhase, 'error', 0, data.error || 'Failed');
      document.getElementById('startBtn').disabled = false;
      document.getElementById('startBtn').textContent = 'RETRY';
    }
  }

  if (data.status === 'error') {
    stopPolling();
    setNodeState('brand', 'error', 0, data.message || 'Workflow failed');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'RETRY';
  }
}

// Polling
function startPolling() {
  pollInterval = setInterval(async () => {
    if (!execId) return;
    try {
      const resp = await fetch(`${STATUS_URL}?id=${execId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      updatePipelineFromStatus(data);
    } catch (e) { /* retry next interval */ }
  }, 5000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// Start button
document.getElementById('startBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) { document.getElementById('urlInput').focus(); return; }
  if (!url.startsWith('http')) {
    document.getElementById('urlInput').value = 'https://' + url;
  }

  const notes = document.getElementById('notesInput').value.trim();

  document.getElementById('startBtn').disabled = true;
  document.getElementById('startBtn').textContent = 'Building...';
  resetPipeline();

  // Start Phase 1
  setNodeState('brand', 'active', 10, 'Analyzing brand...');

  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: document.getElementById('urlInput').value.trim(), notes })
    });
    if (!resp.ok) throw new Error(`Server error ${resp.status}`);
    const data = await resp.json();
    if (!data.executionId) throw new Error('No execution ID returned');

    execId = data.executionId;
    startPolling();
  } catch (err) {
    setNodeState('brand', 'error', 0, err.message || 'Connection failed');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'RETRY';
  }
});

// Enter key
document.getElementById('urlInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('startBtn').click();
});
