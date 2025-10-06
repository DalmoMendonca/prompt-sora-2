import { auth } from './lib/auth.js';

const TESTS = [
  {
    id: 'length',
    name: 'Length',
    description: 'Shorter Prompt vs Longer Prompt',
    options: ['shorter prompt', 'longer prompt'],
  },
  {
    id: 'vibes',
    name: 'Vibes',
    description: 'Vibes & Feelings vs Concrete Details',
    options: ['mostly vibes / feelings', 'mostly concrete details'],
  },
  {
    id: 'tone',
    name: 'Tone',
    description: 'Serious vs Playful',
    options: ['serious', 'playful'],
  },
  {
    id: 'humor',
    name: 'Humor',
    description: 'Funny vs Serious',
    options: ['funny', 'serious/not funny'],
  },
  {
    id: 'creepy',
    name: 'Creep Factor',
    description: 'Creepy vs Not Creepy',
    options: ['creepy', 'not creepy'],
  },
  {
    id: 'realism',
    name: 'Realism',
    description: 'Documentary vs Stylized',
    options: ['realistic/documentary', 'stylized/surreal'],
  },
  {
    id: 'camera_stability',
    name: 'Camera',
    description: 'Handheld vs Tripod-Locked',
    options: ['handheld', 'tripod-locked'],
  },
  {
    id: 'camera_motion',
    name: 'Camera Motion',
    description: 'Static vs Push/Pan',
    options: ['static frame', 'subtle push/pan'],
  },
  {
    id: 'framing',
    name: 'Framing',
    description: 'Wide vs Tight',
    options: ['wide composition', 'tight close-ups'],
  },
  {
    id: 'lighting',
    name: 'Lighting',
    description: 'Flat Daylight vs Dramatic Colors',
    options: ['flat 5600K daylight', 'dramatic/colored gels'],
  },
  {
    id: 'color_palette',
    name: 'Color Palette',
    description: 'Muted vs High-Saturation',
    options: ['natural/muted', 'neon/high-saturation'],
  },
  {
    id: 'audio_focus',
    name: 'Audio Focus',
    description: 'Music vs Ambience/SFX',
    options: ['music-forward', 'ambience/sfx-forward'],
  },
  {
    id: 'dialogue',
    name: 'Dialogue',
    description: 'With Words vs Silent',
    options: ['spoken lines', 'silent'],
  },
  {
    id: 'overlays',
    name: 'Overlays',
    description: 'On-Screen Text vs No Text',
    options: ['with text overlays', 'no text overlays'],
  },
  {
    id: 'looping',
    name: 'Looping',
    description: 'Loop vs No Loop',
    options: ['seamless loop', 'no looping needed'],
  },
  {
    id: 'beats',
    name: 'Beat Structure',
    description: '2-Beat Arc vs 3-Beat Arc',
    options: ['2-beat', '3-beat'],
  },
  {
    id: 'effect_density',
    name: 'Effect Density',
    description: 'One vs Many',
    options: ['one signature effect', 'many micro-effects'],
  },
  {
    id: 'prop_strategy',
    name: 'Prop Strategy',
    description: 'Single vs Multiple',
    options: ['single prop', 'multiple props'],
  },
  {
    id: 'setting_scope',
    name: 'Setting Scope',
    description: 'Studio vs Real-World',
    options: ['neutral studio', 'real location'],
  },
  {
    id: 'transition_style',
    name: 'Transitions',
    description: 'Hard Cuts vs FX',
    options: ['hard cuts only', 'in-camera/FX transitions'],
  },
  {
    id: 'tempo',
    name: 'Tempo',
    description: 'Fast vs Chill',
    options: ['fast tempo (>120 BPM)', 'chill tempo (<100 BPM)'],
  },
  {
    id: 'cta_timing',
    name: 'CTA Timing',
    description: 'Early CTA vs Late CTA',
    options: ['early CTA (<5s)', 'late CTA (8–10s)'],
  },
  {
    id: 'hook_type',
    name: 'Hook Type',
    description: 'Visual vs Title Card',
    options: ['visual action hook', 'title card hook'],
  },
  {
    id: 'subject_count',
    name: 'Subject Count',
    description: 'Single vs Couple/Group',
    options: ['single subject', 'couple/group subjects'],
  },
  {
    id: 'focus',
    name: 'Creative Focus',
    description: 'Product vs Lifestyle',
    options: ['product-centered', 'lifestyle-centered'],
  },
];

