# 🐕 Puppy Station

A minimalist, Apple-inspired dashboard for monitoring Buppy's agent fleet.

![Dashboard Preview](docs/preview.png)

## 🎨 Design Philosophy

- **Minimalist**: Maximum 5 widgets per screen
- **Apple-inspired**: Clever use of whitespace, rounded corners, soft colors
- **Functional**: Real-time updates, meaningful data at a glance
- **Accessible**: Dark/Light mode toggle

## 🚀 Quick Start

```bash
cd ~/projects/puppy_station
npm install
npm start
```

Open http://localhost:8080

## 📊 Features

### Per-Agent Tracking
- Activity feed (commands, memory updates, config changes)
- One-sentence work summary
- Current job role

### System Performance
- Token usage tracking
- Local system resources (CPU, Memory)

### UI Colors
- Background: `#f6f0e2` (cream)
- Default container: `#7ab6a9` (soft teal)
- Performance: `#f1623f` (coral)
- Work summary: `#72a0c1` (soft blue)
- Job role: `#e6a8d7` (soft pink)
- Accent: `#d3a96c` (gold)

## 🏗️ Architecture

```
puppy_station/
├── server.js          # Express + WebSocket server
├── public/            # Static assets
│   ├── index.html     # Main dashboard
│   ├── styles.css     # Apple-inspired design
│   └── app.js         # Frontend logic
├── data/              # Persistent data
│   └── agents.json    # Agent configurations
└── README.md          # This file
```

## 📝 API Endpoints

- `GET /api/agents` - List all agents
- `GET /api/agents/:id/activity` - Agent activity feed
- `GET /api/agents/:id/summary` - Current work summary
- `GET /api/system` - System performance metrics
- `WS /ws` - WebSocket for real-time updates

## 🐕 Agents Monitored

| Agent | Emoji | Role | Model |
|-------|-------|------|-------|
| Buppy | 🐕 | Primary Coordinator | moonshot/kimi-k2.5 |
| Zoomie | ⚡ | AIGIS Lead Developer | nvidia/kimi-k2.5 |
| Mechly | 🔧 | Tool Builder | moonshot/kimi-k2.5 |

## 🔄 Real-time Updates

The dashboard uses WebSocket connections to push updates:
- Activity feed updates
- System metrics
- Agent status changes

## 🌓 Dark/Light Mode

Click the toggle in the top-right corner to switch between:
- **Light**: Cream background (#f6f0e2)
- **Dark**: Deep charcoal (#1a1a1a)

## 📜 License

MIT - Built with 🦴 for the Agent Fleet
