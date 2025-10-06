import { auth } from './lib/auth.js';

// DOM elements
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const signOutBtn = document.getElementById('sign-out-btn');
const creditsDisplay = document.getElementById('credits-display');
const creditsText = document.getElementById('credits-text');

const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const tierBadge = document.getElementById('tier-badge');
const tierDescription = document.getElementById('tier-description');

const totalPromptsEl = document.getElementById('total-prompts');
const creditsRemainingEl = document.getElementById('credits-remaining');
const daysActiveEl = document.getElementById('days-active');

const promptsLoading = document.getElementById('prompts-loading');
const promptsEmpty = document.getElementById('prompts-empty');
const promptsGrid = document.getElementById('prompts-grid');

const searchInput = document.getElementById('search-prompts');
const sortSelect = document.getElementById('sort-prompts');

// Modals
const comingSoonModal = document.getElementById('coming-soon-modal');
const promptModal = document.getElementById('prompt-modal');
const notifyBtn = document.getElementById('notify-btn');
const notifyEmail = document.getElementById('notify-email');

let allPrompts = [];
let filteredPrompts = [];

// Initialize page
async function initializePage() {
  // Check if user is signed in
  const user = auth.getUser();
  if (!user) {
    window.location.href = '/';
    return;
  }

  // Update UI with user info
  updateUserUI(user);
  
  // Load user data
  await Promise.all([
    updateCreditsDisplay(),
    loadUserStats(),
    loadPromptHistory()
  ]);

  // Set up event listeners
  setupEventListeners();
}

function updateUserUI(user) {
  userAvatar.src = user.avatar_url;
  userName.textContent = user.name;
  
  profileAvatar.src = user.avatar_url;
  profileName.textContent = user.name;
  profileEmail.textContent = user.email;
  
  // Show admin link only for admin user
  const adminLink = document.getElementById('admin-link');
  if (adminLink) {
    adminLink.style.display = user.email === 'dalmomendonca@gmail.com' ? 'block' : 'none';
  }
  
  // Update tier badge
  const tier = user.account_tier || 'free';
  tierBadge.textContent = tier.toUpperCase();
  tierBadge.className = `tier-badge ${tier}`;
  
  const tierLimits = {
    free: '5 credits per day',
    premium: '30 credits per day',
    pro: '200 credits per day'
  };
  tierDescription.textContent = tierLimits[tier];

  // Update pricing cards based on current tier
  updatePricingCards(tier);
}

function updatePricingCards(currentTier) {
  // Remove current class from all cards
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.classList.remove('current');
  });

  // Add current class to the user's tier
  const currentCard = document.querySelector(`.pricing-card.${currentTier}`);
  if (currentCard) {
    currentCard.classList.add('current');
  }

  // Update buttons based on tier
  const currentPlanBtn = document.getElementById('current-plan-btn');
  
  if (currentTier !== 'free') {
    currentPlanBtn.textContent = 'Manage Subscription';
    currentPlanBtn.onclick = handleManageSubscription;
    currentPlanBtn.classList.remove('current-plan');
    currentPlanBtn.classList.add('manage-subscription');
  }

  // Hide upgrade buttons for current or higher tiers
  document.querySelectorAll('.upgrade-btn').forEach(btn => {
    const btnTier = btn.dataset.tier;
    if (
      (currentTier === 'premium' && btnTier === 'premium') ||
      (currentTier === 'pro' && (btnTier === 'premium' || btnTier === 'pro'))
    ) {
      btn.textContent = 'Current Plan';
      btn.disabled = true;
      btn.classList.add('current-plan');
    }
  });
}

