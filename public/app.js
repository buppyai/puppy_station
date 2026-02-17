// Simple direct approach
let agents = [];
let reviews = [];

// Init
async function init() {
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
  
  // Fetch agents
  try {
    const res = await fetch('/api/agents');
    agents = await res.json();
    console.log('Fetched agents:', agents.length);
    renderAgents();

    // Fetch activities for all agents
    await renderActivities();

    // Fetch reviews
    const reviewsRes = await fetch('/api/reviews');
    reviews = await reviewsRes.json();
    renderReviews();
    
    // Fetch system
    const sysRes = await fetch('/api/system');
    const sysData = await sysRes.json();
    updateSystem(sysData);
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('debug-info').textContent = 'Error: ' + err.message;
  }
  
  // Refresh system every 5s
  setInterval(async () => {
    try {
      const res = await fetch('/api/system');
      updateSystem(await res.json());
    } catch (e) {}
  }, 5000);
}

function renderAgents() {
  const grid = document.getElementById('agentsGrid');
  const debug = document.getElementById('debug-info');
  
  if (debug) debug.textContent = `Rendering ${agents.length} agents...`;
  
  if (!agents || agents.length === 0) {
    grid.innerHTML = '<div class="empty-state">No agents found</div>';
    return;
  }
  
  let html = '';
  for (const agent of agents) {
    const modelName = agent.model ? (agent.model.split('/')[1] || agent.model) : 'Unknown';
    html += '<article class="agent-card ' + agent.id + '">';
    html += '<div class="agent-header">';
    html += '<span class="agent-avatar">' + (agent.emoji || '🐕') + '</span>';
    html += '<div class="agent-info"><h3>' + agent.name + '</h3></div>';
    html += '<span class="agent-status"><span class="status-dot"></span>' + agent.status + '</span>';
    html += '</div>';
    html += '<div class="agent-role-section">';
    html += '<div class="agent-role-label">Current Role</div>';
    html += '<div class="agent-role">' + agent.role + '</div>';
    html += '</div>';
    html += '<div class="agent-work-section">';
    html += '<div class="agent-work-label">🎯 Currently Working On</div>';
    html += '<div class="agent-work-content">' + (agent.summary || 'No activity') + '</div>';
    html += '</div>';
    html += '<div class="agent-meta"><span>🤖 ' + modelName + '</span></div>';
    html += '</article>';
  }
  
  grid.innerHTML = html;
  if (debug) debug.textContent = `Showing ${agents.length} agents`;
}

function renderReviews() {
  const list = document.getElementById('reviewList');
  if (!reviews || reviews.length === 0) {
    list.innerHTML = '<div class="empty-state">No questions pending review</div>';
    return;
  }

  let html = '';
  for (const r of reviews) {
    html += '<div class="review-item">';
    html += '<span class="review-avatar">' + r.agentEmoji + '</span>';
    html += '<div class="review-content">';
    html += '<div class="review-question">' + r.question + '</div>';
    html += '<div class="review-meta">';
    html += '<span class="review-agent">' + r.agentName + '</span>';
    html += '<span class="review-priority">' + r.priority + '</span>';
    html += '</div></div></div>';
  }
  list.innerHTML = html;
}

async function renderActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;

  // Collect activities from all agents
  let allActivities = [];
  for (const agent of agents) {
    try {
      const res = await fetch('/api/agents/' + agent.id + '/activity');
      const activities = await res.json();
      for (const act of activities) {
        allActivities.push({ ...act, agentName: agent.name, agentEmoji: agent.emoji });
      }
    } catch (e) {
      console.error('Failed to fetch activities for', agent.id, e);
    }
  }

  // Sort by timestamp (newest first)
  allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (allActivities.length === 0) {
    list.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }

  let html = '';
  for (const act of allActivities.slice(0, 10)) {
    const time = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    html += '<div class="activity-item">';
    html += '<span class="activity-emoji">' + (act.agentEmoji || '🐕') + '</span>';
    html += '<div class="activity-content">';
    html += '<div class="activity-desc">' + act.description + '</div>';
    html += '<div class="activity-meta">';
    html += '<span class="activity-agent">' + act.agentName + '</span>';
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

// Start
document.addEventListener('DOMContentLoaded', init);
