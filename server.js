const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const si = require('systeminformation');
const chokidar = require('chokidar');
const { 
  initDb, 
  logActivity, 
  updateAgentTask, 
  getAllAgents, 
  getAgent, 
  getRecentActivities, 
  getAgentActivities,
  getPendingReviews, 
  addReview, 
  resolveReview,
  updateAgentStatus
} = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Initialize database
let db;
try {
  db = initDb();
  console.log('✅ Database connected');
} catch (err) {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Activity logger middleware for agents
function logAgentActivity(agentId, type, description, metadata = {}) {
  try {
    const activityId = logActivity(agentId, type, description, metadata);
    const activity = {
      id: activityId,
      agent_id: agentId,
      type,
      description,
      metadata_json: JSON.stringify(metadata),
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'activity', agentId, activity });
    return activityId;
  } catch (err) {
    console.error('Failed to log activity:', err);
    return null;
  }
}

// API Routes
app.get('/api/agents', (req, res) => {
  try {
    const agents = getAllAgents();
    res.json(agents);
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents/:id', (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    console.error('Error fetching agent:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents/:id/activity', (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const activities = getAgentActivities(req.params.id, 20);
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update agent task endpoint
app.post('/api/agents/:id/task', (req, res) => {
  try {
    const { task } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }
    
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const success = updateAgentTask(req.params.id, task);
    if (success) {
      broadcast({ 
        type: 'task_update', 
        agentId: req.params.id, 
        task,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, task });
    } else {
      res.status(500).json({ error: 'Failed to update task' });
    }
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update agent status endpoint
app.post('/api/agents/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const success = updateAgentStatus(req.params.id, status);
    if (success) {
      logAgentActivity(req.params.id, 'status_change', `Status changed to ${status}`, { status });
      broadcast({ 
        type: 'status_update', 
        agentId: req.params.id, 
        status,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, status });
    } else {
      res.status(500).json({ error: 'Failed to update status' });
    }
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all activities (recent across all agents)
app.get('/api/activities', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = getRecentActivities(limit);
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: err.message });
  }
});

// System metrics endpoint
app.get('/api/system', async (req, res) => {
  try {
    const [cpu, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);
    
    res.json({
      cpu: {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus.length
      },
      memory: {
        used: Math.round(mem.used / 1024 / 1024 / 1024 * 100) / 100,
        total: Math.round(mem.total / 1024 / 1024 / 1024 * 100) / 100,
        percentage: Math.round(mem.used / mem.total * 100)
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('System metrics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reviews API
app.get('/api/reviews', (req, res) => {
  try {
    const reviews = getPendingReviews();
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const { agentId, question, priority } = req.body;
    if (!agentId || !question) {
      return res.status(400).json({ error: 'agentId and question are required' });
    }
    
    const agent = getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const reviewId = addReview(agentId, question, priority || 'medium');
    const review = {
      id: reviewId,
      agent_id: agentId,
      agent_name: agent.name,
      agent_emoji: agent.emoji,
      question,
      priority: priority || 'medium',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    broadcast({ type: 'review', review });
    res.status(201).json(review);
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reviews/:id/resolve', (req, res) => {
  try {
    const success = resolveReview(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    broadcast({ type: 'review-resolved', reviewId: req.params.id });
    res.json({ success: true, reviewId: req.params.id });
  } catch (err) {
    console.error('Error resolving review:', err);
    res.status(500).json({ error: err.message });
  }
});

// Log activity endpoint (for external agents to report activity)
app.post('/api/agents/:id/activity', (req, res) => {
  try {
    const { type, description, metadata } = req.body;
    if (!type || !description) {
      return res.status(400).json({ error: 'type and description are required' });
    }
    
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const activityId = logAgentActivity(req.params.id, type, description, metadata || {});
    res.status(201).json({ success: true, activityId });
  } catch (err) {
    console.error('Error logging activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// WebSocket connections
const clients = new Set();

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log('WebSocket client connected, total:', clients.size);
  
  // Send initial data
  try {
    const agents = getAllAgents();
    const reviews = getPendingReviews();
    ws.send(JSON.stringify({ type: 'init', agents, reviews }));
  } catch (err) {
    console.error('Error sending initial data:', err);
  }
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected, total:', clients.size);
  });
});

// Watch for file changes in workspace
const workspaceDir = path.join(require('os').homedir(), '.openclaw/workspace');
if (require('fs').existsSync(workspaceDir)) {
  const watcher = chokidar.watch([
    path.join(workspaceDir, '**/*.md'),
    path.join(workspaceDir, '**/*.json'),
    path.join(workspaceDir, 'agents/**/*.md')
  ], {
    ignored: /node_modules/,
    persistent: true,
    depth: 3
  });

  watcher.on('change', (filePath) => {
    const fileName = path.basename(filePath);
    
    // Detect which agent based on path
    let agentId = 'buppy';
    if (filePath.includes('zoomie')) agentId = 'zoomie';
    if (filePath.includes('mechly')) agentId = 'mechly';
    
    // Determine activity type
    let type = 'file_update';
    if (fileName.includes('SOUL')) type = 'soul_update';
    if (fileName.includes('IDENTITY')) type = 'identity_update';
    if (fileName.includes('config')) type = 'config_update';
    if (fileName.includes('MEMORY')) type = 'memory_update';
    
    logAgentActivity(agentId, type, `Updated ${fileName}`, { file: filePath });
  });
  
  console.log('✅ File watcher initialized for workspace changes');
}

// Simulate periodic system activity (reduced frequency for demo)
setInterval(() => {
  const commands = [
    'Checked system status',
    'Reviewed agent activities',
    'Updated configuration',
    'Processed user request',
    'Synced with OpenClaw gateway',
    'Polled for new messages',
    'Ran heartbeat check'
  ];
  
  const agents = ['buppy', 'zoomie', 'mechly'];
  const randomAgent = agents[Math.floor(Math.random() * agents.length)];
  const randomCommand = commands[Math.floor(Math.random() * commands.length)];
  
  logAgentActivity(randomAgent, 'command', randomCommand, { automated: true });
}, 60000); // Every 60 seconds

// Update system metrics periodically
setInterval(async () => {
  try {
    const [cpu, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);
    
    broadcast({
      type: 'system',
      data: {
        cpu: { usage: Math.round(cpu.currentLoad) },
        memory: {
          used: Math.round(mem.used / 1024 / 1024 / 1024 * 100) / 100,
          total: Math.round(mem.total / 1024 / 1024 / 1024 * 100) / 100,
          percentage: Math.round(mem.used / mem.total * 100)
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('System metrics error:', err);
  }
}, 5000);

server.listen(PORT, () => {
  console.log(`🐕 Puppy Station running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api/agents`);
  
  // Log startup activity
  logAgentActivity('buppy', 'system', 'Puppy Station dashboard started', { 
    version: require('./package.json').version,
    port: PORT
  });
});

module.exports = { logAgentActivity };