async function updateCreditsDisplay() {
  try {
    const credits = await auth.checkCredits();
    creditsDisplay.style.display = 'flex';
    creditsText.textContent = `${credits.remaining}/${credits.limit}`;
    creditsRemainingEl.textContent = credits.remaining;
    
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

async function loadUserStats() {
  try {
    const response = await fetch('/.netlify/functions/get-user-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: auth.getUser().id
      })
    });

    if (response.ok) {
      const stats = await response.json();
      totalPromptsEl.textContent = stats.totalPrompts || 0;
      daysActiveEl.textContent = stats.daysActive || 0;
    }
  } catch (error) {
    console.error('Failed to load user stats:', error);
  }
}

async function loadPromptHistory() {
  try {
    promptsLoading.style.display = 'flex';
    promptsEmpty.style.display = 'none';
    promptsGrid.innerHTML = '';

    const response = await fetch('/.netlify/functions/get-user-prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: auth.getUser().id
      })
    });

    if (response.ok) {
      const data = await response.json();
      allPrompts = data.prompts || [];
      filteredPrompts = [...allPrompts];
      
      promptsLoading.style.display = 'none';
      
      if (allPrompts.length === 0) {
        promptsEmpty.style.display = 'flex';
      } else {
        renderPrompts();
      }
    } else {
      throw new Error('Failed to load prompts');
    }
  } catch (error) {
    console.error('Failed to load prompt history:', error);
    promptsLoading.style.display = 'none';
    promptsEmpty.style.display = 'flex';
  }
}

function renderPrompts() {
  promptsGrid.innerHTML = '';
  
  filteredPrompts.forEach(prompt => {
    const card = createPromptCard(prompt);
    promptsGrid.appendChild(card);
  });
}

function createPromptCard(prompt) {
  const card = document.createElement('div');
  card.className = 'prompt-card';
  card.onclick = () => showPromptDetail(prompt);
  
  const date = new Date(prompt.created_at).toLocaleDateString();
  
  card.innerHTML = `
    <div class="prompt-card-header">
      <div class="prompt-date">${date}</div>
      <div class="prompt-axes">
        <span>${prompt.axis_a_name}</span>
        <span>×</span>
        <span>${prompt.axis_b_name}</span>
      </div>
    </div>
    <div class="prompt-seed">${prompt.seed_idea}</div>
    <div class="prompt-preview-grid">
      ${prompt.generated_prompts.grid.flat().map((cell, i) => `
        <div class="prompt-preview-cell">
          ${cell.title || `Variant ${i + 1}`}
        </div>
      `).join('')}
    </div>
  `;
  
  return card;
}

function showPromptDetail(prompt) {
  document.getElementById('prompt-modal-title').textContent = 'Prompt Details';
  document.getElementById('prompt-seed-text').textContent = prompt.seed_idea;
  document.getElementById('prompt-axis-a').textContent = prompt.axis_a_name;
  document.getElementById('prompt-axis-b').textContent = prompt.axis_b_name;
  
  const modalGrid = document.getElementById('modal-prompt-grid');
  modalGrid.innerHTML = '';
  
  prompt.generated_prompts.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellEl = document.createElement('div');
      cellEl.className = 'modal-grid-cell';
      cellEl.onclick = () => copyPrompt(cell.prompt);
      
      cellEl.innerHTML = `
        <h4>${cell.title}</h4>
        <p>${cell.prompt}</p>
      `;
      
      modalGrid.appendChild(cellEl);
    });
  });
  
  // Set up action buttons
  document.getElementById('regenerate-btn').onclick = () => regeneratePrompt(prompt);
  document.getElementById('copy-seed-btn').onclick = () => copySeedIdea(prompt.seed_idea);
  
  showModal(promptModal);
}

async function regeneratePrompt(prompt) {
  // Store the seed idea and axes in localStorage for the main page
  localStorage.setItem('regenerate_data', JSON.stringify({
    idea: prompt.seed_idea,
    axisA: prompt.axis_a_id,
    axisB: prompt.axis_b_id
  }));
  
  // Redirect to main page
  window.location.href = '/';
}

