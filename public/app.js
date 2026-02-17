// Puppy Station Dashboard
class PuppyStation {
  constructor() {
    this.ws = null;
    this.agents = [];
    this.activities = [];
    this.darkMode = localStorage.getItem('darkMode') === 'true';
    this.init();
  }

  init() {
    this.setupTheme();
    this.connectWebSocket();
    this.setupEventListeners();
    this.fetchInitialData();
    
    // Refresh system metrics every 5 seconds
    setInterval(() => this.fetchSystemMetrics(), 5000);
  }

  setupTheme() {
    if (this.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    this.updateThemeIcon();
  }

  setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', this.darkMode);
    
    if (this.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    this.updateThemeIcon();
  }

  updateThemeIcon() {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = this.darkMode ? '☀️' : '🌙';
  }

  connectWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🐕 Connected to Puppy Station');
      this.updateConnectionStatus(true);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from Puppy Station');
      this.updateConnectionStatus(false);
      // Reconnect after 3 seconds
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'init':
        this.agents = data.agents;
        this.renderAgents();
        break;
      case 'activity':
        this.addActivity(data.agentId, data.activity);
        break;
      case 'summary':
        this.updateAgentSummary(data.agentId, data.summary);
        break;
      case 'system':
        this.updateSystemMetrics(data.data);
        break;
    }
  }

  updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    status.style.color = connected ? '#3ddc84' : '#ff4444';
  }

  async fetchInitialData() {
    try {
      const [agentsRes, systemRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/system')
      ]);

      this.agents = await agentsRes.json();
      const systemData = await systemRes.json();

      this.renderAgents();
      this.updateSystemMetrics(systemData);
      
      // Fetch recent activities from all agents
      this.fetchAllActivities();
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  }

  async fetchAllActivities() {
    const activities = [];
    
    for (const agent of this.agents) {
      try {
        const res = await fetch(`/api/agents/${agent.id}/activity`);
        const agentActivities = await res.json();
        
        agentActivities.forEach(act => {
          activities.push({
            ...act,
            agentId: agent.id,
            agentName: agent.name,
            agentEmoji: agent.emoji
          });
        });
      } catch (err) {
        console.error(`Failed to fetch activities for ${agent.id}:`, err);
      }
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.activities = activities.slice(0, 10);
    this.renderActivities();
  }

  async fetchSystemMetrics() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      this.updateSystemMetrics(data);
    } catch (err) {
      console.error('Failed to fetch system metrics:', err);
    }
  }

  renderAgents() {
    const grid = document.getElementById('agentsGrid');
    
    grid.innerHTML = this.agents.map(agent => `
      <article class="agent-card ${agent.id}" data-agent-id="${agent.id}">
        <div class="agent-header">
          <span class="agent-avatar">${agent.emoji}</span>
          <div class="agent-info">
            <h3>${agent.name}</h3>
            <span class="agent-role">${agent.role}</span>
          </div>
          <span class="agent-status">
            <span class="status-dot"></span>
            ${agent.status}
          </span>
        </div>
        
        <div class="agent-summary">
          ${agent.summary || 'No current activity'}
        </div>
        
        <div class="agent-meta">
          <span>🤖 ${agent.model.split('/')[1] || agent.model}</span>
          <span>📁 ${this.shortenPath(agent.workspace)}</span>
        </div>
        
        <div class="agent-activity">
          <div class="activity-title">Recent Activity</div>
          ${this.renderAgentActivities(agent.activities?.slice(0, 3) || [])}
        </div>
      </article>
    `).join('');
  }

  renderAgentActivities(activities) {
    if (!activities || activities.length === 0) {
      return '<div class="empty-state">No recent activity</div>';
    }

    const activityIcons = {
      command: '⚡',
      file_update: '📝',
      soul_update: '💜',
      identity_update: '🆔',
      config_update: '⚙️',
      memory_update: '🧠'
    };

    return activities.map(act => `
      <div class="activity-item">
        <span class="activity-icon">${activityIcons[act.type] || '•'}</span>
        <span class="activity-text">${act.description}</span>
        <span class="activity-time">${this.formatTime(act.timestamp)}</span>
      </div>
    `).join('');
  }

  renderActivities() {
    const list = document.getElementById('activityList');
    
    if (this.activities.length === 0) {
      list.innerHTML = '<div class="empty-state">No recent activity</div>';
      return;
    }

    const activityIcons = {
      command: '⚡',
      file_update: '📝',
      soul_update: '💜',
      identity_update: '🆔',
      config_update: '⚙️',
      memory_update: '🧠'
    };

    list.innerHTML = this.activities.map(act => `
      <div class="activity-row">
        <span class="activity-agent">${act.agentEmoji} ${act.agentName}</span>
        <span class="activity-desc">${act.description}</span>
        <span class="activity-type">${act.type.replace('_', ' ')}</span>
      </div>
    `).join('');
  }

  addActivity(agentId, activity) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    // Add to agent's activities
    if (!agent.activities) agent.activities = [];
    agent.activities.unshift(activity);
    agent.activities = agent.activities.slice(0, 50);

    // Add to global activities
    this.activities.unshift({
      ...activity,
      agentId,
      agentName: agent.name,
      agentEmoji: agent.emoji
    });
    this.activities = this.activities.slice(0, 20);

    // Re-render
    this.renderAgents();
    this.renderActivities();
  }

  updateAgentSummary(agentId, summary) {
    const agent = this.agents.find(a => a.id === agentId);
    if (agent) {
      agent.summary = summary;
      this.renderAgents();
    }
  }

  updateSystemMetrics(data) {
    document.getElementById('cpuUsage').textContent = `${data.cpu.usage}%`;
    document.getElementById('memUsage').textContent = `${data.memory.used}/${data.memory.total} GB`;
    document.getElementById('tokenUsage').textContent = data.tokens?.toLocaleString() || '0';
    
    const cpuProgress = document.getElementById('cpuProgress');
    cpuProgress.style.width = `${Math.min(data.cpu.usage, 100)}%`;
  }

  shortenPath(path) {
    if (!path) return '';
    return path.replace(require('os').homedir(), '~');
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PuppyStation();
});