const TEST_MAP = TESTS.reduce((map, test) => {
  map[test.id] = test;
  return map;
}, {});

const DEFAULT_AXIS_A_ID = 'length';
const DEFAULT_AXIS_B_ID = 'vibes';
const DEFAULT_BUTTON_LABEL = 'GENERATE VIDEO PROMPTS NOW';
const LOADING_BUTTON_LABEL = 'Crafting prompts...';

const form = document.getElementById('prompt-form');
const ideaInput = document.getElementById('idea');
const test1Select = document.getElementById('test-1');
const test2Select = document.getElementById('test-2');
const test1Detail = document.getElementById('test-1-detail');
const test2Detail = document.getElementById('test-2-detail');
const generateButton = document.getElementById('generate-btn');
generateButton.textContent = DEFAULT_BUTTON_LABEL;
const resultsSection = document.getElementById('results');
const gridElement = document.getElementById('grid');
const statusElement = document.getElementById('status');
const previewSection = document.getElementById('preview');
const previewBody = document.getElementById('preview-body');
const toastElement = document.getElementById('toast');
const cellTemplate = document.getElementById('cell-template');

let currentGrid = null;
let currentAxis = null;
let activeCellButton = null;
let toastTimeout = null;

// Auth elements
const signInBtn = document.getElementById('sign-in-btn');
const userMenu = document.getElementById('user-menu');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const signOutBtn = document.getElementById('sign-out-btn');
const creditsDisplay = document.getElementById('credits-display');
const creditsText = document.getElementById('credits-text');

populateSelect(test1Select, DEFAULT_AXIS_A_ID);
populateSelect(test2Select, DEFAULT_AXIS_B_ID);
enforceUniqueSelection(test1Select);
enforceUniqueSelection(test2Select);
updateTestDetail(test1Select, test1Detail);
updateTestDetail(test2Select, test2Detail);

// Initialize auth UI
initializeAuth();

// Check for regeneration data
checkForRegeneration();

function populateSelect(select, defaultId) {
  select.innerHTML = '';

  TESTS.forEach((test) => {
    const option = document.createElement('option');
    option.value = test.id;
    option.textContent = `${test.name.toUpperCase()}`;
    select.appendChild(option);
  });

  if (defaultId && TEST_MAP[defaultId]) {
    select.value = defaultId;
  }

  if (!select.value && select.options.length > 0) {
    select.value = select.options[0].value;
  }
}

[test1Select, test2Select].forEach((select) => {
  select.addEventListener('change', () => {
    const detailElement = select === test1Select ? test1Detail : test2Detail;
    updateTestDetail(select, detailElement);
    enforceUniqueSelection(select);
  });
});

function updateTestDetail(select, detailElement) {
  const chosen = TEST_MAP[select.value];
  detailElement.textContent = chosen ? chosen.description : '';
}