async function copySeedIdea(seedIdea) {
  try {
    await navigator.clipboard.writeText(seedIdea);
    showToast('Seed idea copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy seed idea:', error);
    showToast('Failed to copy seed idea', true);
  }
}

async function copyPrompt(prompt) {
  try {
    await navigator.clipboard.writeText(prompt + ' [Prompt optimized by SORA² NEXUS - promptsora2.com]');
    showToast('Prompt copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy prompt:', error);
    showToast('Failed to copy prompt', true);
  }
}

function setupEventListeners() {
  // Sign out
  signOutBtn.addEventListener('click', () => {
    auth.signOut();
  });

  // Search and sort
  searchInput.addEventListener('input', filterPrompts);
  sortSelect.addEventListener('change', filterPrompts);

  // Upgrade buttons
  document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tier = btn.dataset.tier;
      await handleUpgrade(tier);
    });
  });

  // Modal controls
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      hideModal(e.target.closest('.modal'));
    });
  });

  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideModal(modal);
      }
    });
  });

  // Notify button
  notifyBtn.addEventListener('click', async () => {
    const email = notifyEmail.value.trim();
    if (!email) return;

    try {
      const response = await fetch('/.netlify/functions/notify-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        document.querySelector('.notify-success').classList.remove('hidden');
        notifyEmail.value = '';
        notifyBtn.textContent = 'Notified!';
        notifyBtn.disabled = true;
      }
    } catch (error) {
      console.error('Failed to sign up for notifications:', error);
    }
  });
}

function filterPrompts() {
  const searchTerm = searchInput.value.toLowerCase();
  const sortBy = sortSelect.value;

  // Filter by search term
  filteredPrompts = allPrompts.filter(prompt => 
    prompt.seed_idea.toLowerCase().includes(searchTerm) ||
    prompt.axis_a_name.toLowerCase().includes(searchTerm) ||
    prompt.axis_b_name.toLowerCase().includes(searchTerm)
  );

  // Sort
  filteredPrompts.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  renderPrompts();
}

function showModal(modal) {
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('visible'), 10);
}

function hideModal(modal) {
  modal.classList.remove('visible');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleUpgrade(tier) {
  try {
    const user = auth.getUser();
    if (!user) {
      showToast('Please sign in to upgrade', true);
      return;
    }

    // Show loading state
    const btn = document.querySelector(`[data-tier="${tier}"]`);
    const originalText = btn.textContent;
    btn.textContent = 'Creating checkout...';
    btn.disabled = true;

    // Create Stripe checkout session
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        tier: tier
      })
    });

    if (response.ok) {
      const { url } = await response.json();
      // Redirect to Stripe checkout
      window.location.href = url;
    } else {
      throw new Error('Failed to create checkout session');
    }

  } catch (error) {
    console.error('Upgrade error:', error);
    showToast('Failed to start upgrade process. Please try again.', true);
    
    // Reset button
    const btn = document.querySelector(`[data-tier="${tier}"]`);
    btn.textContent = `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
    btn.disabled = false;
  }
}

async function handleManageSubscription() {
  try {
    const user = auth.getUser();
    if (!user) return;

    const response = await fetch('/.netlify/functions/create-customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id
      })
    });

    if (response.ok) {
      const { url } = await response.json();
      window.location.href = url;
    } else {
      throw new Error('Failed to create customer portal session');
    }

  } catch (error) {
    console.error('Manage subscription error:', error);
    showToast('Failed to open subscription management. Please try again.', true);
  }
}

function showToast(message, isError = false) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : 'success'}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('visible'), 10);
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

// Check for upgrade success/failure on page load
function checkUpgradeStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const upgrade = urlParams.get('upgrade');
  const tier = urlParams.get('tier');

  if (upgrade === 'success' && tier) {
    showToast(`Successfully upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    // Reload user data
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } else if (upgrade === 'cancelled') {
    showToast('Upgrade cancelled', true);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Initialize when page loads
initializePage();
checkUpgradeStatus();