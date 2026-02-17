const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize agents data
const agentsPath = path.join(DATA_DIR, 'agents.json');
if (!fs.existsSync(agentsPath)) {
  const initialAgents = {
    agents: [
      {
        id: 'buppy',
        name: 'Buppy',
        emoji: '🐕',
        role: 'Primary Coordinator',
        model: 'moonshot/kimi-k2.5',
        workspace: '~/.openclaw/workspace/',
        status: 'active',
        summary: 'Coordinating agent fleet and managing Admin requests',
        activities: [],
        lastActive: new Date().toISOString()
      },
      {
        id: 'zoomie',
        name: 'Zoomie',
        emoji: '⚡',
        role: 'AIGIS Lead Developer',
        model: 'nvidia/kimi-k2.5',
        workspace: '~/projects/aigis/',
        status: 'active',
        summary: 'Implementing iOS Screen Time integration for AIGIS Phase 2',
        activities: [],
        lastActive: new Date().toISOString()
      },
      {
        id: 'mechly',
        name: 'Mechly',
        emoji: '🔧',
        role: 'Tool Builder & Infrastructure',
        model: 'moonshot/kimi-k2.5',
        workspace: '~/.openclaw/workspace/projects/agent-dashboard/',
        status: 'active',
        summary: 'Building Agent Dashboard UI and API endpoints',
        activities: [],
        lastActive: new Date().toISOString()
      }
    ],
    systemMetrics: {
      tokensUsed: 0,
      lastReset: new Date().toISOString()
    }
  };
  fs.writeFileSync(agentsPath, JSON.stringify(initialAgents, null, 2));
}

// Read agents data
function readAgents() {
  return JSON.parse(fs.readFileSync(agentsPath, 'utf8'));
}

// Write agents data
function writeAgents(data) {
  fs.writeFileSync(agentsPath, JSON.stringify(data, null, 2));
}

// Reviews data
const reviewsPath = path.join(DATA_DIR, 'reviews.json');
if (!fs.existsSync(reviewsPath)) {
  const initialReviews = {
    reviews: [
      {
        id: '1',
        agentId: 'zoomie',
        agentName: 'Zoomie',
        agentEmoji: '⚡',
        question: 'Should we use SwiftUI or UIKit for the AIGIS iOS enforcement module?',
        priority: 'high',
        status: 'pending',
        timestamp: new Date().toISOString()
      },
      {
        id: '2',
        agentId: 'mechly',
        agentName: 'Mechly',
        agentEmoji: '🔧',
        question: 'What database should we use for the agent session storage - SQLite or PostgreSQL?',
        priority: 'medium',
        status: 'pending',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  };
  fs.writeFileSync(reviewsPath, JSON.stringify(initialReviews, null, 2));
}

function readReviews() {
  return JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
}

function writeReviews(data) {
  fs.writeFileSync(reviewsPath, JSON.stringify(data, null, 2));
}

// Add a review
function addReview(agentId, question, priority = 'medium') {
  const agents = readAgents();
  const agent = agents.agents.find(a => a.id === agentId);
  if (!agent) return null;

  const reviews = readReviews();
  const review = {
    id: Date.now().toString(),
    agentId,
    agentName: agent.name,
    agentEmoji: agent.emoji,
    question,
    priority,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  reviews.reviews.unshift(review);
  reviews.reviews = reviews.reviews.slice(0, 20); // Keep last 20
  writeReviews(reviews);
  
  broadcast({ type: 'review', review });
  return review;
}

// Resolve a review
function resolveReview(reviewId) {
  const reviews = readReviews();
  const review = reviews.reviews.find(r => r.id === reviewId);
  if (review) {
    review.status = 'resolved';
    review.resolvedAt = new Date().toISOString();
    writeReviews(reviews);
    broadcast({ type: 'review-resolved', reviewId });
  }
  return review;
}

// Add activity to agent
function addActivity(agentId, type, description, metadata = {}) {
  const data = readAgents();
  const agent = data.agents.find(a => a.id === agentId);
  if (agent) {
    agent.activities.unshift({
      id: Date.now().toString(),
      type,
      description,
      metadata,
      timestamp: new Date().toISOString()
    });
    // Keep only last 50 activities
    agent.activities = agent.activities.slice(0, 50);
    agent.lastActive = new Date().toISOString();
    writeAgents(data);
    broadcast({ type: 'activity', agentId, activity: agent.activities[0] });
  }
}

// Update agent summary
function updateSummary(agentId, summary) {
  const data = readAgents();
  const agent = data.agents.find(a => a.id === agentId);
  if (agent) {
    agent.summary = summary;
    agent.lastActive = new Date().toISOString();
    writeAgents(data);
    broadcast({ type: 'summary', agentId, summary });
  }
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Routes
app.get('/api/agents', (req, res) => {
  const data = readAgents();
  res.json(data.agents);
});

app.get('/api/agents/:id', (req, res) => {
  const data = readAgents();
  const agent = data.agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

app.get('/api/agents/:id/activity', (req, res) => {
  const data = readAgents();
  const agent = data.agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent.activities.slice(0, 20));
});

app.get('/api/system', async (req, res) => {
  try {
    const [cpu, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);
    
    const data = readAgents();
    
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
      tokens: data.systemMetrics.tokensUsed,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reviews API
app.get('/api/reviews', (req, res) => {
  const reviews = readReviews();
  res.json(reviews.reviews.filter(r => r.status === 'pending'));
});

app.post('/api/reviews', (req, res) => {
  const { agentId, question, priority } = req.body;
  if (!agentId || !question) {
    return res.status(400).json({ error: 'agentId and question are required' });
  }
  
  const review = addReview(agentId, question, priority || 'medium');
  if (!review) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  res.status(201).json(review);
});

app.patch('/api/reviews/:id/resolve', (req, res) => {
  const review = resolveReview(req.params.id);
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }
  res.json(review);
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

wss.on('connection', (ws) => {
  clients.add(ws);
  
  // Send initial data
  const data = readAgents();
  const reviews = readReviews();
  ws.send(JSON.stringify({ type: 'init', agents: data.agents, reviews: reviews.reviews.filter(r => r.status === 'pending') }));
  
  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Watch for file changes in workspace
const workspaceDir = path.join(require('os').homedir(), '.openclaw/workspace');
if (fs.existsSync(workspaceDir)) {
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
    
    addActivity(agentId, type, `Updated ${fileName}`, { file: filePath });
  });
}

// Simulate some activity for demo
setInterval(() => {
  const types = ['command', 'file_update', 'memory_update'];
  const commands = [
    'Checked system status',
    'Reviewed agent activities',
    'Updated configuration',
    'Processed user request',
    'Synced with OpenClaw gateway'
  ];
  
  const agents = ['buppy', 'zoomie', 'mechly'];
  const randomAgent = agents[Math.floor(Math.random() * agents.length)];
  const randomCommand = commands[Math.floor(Math.random() * commands.length)];
  
  addActivity(randomAgent, 'command', randomCommand);
}, 30000);

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
});

module.exports = { addActivity, updateSummary };
