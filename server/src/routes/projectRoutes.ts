import { Router } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper: verify project ownership
async function verifyProjectOwnership(projectId: number, userId: number) {
  return db.get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
}

// GET all projects for the authenticated user
router.get('/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projects = await db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at', [req.userId]);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET a single project
router.get('/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await verifyProjectOwnership(projectId, req.userId!);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a new project
router.post('/projects', requireAuth, async (req: AuthRequest, res) => {
  const { name, irCode, description, color, planStart, planEnd } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const now = new Date().toISOString();
    const result = await db.run(
      'INSERT INTO projects (user_id, name, ir_code, description, color, plan_start, plan_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, name, irCode || null, description || null, color || '#3B82F6', planStart || null, planEnd || null, now]
    );

    res.status(201).json({
      id: result.lastID, user_id: req.userId, name,
      ir_code: irCode || null, description: description || null,
      color: color || '#3B82F6', plan_start: planStart || null,
      plan_end: planEnd || null, created_at: now,
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update a project
router.put('/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, irCode, description, color, planStart, planEnd } = req.body;

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    await db.run(
      'UPDATE projects SET name = ?, ir_code = ?, description = ?, color = ?, plan_start = ?, plan_end = ? WHERE id = ?',
      [name, irCode || null, description || null, color || '#3B82F6', planStart || null, planEnd || null, projectId]
    );

    res.json({
      ...project,
      name, ir_code: irCode || null, description: description || null,
      color: color || '#3B82F6', plan_start: planStart || null, plan_end: planEnd || null,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a project
router.delete('/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.id);

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
