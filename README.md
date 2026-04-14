# CDT Timeline - Project Tracker

A full-stack project timeline tracker with Gantt chart, task management, and team coordination features.

## Features

- **Gantt Chart View** - Visualize planned vs actual task timelines
- **Multiple Views** - List, Board, and Kanban views for task management
- **Project Management** - Create, edit, and delete projects
- **Task Tracking** - Comprehensive task management with dates, status, and person in charge
- **KPI Dashboard** - Track project progress and achievement metrics
- **PDF Export** - Generate project reports as PDF
- **Responsive Design** - Works on desktop and tablet devices
- **Offline Support** - Local cache for offline access to last-loaded data

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript + SQLite
- **Authentication**: JWT tokens
- **Database**: SQLite with file-based storage

## Project Structure

```
cdt-timeline/
├── server/                 # Express backend
│   ├── src/
│   │   ├── index.ts       # Server entry point
│   │   ├── db/            # Database layer
│   │   ├── middleware/    # Auth middleware
│   │   └── routes/        # API endpoints
│   ├── data/              # SQLite database (gitignored)
│   └── package.json
├── client/                 # React frontend
│   ├── src/
│   │   ├── main.tsx       # React root
│   │   ├── project_tracker.tsx  # Main app component
│   │   ├── api/           # API client
│   │   └── auth/          # Auth context & login
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── .env                    # Configuration
└── package.json           # Root package.json
```

## Setup

### Prerequisites

- Node.js 18+ (npm or yarn)
- No database installation needed (uses SQLite)

### Installation

1. Clone the repository

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install server dependencies:
   ```bash
   cd server && npm install && cd ..
   ```

4. Install client dependencies:
   ```bash
   cd client && npm install && cd ..
   ```

### Configuration

The `.env` file contains:
- `JWT_SECRET` - JWT signing secret (change in production)
- `ADMIN_USER` - Default admin username
- `ADMIN_PASS` - Default admin password
- `PORT` - Server port (default 3001)
- `DB_PATH` - SQLite database file location
- `NODE_ENV` - Environment (development/production)

## Running

### Development Mode (recommended for local testing)

Run both server and client with hot reload:

```bash
npm run dev
```

This runs:
- Server on http://localhost:3001
- Client on http://localhost:5173
- API requests are proxied from client to server

The Vite dev server proxies `/api/*` requests to the backend server.

### Individual Development Servers

Run server only:
```bash
npm run server:dev
```

Run client only:
```bash
npm run client:dev
```

### Production Build

Build both frontend and backend:
```bash
npm run build
```

Start production server:
```bash
npm start
```

The server will:
- Listen on port 3001
- Serve the built React app as static files
- Run the Express API

Visit http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/me` - Get current user info

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/projects/:projectId/tasks` - List tasks in project
- `POST /api/projects/:projectId/tasks` - Create task
- `PUT /api/projects/:projectId/tasks/:taskId` - Update task
- `DELETE /api/projects/:projectId/tasks/:taskId` - Delete task
- `PATCH /api/projects/:projectId/tasks/:taskId/toggle` - Toggle task done status

All endpoints (except login) require `Authorization: Bearer <token>` header.

## Default Login

- **Username**: `admin`
- **Password**: `password123`

These are created on first database initialization (see `.env` file).

## Key Features

### Gantt Chart View
- Visual timeline of planned vs actual task dates
- Color-coded bars for different statuses
- Today indicator with red line
- Horizontal scrolling for large timelines

### Task Management
- Full task details: subject, dates (plan/actual), person in charge, status
- Automatic status calculation (Done, Delayed, In Progress, Overdue, Planned)
- Quick toggle for task completion
- Drag-and-drop support in future versions

### KPI Dashboard
- % Target YTD - Tasks due by date
- % Actual YTD - Tasks completed
- % Achievement YTD - Actual ÷ Target ratio
- Plan Completion - Projected project end date
- % BE Achievement - On-time completion rate

### PDF Export
- Generate professional project reports
- Includes all task details and KPI metrics
- Multi-page support for large projects

## Offline Support

The app caches data to `localStorage` under key `tracker_offline`. If the server is unavailable, cached data will be displayed. Once the server is back online, live data will be fetched and cached again.

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use
- Verify `.env` file exists
- Check database permissions for `server/data/` directory

### Client can't connect to API
- Verify server is running on port 3001
- Check browser DevTools Network tab for API call details
- Ensure CORS is enabled (should work with default config)

### Database issues
- Delete `server/data/tracker.db` to reset database
- On next start, a new database with seeded data will be created

### Clear offline cache
- Open DevTools > Application > Local Storage
- Delete `tracker_offline` and `tracker_token` entries
- Refresh the page

## Development Notes

- Frontend changes hot-reload automatically in dev mode
- Backend changes require server restart (but `npm run server:dev` uses tsx watch which auto-restarts)
- All dates are stored in `YYYY-MM-DD` format
- Task status is computed dynamically (not stored)
- Timeline range is calculated from task dates with 1-month padding

## License

ISC
