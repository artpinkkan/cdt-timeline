import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || './data/tracker.db';

// Ensure data directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Create database connection
const dbConnection = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  }
});

// Enable foreign keys
dbConnection.run('PRAGMA foreign_keys = ON');

// Helper to run queries with promises
function runAsync(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    dbConnection.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function allAsync(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    dbConnection.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getAsync(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    dbConnection.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function execAsync(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    dbConnection.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export { runAsync as run, allAsync as all, getAsync as get, execAsync as exec, dbConnection };

export const db = {
  run: runAsync,
  all: allAsync,
  get: getAsync,
  exec: execAsync,
};

export type User = { id: number; username: string; passwordHash: string; createdAt: string };
export type Project = { id: number; userId: number; name: string; irCode?: string; description?: string; color: string; planStart?: string; planEnd?: string; createdAt: string };
export type Task = { id: number; projectId: number; subject: string; planStart?: string; planEnd?: string; actStart?: string; actEnd?: string; pic?: string; done: number; sortOrder: number };
