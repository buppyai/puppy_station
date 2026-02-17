// Live Dashboard Data System for Puppy Station
let agents = [];
let reviews = [];
let activities = [];
let pollInterval = null;

// Init
async function init() {
  console.log('🐕 Initializing Puppy Station Dashboard...');
  
  // Theme
  const darkMode = localStorage.getItem('darkMode') === 'true';
  if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');
  
  // Toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.hasAttribute('data-theme');
    if (isDark) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('darkMode', !isDark);
  });
  
  // Initial data load
  await refreshAllData();
  
  // Start live polling every 5 seconds
  startLivePolling();
  
  // Refresh system metrics every 5 seconds
  setInterval(async () => {
    try {
      const res = await fetch('/api/system');
      updateSystem(await res.json());
    } catch (e) {
      console.error('System metrics error:', e);
    }
  }, 5000);
}

/** Fetch all data from the server */
async function refreshAllData() {
  try {
    // Fetch agents
    const agentsRes = await fetch('/api/agents');
    agents = await agentsRes.json();
    console.log('📊 Fetched', agents.length, 'agents');
    renderAgents();

    // Fetch all activities (live from DB)
    const activitiesRes = await fetch('/api/activities?limit=20');
    activities = await activitiesRes.json();
    console.log('📋 Fetched', activities.length, 'activities');
    renderActivities();

    // Fetch reviews
    const reviewsRes = await fetch('/api/reviews');
    reviews = await reviewsRes.json();
    console.log('👁️ Fetched', reviews.length, 'pending reviews');
    renderReviews();
    
    // Fetch system
    const sysRes = await fetch('/api/system');
    const sysData = await sysRes.json();
    updateSystem(sysData);
    
    updateDebugInfo(`Live data: ${agents.length} agents, ${activities.length} activities, ${reviews.length} reviews`);
  } catch (err) {
    console.error('❌ Error refreshing data:', err);
    updateDebugInfo('Error: ' + err.message);
  }
}

/** Start live polling for real-time updates */
function startLivePolling() {
  // Poll every 5 seconds
  pollInterval = setInterval(async () => {
    try {
      // Poll for new activities
      const activitiesRes = await fetch('/api/activities?limit=20');
      const newActivities = await activitiesRes.json();
      
      // Only update if data changed
      if (JSON.stringify(newActivities) !== JSON.stringify(activities)) {
        activities = newActivities;
        renderActivities();
        console.log('🔄 Activities updated:', activities.length);
      }
      
      // Poll for agent updates (tasks, status)
      const agentsRes = await fetch('/api/agents');
      const newAgents = await agentsRes.json();
      
      // Check if any agent data changed
      const hasChanges = JSON.stringify(newAgents) !== JSON.stringify(agents);
      if (hasChanges) {
        agents = newAgents;
        renderAgents();
        console.log('🔄 Agents updated');
      }
      
      // Poll for reviews
      const reviewsRes = await fetch('/api/reviews');
      const newReviews = await reviewsRes.json();
      
      if (JSON.stringify(newReviews) !== JSON.stringify(reviews)) {
        reviews = newReviews;
        renderReviews();
        console.log('🔄 Reviews updated:', reviews.length);
      }
      
      // Update debug timestamp
      updateDebugInfo(`Last sync: ${new Date().toLocaleTimeString()} | ${agents.length} agents, ${activities.length} activities, ${reviews.length} reviews`);
      
    } catch (err) {
      console.error('❌ Polling error:', err);
      updateDebugInfo('Sync error: ' + err.message);
    }
  }, 5000);
  
  console.log('🔄 Live polling started (5s interval)');
}

/** Stop live polling */
function stopLivePolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('⏹️ Live polling stopped');
  }
}

