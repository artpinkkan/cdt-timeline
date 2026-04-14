import bcryptjs from 'bcryptjs';
import { db, User, Project, Task } from './client';

export async function migrate() {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      ir_code TEXT,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      plan_start TEXT,
      plan_end TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      plan_start TEXT,
      plan_end TEXT,
      act_start TEXT,
      act_end TEXT,
      pic TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Add plan_start / plan_end to projects if missing (idempotent)
  try { await db.run('ALTER TABLE projects ADD COLUMN plan_start TEXT'); } catch {}
  try { await db.run('ALTER TABLE projects ADD COLUMN plan_end TEXT'); } catch {}

  // Create indexes for common query patterns (idempotent)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort_order  ON tasks(project_id, sort_order);
  `);

  // Check if admin user already exists
  const adminUser = await db.get('SELECT * FROM users WHERE username = ?', [process.env.ADMIN_USER || 'admin']);

  if (!adminUser) {
    const hashedPassword = await bcryptjs.hash(process.env.ADMIN_PASS || 'password123', 10);
    const now = new Date().toISOString();

    // Create admin user
    const result = await db.run(
      'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
      [process.env.ADMIN_USER || 'admin', hashedPassword, now]
    );

    console.log('✓ Created default admin user');

    const userId = result.lastID;

    // Seed the default project
    const projectResult = await db.run(
      `INSERT INTO projects (user_id, name, ir_code, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, 'Regulatory Information Management', 'IR-CRA-2025-001', 'Kalbe RIM system implementation', '#3B82F6', now]
    );

    const projectId = projectResult.lastID;

    // Seed tasks
    const seedTasks = [
      { subject: 'Initiative Request & Approval', planStart: '2024-06-03', planEnd: '2024-07-12', actStart: '2024-06-03', actEnd: '2024-07-15', pic: 'Team A', done: 1 },
      { subject: 'URS Preparation & Sign-off', planStart: '2024-07-15', planEnd: '2024-09-13', actStart: '2024-07-22', actEnd: '2024-09-20', pic: 'Team B', done: 1 },
      { subject: 'System Architecture & Design', planStart: '2024-09-02', planEnd: '2024-10-11', actStart: '2024-09-09', actEnd: '2024-10-18', pic: 'Team C', done: 1 },
      { subject: 'Backend Development', planStart: '2024-10-14', planEnd: '2025-01-17', actStart: '2024-10-21', actEnd: '2025-01-24', pic: 'Dev Team', done: 1 },
      { subject: 'Frontend Development', planStart: '2024-11-01', planEnd: '2025-02-28', actStart: '2024-11-15', actEnd: null, pic: 'UI Team', done: 0 },
      { subject: 'Integration Testing', planStart: '2025-01-20', planEnd: '2025-03-15', actStart: '2025-02-01', actEnd: null, pic: 'QA Team', done: 0 },
      { subject: 'User Acceptance Testing', planStart: '2025-03-01', planEnd: '2025-04-30', actStart: null, actEnd: null, pic: 'Business', done: 0 },
      { subject: 'Training & Documentation', planStart: '2025-03-15', planEnd: '2025-05-15', actStart: null, actEnd: null, pic: 'Training', done: 0 },
      { subject: 'Go Live Preparation', planStart: '2025-04-15', planEnd: '2025-05-31', actStart: null, actEnd: null, pic: 'PM', done: 0 },
      { subject: 'System Integration', planStart: '2025-05-01', planEnd: '2025-07-31', actStart: null, actEnd: null, pic: 'Dev Ops', done: 0 },
      { subject: 'Performance Optimization', planStart: '2025-06-01', planEnd: '2025-08-31', actStart: null, actEnd: null, pic: 'Dev Team', done: 0 },
      { subject: 'Security Audit', planStart: '2025-07-01', planEnd: '2025-09-30', actStart: null, actEnd: null, pic: 'Security', done: 0 },
      { subject: 'Production Deployment', planStart: '2025-09-01', planEnd: '2025-10-31', actStart: null, actEnd: null, pic: 'DevOps', done: 0 },
      { subject: 'Post-Launch Review', planStart: '2025-10-01', planEnd: '2025-12-31', actStart: null, actEnd: null, pic: 'PM', done: 0 },
    ];

    for (const task of seedTasks) {
      await db.run(
        `INSERT INTO tasks (project_id, subject, plan_start, plan_end, act_start, act_end, pic, done, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, task.subject, task.planStart, task.planEnd, task.actStart, task.actEnd, task.pic, task.done, 0]
      );
    }

    console.log('✓ Seeded default project with 14 tasks');
  }
}
