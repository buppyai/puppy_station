/** Database module for Puppy Station - SQLite-based live data system */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');

let db = null;

/** Initialize the database and create tables if they don't exist */
function initDb() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Open database connection
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency

  // Create agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🐕',
      role TEXT DEFAULT 'Agent',
      model TEXT DEFAULT 'unknown',
      status TEXT DEFAULT 'idle',
      current_task TEXT DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      description TEXT NOT NULL,
      metadata_json TEXT DEFAULT '{}',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activities_agent_id ON activities(agent_id);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);
  `);

  // Create reviews table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      question TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME DEFAULT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `);

  // Create index for reviews
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_agent_id ON reviews(agent_id);
  `);

  console.log('✅ Database initialized at', DB_PATH);
  
  // Seed initial agents if table is empty
  seedInitialAgents();
  
  return db;
}

/** Seed initial agents if the database is empty */
function seedInitialAgents() {
  const count = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO agents (id, name, emoji, role, model, status, current_task)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const agents = [
      {
        id: 'buppy',
        name: 'Buppy',
        emoji: '🐕',
        role: 'Primary Coordinator',
        model: 'moonshot/kimi-k2.5',
        status: 'active',
        task: 'Coordinating agent fleet and managing Admin requests'
      },
      {
        id: 'zoomie',
        name: 'Zoomie',
        emoji: '⚡',
        role: 'AIGIS Lead Developer',
        model: 'nvidia/kimi-k2.5',
        status: 'active',
        task: 'Implementing iOS Screen Time integration for AIGIS Phase 2'
      },
      {
        id: 'mechly',
        name: 'Mechly',
        emoji: '🔧',
        role: 'Tool Builder & Infrastructure',
        model: 'moonshot/kimi-k2.5',
        status: 'active',
        task: 'Building Agent Dashboard UI and API endpoints'
      }
    ];

    for (const agent of agents) {
      insert.run(agent.id, agent.name, agent.emoji, agent.role, agent.model, agent.status, agent.task);
      logActivity(agent.id, 'system', `${agent.name} initialized and ready`, { source: 'database_seed' });
    }
    
    console.log('✅ Seeded initial agents');
    
    // Seed sample reviews
    seedSampleReviews();
  }
}

/** Seed sample reviews for demonstration */
function seedSampleReviews() {
  const insert = db.prepare(`
    INSERT INTO reviews (agent_id, question, priority, status)
    VALUES (?, ?, ?, ?)
  `);
  
  insert.run('zoomie', 'Should we use SwiftUI or UIKit for the AIGIS iOS enforcement module?', 'high', 'pending');
  insert.run('mechly', 'What database should we use for the agent session storage - SQLite or PostgreSQL?', 'medium', 'pending');
  insert.run('buppy', 'Should we add voice notifications for urgent reviews?', 'low', 'pending');
  
  console.log('✅ Seeded sample reviews');
}

/** Log an activity for an agent */
function logActivity(agentId, type, description, metadata = {}) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  const metadataJson = JSON.stringify(metadata);
  const stmt = db.prepare(`
    INSERT INTO activities (agent_id, type, description, metadata_json)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(agentId, type, description, metadataJson);
  
  // Update agent's last activity timestamp
  db.prepare(`
    UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(agentId);
  
  return result.lastInsertRowid;
}

/** Update an agent's current task */
function updateAgentTask(agentId, task) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  const stmt = db.prepare(`
    UPDATE agents 
    SET current_task = ?, status = 'active', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const result = stmt.run(task, agentId);
  
  if (result.changes > 0) {
    logActivity(agentId, 'task_update', `Updated task: ${task}`, { task });
  }
  
  return result.changes > 0;
}

/** Update an agent's status */
function updateAgentStatus(agentId, status) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  const stmt = db.prepare(`
    UPDATE agents 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  return stmt.run(status, agentId).changes > 0;
}

/** Get all agents with their current state */
function getAllAgents() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return db.prepare(`
    SELECT id, name, emoji, role, model, status, current_task, updated_at
    FROM agents
    ORDER BY name
  `).all();
}

/** Get a single agent by ID */
function getAgent(agentId) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return db.prepare(`
    SELECT id, name, emoji, role, model, status, current_task, updated_at
    FROM agents
    WHERE id = ?
  `).get(agentId);
}

/** Get recent activities with agent info */
function getRecentActivities(limit = 20) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return db.prepare(`
    SELECT 
      a.id, a.agent_id, a.type, a.description, a.metadata_json, a.timestamp,
      ag.name as agent_name, ag.emoji as agent_emoji
    FROM activities a
    JOIN agents ag ON a.agent_id = ag.id
    ORDER BY a.timestamp DESC
    LIMIT ?
  `).all(limit);
}

/** Get activities for a specific agent */
function getAgentActivities(agentId, limit = 20) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return db.prepare(`
    SELECT id, agent_id, type, description, metadata_json, timestamp
    FROM activities
    WHERE agent_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(agentId, limit);
}

/** Get pending reviews with agent info */
function getPendingReviews() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return db.prepare(`
    SELECT 
      r.id, r.agent_id, r.question, r.priority, r.status, r.created_at,
      ag.name as agent_name, ag.emoji as agent_emoji
    FROM reviews r
    JOIN agents ag ON r.agent_id = ag.id
    WHERE r.status = 'pending'
    ORDER BY 
      CASE r.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
        ELSE 4 
      END,
      r.created_at DESC
  `).all();
}

/** Add a new review */
function addReview(agentId, question, priority = 'medium') {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  const stmt = db.prepare(`
    INSERT INTO reviews (agent_id, question, priority, status)
    VALUES (?, ?, ?, 'pending')
  `);
  
  const result = stmt.run(agentId, question, priority);
  
  logActivity(agentId, 'review_created', `Created review: ${question.substring(0, 50)}...`, { 
    review_id: result.lastInsertRowid,
    priority 
  });
  
  return result.lastInsertRowid;
}

/** Resolve a review */
function resolveReview(reviewId) {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  const stmt = db.prepare(`
    UPDATE reviews 
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const result = stmt.run(reviewId);
  
  if (result.changes > 0) {
    const review = db.prepare('SELECT agent_id, question FROM reviews WHERE id = ?').get(reviewId);
    if (review) {
      logActivity(review.agent_id, 'review_resolved', `Resolved review: ${review.question.substring(0, 50)}...`, { 
        review_id: reviewId 
      });
    }
  }
  
  return result.changes > 0;
}

/** Get database stats for debugging */
function getStats() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  
  return {
    agents: db.prepare('SELECT COUNT(*) as count FROM agents').get(),
    activities: db.prepare('SELECT COUNT(*) as count FROM activities').get(),
    reviews: db.prepare('SELECT COUNT(*) as count FROM reviews').get(),
    pendingReviews: db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'").get()
  };
}

/** Close database connection */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDb,
  closeDb,
  logActivity,
  updateAgentTask,
  updateAgentStatus,
  getAllAgents,
  getAgent,
  getRecentActivities,
  getAgentActivities,
  getPendingReviews,
  addReview,
  resolveReview,
  getStats
};