function enforceUniqueSelection(changedSelect) {
  const otherSelect = changedSelect === test1Select ? test2Select : test1Select;
  const selectedValue = changedSelect.value;

  Array.from(otherSelect.options).forEach((option) => {
    option.disabled = option.value === selectedValue;
  });

  if (otherSelect.value === selectedValue) {
    const fallback = Array.from(otherSelect.options).find((option) => !option.disabled);
    if (fallback) {
      otherSelect.value = fallback.value;
      const detailElement = otherSelect === test1Select ? test1Detail : test2Detail;
      updateTestDetail(otherSelect, detailElement);
    }
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const idea = ideaInput.value.trim();
  const axisAId = test1Select.value;
  const axisBId = test2Select.value;

  if (!idea) {
    showStatus('Describe your idea to begin.', true);
    ideaInput.focus();
    return;
  }

  if (!axisAId || !axisBId) {
    showStatus('Choose two different tests.', true);
    return;
  }

  if (axisAId === axisBId) {
    showStatus('Pick two distinct tests to explore contrast.', true);
    return;
  }

  const axisA = TEST_MAP[axisAId];
  const axisB = TEST_MAP[axisBId];

  // Check credits before generating
  try {
    const creditCheck = await auth.checkCredits();
    if (!creditCheck.canUse) {
      showStatus(`Credit limit reached (${creditCheck.used}/${creditCheck.limit}). ${creditCheck.tier === 'anonymous' ? 'Sign in for more credits!' : 'Upgrade your account for more credits.'}`, true);
      return;
    }
  } catch (error) {
    showStatus('Failed to check credits. Please try again.', true);
    return;
  }

  setLoading(true);
  showStatus('Generating...');
  resultsSection.classList.remove('hidden');
  gridElement.innerHTML = '';

  try {
    const response = await fetch('/.netlify/functions/generate-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idea,
        axisA: { id: axisA.id, name: axisA.name, options: axisA.options },
        axisB: { id: axisB.id, name: axisB.name, options: axisB.options },
        sessionToken: auth.getSessionToken(),
        userId: auth.getUser()?.id,
        useCredit: true
      }),
    });

    if (!response.ok) {
      const errorText = await extractError(response);
      throw new Error(errorText);
    }

    const data = await response.json();
    if (!Array.isArray(data.grid) || !Array.isArray(data.grid[0])) {
      throw new Error('Unexpected response format.');
    }

    currentGrid = data.grid;
    currentAxis = { axisA: data.axisA || axisA, axisB: data.axisB || axisB };
    
    // Save prompt to database for both logged-in and anonymous users
    try {
      await fetch('/.netlify/functions/save-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.isSignedIn() ? auth.getUser().id : null,
          sessionToken: auth.getSessionToken(),
          seedIdea: idea,
          axisAId: axisA.id,
          axisBId: axisB.id,
          axisAName: axisA.name,
          axisBName: axisB.name,
          generatedPrompts: { grid: currentGrid }
        })
      });
    } catch (error) {
      console.error('Failed to save prompt:', error);
      // Don't show error to user, just log it
    }

    renderGrid(currentGrid, currentAxis.axisA, currentAxis.axisB);
    showStatus('Tap to copy the full prompt', false, true);
    
    // Update credits display with a small delay to ensure database update is complete
    setTimeout(() => {
      updateCreditsDisplay();
    }, 500);
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Something went wrong. Try again.', true);
    gridElement.innerHTML = '';
    currentGrid = null;
    currentAxis = null;
  } finally {
    setLoading(false);
  }
});

function renderGrid(grid, axisA, axisB) {
  gridElement.innerHTML = '';
  activeCellButton = null;

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const clone = cellTemplate.content.firstElementChild.cloneNode(true);
      const axisAOption = axisA.options[colIndex];
      const axisBOption = axisB.options[rowIndex];
      const title = cell.title || `${axisAOption} x ${axisBOption}`;
      const prompt = cell.prompt || '';

      clone.dataset.row = rowIndex.toString();
      clone.dataset.col = colIndex.toString();
      clone.setAttribute('aria-label', `${title}. Copy prompt`);
      clone.querySelector('.axis-a-option').textContent = axisAOption;
      clone.querySelector('.axis-b-option').textContent = axisBOption;
      clone.addEventListener('click', () => handleCellSelection(clone, rowIndex, colIndex));

      gridElement.appendChild(clone);
    });
  });
}

function handleCellSelection(button, rowIndex, colIndex) {
  if (!currentGrid) return;
  const cellData = currentGrid[rowIndex]?.[colIndex];
  if (!cellData) return;

  if (activeCellButton) {
    activeCellButton.classList.remove('selected');
  }
  button.classList.add('selected');
  activeCellButton = button;

  const axisAOption = currentAxis.axisA.options[colIndex];
  const axisBOption = currentAxis.axisB.options[rowIndex];
  const title = cellData.title || `${axisAOption} x ${axisBOption}`;

  previewBody.textContent = cellData.prompt;
  previewSection.classList.remove('hidden');

  copyToClipboard(cellData.prompt.trim() + ' [Prompt optimized by promptsora2.com]')
    .then(() => showToast('Prompt copied to clipboard.'))
    .catch(() => showToast('Copy failed. Prompt ready below.', true));
}

