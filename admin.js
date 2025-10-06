import { auth } from './lib/auth.js';

class AdminDashboard {
  constructor() {
    this.currentPage = {
      users: 1,
      prompts: 1,
      anonymous: 1
    };
    this.pageSize = 50;
    this.filters = {
      dateRange: 'all',
      userType: 'all',
      tier: 'all',
      email: ''
    };
    
    this.init();
  }

  async init() {
    // Check if user is authorized admin
    if (!await this.checkAdminAccess()) {
      document.getElementById('access-denied').style.display = 'block';
      return;
    }

    document.getElementById('admin-content').style.display = 'block';
    
    // Load initial data
    await this.loadStats();
    await this.loadUsers();
    await this.loadPrompts();
    await this.loadAnonymousSessions();
  }

  async checkAdminAccess() {
    try {
      const user = auth.getUser();
      if (!user || user.email !== 'dalmomendonca@gmail.com') {
        return false;
      }

      // Verify with backend
      const response = await fetch('/.netlify/functions/admin-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken()
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Admin access check failed:', error);
      return false;
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/.netlify/functions/admin-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          filters: this.filters
        })
      });

      if (!response.ok) throw new Error('Failed to load stats');

      const stats = await response.json();
      
      document.getElementById('total-users').textContent = stats.totalUsers.toLocaleString();
      document.getElementById('total-prompts').textContent = stats.totalPrompts.toLocaleString();
      document.getElementById('credits-today').textContent = stats.creditsToday.toLocaleString();
      document.getElementById('active-subscriptions').textContent = stats.activeSubscriptions.toLocaleString();
      document.getElementById('anonymous-sessions').textContent = stats.anonymousSessions.toLocaleString();
      document.getElementById('estimated-revenue').textContent = `$${stats.estimatedRevenue.toLocaleString()}`;
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async loadUsers() {
    const container = document.getElementById('users-table-container');
    const loading = document.getElementById('users-loading');
    const errorDiv = document.getElementById('users-error');
    const tbody = document.getElementById('users-table-body');

    try {
      loading.style.display = 'block';
      container.style.display = 'none';
      errorDiv.style.display = 'none';

      const response = await fetch('/.netlify/functions/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          page: this.currentPage.users,
          pageSize: this.pageSize,
          filters: this.filters
        })
      });

      if (!response.ok) throw new Error('Failed to load users');

      const data = await response.json();
      
      tbody.innerHTML = '';
      data.users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.email}</td>
          <td>${user.name}</td>
          <td><span class="tier-badge tier-${user.account_tier}">${user.account_tier}</span></td>
          <td>${user.daily_credits_used}/${this.getCreditLimit(user.account_tier)}</td>
          <td><span class="status-${user.subscription_status || 'inactive'}">${user.subscription_status || 'None'}</span></td>
          <td>${new Date(user.created_at).toLocaleDateString()}</td>
          <td>${user.last_prompt ? new Date(user.last_prompt).toLocaleDateString() : 'Never'}</td>
        `;
        tbody.appendChild(row);
      });

      this.renderPagination('users', data.totalCount);
      
      loading.style.display = 'none';
      container.style.display = 'block';
    } catch (error) {
      console.error('Failed to load users:', error);
      loading.style.display = 'none';
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  }

  async loadPrompts() {
    const container = document.getElementById('prompts-table-container');
    const loading = document.getElementById('prompts-loading');
    const errorDiv = document.getElementById('prompts-error');
    const tbody = document.getElementById('prompts-table-body');

    try {
      loading.style.display = 'block';
      container.style.display = 'none';
      errorDiv.style.display = 'none';

      const response = await fetch('/.netlify/functions/admin-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          page: this.currentPage.prompts,
          pageSize: this.pageSize,
          filters: this.filters
        })
      });

      if (!response.ok) throw new Error('Failed to load prompts');

      const data = await response.json();
      
      tbody.innerHTML = '';
      data.prompts.forEach(prompt => {
        const row = document.createElement('tr');
        const userDisplay = prompt.user_email || `Anonymous (${prompt.session_token?.substring(0, 8)}...)`;
        const seedPreview = prompt.seed_idea.length > 50 ? 
          prompt.seed_idea.substring(0, 50) + '...' : prompt.seed_idea;
        
        row.innerHTML = `
          <td>${userDisplay}</td>
          <td>
            <div class="prompt-preview" title="${prompt.seed_idea}">${seedPreview}</div>
          </td>
          <td>${prompt.axis_a_name} × ${prompt.axis_b_name}</td>
          <td>${new Date(prompt.created_at).toLocaleString()}</td>
          <td>${prompt.credits_used}</td>
          <td>
            <button class="expand-btn" onclick="adminDashboard.viewPromptDetails('${prompt.id}')">
              View Details
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });

      this.renderPagination('prompts', data.totalCount);
      
      loading.style.display = 'none';
      container.style.display = 'block';
    } catch (error) {
      console.error('Failed to load prompts:', error);
      loading.style.display = 'none';
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  }

  async loadAnonymousSessions() {
    const container = document.getElementById('anonymous-table-container');
    const loading = document.getElementById('anonymous-loading');
    const errorDiv = document.getElementById('anonymous-error');
    const tbody = document.getElementById('anonymous-table-body');

    try {
      loading.style.display = 'block';
      container.style.display = 'none';
      errorDiv.style.display = 'none';

      const response = await fetch('/.netlify/functions/admin-anonymous', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          page: this.currentPage.anonymous,
          pageSize: this.pageSize,
          filters: this.filters
        })
      });

      if (!response.ok) throw new Error('Failed to load anonymous sessions');

      const data = await response.json();
      
      tbody.innerHTML = '';
      data.sessions.forEach(session => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${session.session_token.substring(0, 20)}...</td>
          <td>${session.credits_used}</td>
          <td>${session.ip_address || 'N/A'}</td>
          <td title="${session.user_agent}">${session.user_agent ? session.user_agent.substring(0, 50) + '...' : 'N/A'}</td>
          <td>${new Date(session.created_at).toLocaleString()}</td>
          <td>${new Date(session.expires_at).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
      });

      this.renderPagination('anonymous', data.totalCount);
      
      loading.style.display = 'none';
      container.style.display = 'block';
    } catch (error) {
      console.error('Failed to load anonymous sessions:', error);
      loading.style.display = 'none';
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  }

  renderPagination(type, totalCount) {
    const container = document.getElementById(`${type}-pagination`);
    const currentPage = this.currentPage[type];
    const totalPages = Math.ceil(totalCount / this.pageSize);

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    
    // Previous button
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="adminDashboard.changePage('${type}', ${currentPage - 1})">Previous</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      html += `<button onclick="adminDashboard.changePage('${type}', 1)">1</button>`;
      if (startPage > 2) html += '<span>...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === currentPage ? 'current-page' : ''}" onclick="adminDashboard.changePage('${type}', ${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += '<span>...</span>';
      html += `<button onclick="adminDashboard.changePage('${type}', ${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="adminDashboard.changePage('${type}', ${currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
  }

  changePage(type, page) {
    this.currentPage[type] = page;
    
    switch (type) {
      case 'users':
        this.loadUsers();
        break;
      case 'prompts':
        this.loadPrompts();
        break;
      case 'anonymous':
        this.loadAnonymousSessions();
        break;
    }
  }

  getCreditLimit(tier) {
    switch (tier) {
      case 'free': return 5;
      case 'premium': return 30;
      case 'pro': return 200;
      default: return 0;
    }
  }

  async viewPromptDetails(promptId) {
    try {
      const response = await fetch('/.netlify/functions/admin-prompt-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          promptId
        })
      });

      if (!response.ok) throw new Error('Failed to load prompt details');

      const prompt = await response.json();
      
      // Create modal or new window to show full prompt details
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      `;
      
      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 800px; max-height: 80vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>Prompt Details</h2>
            <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
          </div>
          <div style="margin-bottom: 15px;"><strong>Seed Idea:</strong> ${prompt.seed_idea}</div>
          <div style="margin-bottom: 15px;"><strong>Axes:</strong> ${prompt.axis_a_name} × ${prompt.axis_b_name}</div>
          <div style="margin-bottom: 15px;"><strong>Created:</strong> ${new Date(prompt.created_at).toLocaleString()}</div>
          <div style="margin-bottom: 20px;"><strong>Credits Used:</strong> ${prompt.credits_used}</div>
          <div><strong>Generated Prompts:</strong></div>
          <pre style="background: #f3f4f6; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 0.875rem; margin-top: 10px;">${JSON.stringify(prompt.generated_prompts, null, 2)}</pre>
        </div>
      `;
      
      modal.className = 'modal';
      document.body.appendChild(modal);
      
      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (error) {
      alert('Failed to load prompt details: ' + error.message);
    }
  }

  async exportData(type) {
    try {
      const response = await fetch('/.netlify/functions/admin-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: auth.getSessionToken(),
          type,
          filters: this.filters
        })
      });

      if (!response.ok) throw new Error('Failed to export data');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptsora2-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data: ' + error.message);
    }
  }
}

// Global functions for HTML onclick handlers
window.runMigration = async function() {
  const button = document.getElementById('run-migration-btn');
  const status = document.getElementById('migration-status');
  
  try {
    button.disabled = true;
    button.textContent = 'Running Migration...';
    status.style.display = 'block';
    status.style.background = '#fef3c7';
    status.style.color = '#92400e';
    status.textContent = 'Running database migration...';
    
    const response = await fetch('/.netlify/functions/run-migration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionToken: auth.getSessionToken()
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      status.style.background = '#d1fae5';
      status.style.color = '#065f46';
      status.textContent = result.message;
      
      // Reload data after successful migration
      setTimeout(() => {
        adminDashboard.loadStats();
        adminDashboard.loadUsers();
        adminDashboard.loadPrompts();
        adminDashboard.loadAnonymousSessions();
      }, 1000);
    } else {
      throw new Error(result.error || 'Migration failed');
    }
  } catch (error) {
    status.style.background = '#fee2e2';
    status.style.color = '#dc2626';
    status.textContent = 'Migration failed: ' + error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Run Database Migration';
  }
};

window.applyFilters = function() {
  adminDashboard.filters = {
    dateRange: document.getElementById('date-filter').value,
    userType: document.getElementById('user-type-filter').value,
    tier: document.getElementById('tier-filter').value,
    email: document.getElementById('email-search').value.trim()
  };
  
  // Reset to first page and reload all data
  adminDashboard.currentPage = { users: 1, prompts: 1, anonymous: 1 };
  adminDashboard.loadStats();
  adminDashboard.loadUsers();
  adminDashboard.loadPrompts();
  adminDashboard.loadAnonymousSessions();
};

window.exportData = function(type) {
  adminDashboard.exportData(type);
};

// Initialize dashboard
const adminDashboard = new AdminDashboard();
window.adminDashboard = adminDashboard;