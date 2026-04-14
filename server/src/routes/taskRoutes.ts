import { Router } from 'express';
import { db } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Normalize DB snake_case to camelCase for the frontend
function norm(t: any) {
  if (!t) return t;
  return {
    id: t.id,
    projectId: t.project_id,
    subject: t.subject,
    planStart: t.plan_start,
    planEnd: t.plan_end,
    actStart: t.act_start,
    actEnd: t.act_end,
    pic: t.pic,
    done: !!t.done,
    sortOrder: t.sort_order,
  };
}

// Helper: verify project ownership
async function verifyProjectOwnership(projectId: number, userId: number) {
  return db.get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
}

// GET all tasks for a project
router.get('/projects/:projectId/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = await db.all('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order', [projectId]);
    res.json(tasks.map(norm));
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a new task
router.post('/projects/:projectId/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { subject, planStart, planEnd, actStart, actEnd, pic, done } = req.body;

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Task subject is required' });
    }

    const result = await db.run(
      `INSERT INTO tasks (project_id, subject, plan_start, plan_end, act_start, act_end, pic, done, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, subject, planStart || null, planEnd || null, actStart || null, actEnd || null, pic || null, done ? 1 : 0, 0]
    );

    res.status(201).json(norm({
      id: result.lastID, project_id: projectId, subject,
      plan_start: planStart || null, plan_end: planEnd || null,
      act_start: actStart || null, act_end: actEnd || null,
      pic: pic || null, done: done ? 1 : 0, sort_order: 0,
    }));
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update a task
router.put('/projects/:projectId/tasks/:taskId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    const { subject, planStart, planEnd, actStart, actEnd, pic, done } = req.body;

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Task subject is required' });
    }

    await db.run(
      `UPDATE tasks SET subject = ?, plan_start = ?, plan_end = ?, act_start = ?, act_end = ?, pic = ?, done = ?
       WHERE id = ?`,
      [subject, planStart || null, planEnd || null, actStart || null, actEnd || null, pic || null, done ? 1 : 0, taskId]
    );

    res.json(norm({
      id: taskId, project_id: projectId, subject,
      plan_start: planStart || null, plan_end: planEnd || null,
      act_start: actStart || null, act_end: actEnd || null,
      pic: pic || null, done: done ? 1 : 0, sort_order: task.sort_order,
    }));
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a task
router.delete('/projects/:projectId/tasks/:taskId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH reorder tasks
router.patch('/projects/:projectId/tasks/reorder', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { order } = req.body; // array of task IDs in new order

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (order.length > 0) {
      const cases = order.map((_: any, i: number) => `WHEN ? THEN ?`).join(' ');
      const params: any[] = [];
      order.forEach((id: number, i: number) => { params.push(id, i); });
      params.push(projectId);
      await db.run(
        `UPDATE tasks SET sort_order = CASE id ${cases} END WHERE project_id = ?`,
        params
      );
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH toggle task done status
router.patch('/projects/:projectId/tasks/:taskId/toggle', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);

    const project = await verifyProjectOwnership(projectId, req.userId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const newDone = task.done ? 0 : 1;
    await db.run('UPDATE tasks SET done = ? WHERE id = ?', [newDone, taskId]);
    res.json(norm({ ...task, done: newDone }));
  } catch (error) {
    console.error('Toggle task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