function renderAgents() {
  const grid = document.getElementById('agentsGrid');
  
  if (!agents || agents.length === 0) {
    grid.innerHTML = '<div class="empty-state">No agents found</div>';
    return;
  }
  
  let html = '';
  for (const agent of agents) {
    const modelName = agent.model ? (agent.model.split('/')[1] || agent.model) : 'Unknown';
    const currentTask = agent.current_task || 'No current task';
    const statusClass = agent.status === 'active' ? 'status-active' : 
                       agent.status === 'idle' ? 'status-idle' : 'status-busy';
    
    html += '<article class="agent-card ' + agent.id + '">';
    html += '<div class="agent-header">';
    html += '<span class="agent-avatar">' + (agent.emoji || '🐕') + '</span>';
    html += '<div class="agent-info"><h3>' + agent.name + '</h3></div>';
    html += '<span class="agent-status ' + statusClass + '"><span class="status-dot"></span>' + agent.status + '</span>';
    html += '</div>';
    
    html += '<div class="agent-role-section">';
    html += '<div class="agent-role-label">Current Role</div>';
    html += '<div class="agent-role">' + agent.role + '</div>';
    html += '</div>';
    
    // NEW: Current Task section
    html += '<div class="agent-task-section">';
    html += '<div class="agent-task-label">🎯 Current Task</div>';
    html += '<div class="agent-task-content">' + escapeHtml(currentTask) + '</div>';
    html += '</div>';
    
    html += '<div class="agent-work-section">';
    html += '<div class="agent-work-label">💼 Summary</div>';
    html += '<div class="agent-work-content">' + (agent.summary || 'No summary available') + '</div>';
    html += '</div>';
    
    html += '<div class="agent-meta"><span>🤖 ' + modelName + '</span>';
    html += '<span class="agent-updated">Updated: ' + formatTime(agent.updated_at) + '</span></div>';
    html += '</article>';
  }
  
  grid.innerHTML = html;
}

function renderReviews() {
  const list = document.getElementById('reviewList');
  if (!reviews || reviews.length === 0) {
    list.innerHTML = '<div class="empty-state">No questions pending review</div>';
    return;
  }

  let html = '';
  for (const r of reviews) {
    const priorityClass = r.priority === 'high' ? 'priority-high' : 
                         r.priority === 'medium' ? 'priority-medium' : 'priority-low';
    
    html += '<div class="review-item">';
    html += '<span class="review-avatar">' + (r.agent_emoji || '🐕') + '</span>';
    html += '<div class="review-content">';
    html += '<div class="review-question">' + escapeHtml(r.question) + '</div>';
    html += '<div class="review-meta">';
    html += '<span class="review-agent">' + (r.agent_name || 'Unknown') + '</span>';
    html += '<span class="review-priority ' + priorityClass + '">' + r.priority + '</span>';
    html += '<span class="review-time">' + formatTime(r.created_at) + '</span>';
    html += '</div></div></div>';
  }
  list.innerHTML = html;
}

function renderActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;

  if (!activities || activities.length === 0) {
    list.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }

  let html = '';
  for (const act of activities.slice(0, 15)) {
    const time = formatTime(act.timestamp);
    const typeIcon = getActivityIcon(act.type);
    
    html += '<div class="activity-item" data-type="' + act.type + '">';
    html += '<span class="activity-emoji">' + (act.agent_emoji || '🐕') + '</span>';
    html += '<div class="activity-content">';
    html += '<div class="activity-desc">' + typeIcon + ' ' + escapeHtml(act.description) + '</div>';
    html += '<div class="activity-meta">';
    html += '<span class="activity-agent">' + (act.agent_name || 'Unknown') + '</span>';
    html += '<span class="activity-type">' + act.type + '</span>';
    html += '<span class="activity-time">' + time + '</span>';
    html += '</div></div></div>';
  }
  list.innerHTML = html;
}

function updateSystem(data) {
  document.getElementById('cpuUsage').textContent = data.cpu.usage + '%';
  document.getElementById('memUsage').textContent = data.memory.used + '/' + data.memory.total + ' GB';
  document.getElementById('tokenUsage').textContent = (data.tokens || 0).toLocaleString();
  document.getElementById('cpuProgress').style.width = Math.min(data.cpu.usage, 100) + '%';
}

/** Get icon for activity type */
function getActivityIcon(type) {
  const icons = {
    'command': '⌨️',
    'file_update': '📝',
    'memory_update': '🧠',
    'soul_update': '✨',
    'identity_update': '🆔',
    'config_update': '⚙️',
    'task_update': '📋',
    'review_created': '👁️',
    'review_resolved': '✅',
    'status_change': '📡',
    'system': '🔧',
    'error': '❌',
    'info': 'ℹ️'
  };
  return icons[type] || '📌';
}

/** Format timestamp for display */
function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  
  return date.toLocaleDateString();
}

/** Escape HTML to prevent XSS */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Update debug info display */
function updateDebugInfo(message) {
  const debugEl = document.getElementById('debug-info');
  if (debugEl) {
    debugEl.textContent = message;
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopLivePolling();
});