function createPreview(prompt) {
  const condensed = prompt.replace(/\s+/g, ' ').trim();
  if (!condensed) return 'Prompt unavailable';
  return condensed.length > 160 ? `${condensed.slice(0, 157)}...` : condensed;
}

async function copyToClipboard(text) {
  if (!navigator.clipboard) {
    throw new Error('Clipboard API not supported');
  }
  await navigator.clipboard.writeText(text);
}

function showStatus(message, isError = false, isSuccess = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('error', Boolean(isError));
  statusElement.classList.toggle('success', Boolean(isSuccess));
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.textContent = isLoading ? LOADING_BUTTON_LABEL : DEFAULT_BUTTON_LABEL;
}

function showToast(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle('visible', true);
  toastElement.classList.toggle('error', isError);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastElement.classList.remove('visible');
    toastElement.classList.remove('error');
  }, 2600);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toastElement.classList.contains('visible')) {
    toastElement.classList.remove('visible');
    toastElement.classList.remove('error');
  }
});

async function extractError(response) {
  try {
    const data = await response.json();
    if (data && data.error) {
      return typeof data.error === 'string' ? data.error : data.error.message;
    }
  } catch (parseError) {
    // ignore
  }
  return `Request failed (${response.status}).`;
}

// Auth functions
function initializeAuth() {
  // Set up event listeners
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      auth.signInWithGoogle();
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      auth.signOut();
    });
  }

  // Update UI based on auth state
  updateAuthUI();
  updateCreditsDisplay();
}

function updateAuthUI() {
  const user = auth.getUser();
  const adminLink = document.getElementById('admin-link');
  
  if (user) {
    // User is signed in
    signInBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    userAvatar.src = user.avatar_url;
    userName.textContent = user.name;
    
    // Show admin link only for admin user
    if (adminLink) {
      adminLink.style.display = user.email === 'dalmomendonca@gmail.com' ? 'block' : 'none';
    }
  } else {
    // User is not signed in
    signInBtn.style.display = 'flex';
    userMenu.style.display = 'none';
    
    // Hide admin link
    if (adminLink) {
      adminLink.style.display = 'none';
    }
  }
}

async function updateCreditsDisplay() {
  try {
    const credits = await auth.checkCredits();
    creditsDisplay.style.display = 'flex';
    creditsText.textContent = `${credits.remaining}/${credits.limit}`;
    
    // Update color based on remaining credits
    if (credits.remaining === 0) {
      creditsDisplay.style.background = 'rgba(255, 140, 154, 0.1)';
      creditsDisplay.style.borderColor = 'rgba(255, 140, 154, 0.3)';
      creditsDisplay.style.color = 'var(--error)';
    } else if (credits.remaining <= 1) {
      creditsDisplay.style.background = 'rgba(245, 158, 11, 0.1)';
      creditsDisplay.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      creditsDisplay.style.color = 'var(--warning)';
    } else {
      creditsDisplay.style.background = 'rgba(87, 224, 165, 0.1)';
      creditsDisplay.style.borderColor = 'rgba(87, 224, 165, 0.3)';
      creditsDisplay.style.color = 'var(--success)';
    }
  } catch (error) {
    console.error('Failed to update credits display:', error);
  }
}

function checkForRegeneration() {
  const regenerateData = localStorage.getItem('regenerate_data');
  if (regenerateData) {
    try {
      const data = JSON.parse(regenerateData);
      
      // Fill in the form with the regeneration data
      ideaInput.value = data.idea;
      test1Select.value = data.axisA;
      test2Select.value = data.axisB;
      
      // Update details
      updateTestDetail(test1Select, test1Detail);
      updateTestDetail(test2Select, test2Detail);
      enforceUniqueSelection(test1Select);
      enforceUniqueSelection(test2Select);
      
      // Clear the regeneration data
      localStorage.removeItem('regenerate_data');
      
      // Show a message
      showToast('Prompt regenerated from your history!');
      
    } catch (error) {
      console.error('Failed to parse regeneration data:', error);
      localStorage.removeItem('regenerate_data');
    }
  }
}