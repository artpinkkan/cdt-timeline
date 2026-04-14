import { useState, useRef, useEffect } from 'react';
import { projectsApi, tasksApi } from './api/client';
import { useAuth } from './auth/AuthContext';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;

const PROJ_COLORS = ['#6366F1', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6'];

const SC: Record<string, { bg: string; tx: string; dot: string }> = {
  Done:          { bg: '#ECFDF5', tx: '#065F46', dot: '#10B981' },
  Delayed:       { bg: '#FEF2F2', tx: '#991B1B', dot: '#EF4444' },
  'In Progress': { bg: '#EEF2FF', tx: '#3730A3', dot: '#6366F1' },
  Overdue:       { bg: '#FFFBEB', tx: '#92400E', dot: '#F59E0B' },
  Planned:       { bg: '#F8FAFC', tx: '#475569', dot: '#94A3B8' },
};

const TL_W = 1920;

// ── Design tokens ─────────────────────────────────────────────────────
const T = {
  bg:       '#F5F7FF',
  surface:  '#FFFFFF',
  border:   '#E8ECF4',
  text:     '#0F172A',
  muted:    '#64748B',
  faint:    '#94A3B8',
  accent:   '#6366F1',
  card: {
    background: '#FFFFFF',
    border: '1px solid #E8ECF4',
    borderRadius: 14,
    boxShadow: '0 1px 4px rgba(99,102,241,0.06)',
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '9px 13px', fontSize: 13,
    background: '#F8FAFF', border: '1px solid #E8ECF4',
    borderRadius: 10, color: '#0F172A', outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: '#94A3B8', marginBottom: 6,
    textTransform: 'uppercase' as const, letterSpacing: '0.7px',
  } as React.CSSProperties,
  btnPrimary: {
    background: '#6366F1', color: '#fff', border: 'none',
    borderRadius: 10, padding: '8px 18px',
    cursor: 'pointer', fontWeight: 700, fontSize: 13,
    boxShadow: '0 2px 10px rgba(99,102,241,0.25)',
  } as React.CSSProperties,
  btnGhost: {
    background: '#fff', color: '#475569',
    border: '1px solid #E8ECF4', borderRadius: 10,
    padding: '8px 14px', cursor: 'pointer', fontSize: 12,
  } as React.CSSProperties,
};

const getStatus = (t: any) => {
  if (t.done) return t.actEnd && t.planEnd && new Date(t.actEnd) > new Date(t.planEnd) ? 'Delayed' : 'Done';
  if (t.planEnd && TODAY > new Date(t.planEnd)) return 'Overdue';
  if (t.actStart) return 'In Progress';
  return 'Planned';
};

const fmt = (ds: string) => (ds ? new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '–');

const loadScript = (src: string) =>
  new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(null); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(null); s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

async function buildProjectPDF(project: any, tasks: any[]): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const N = tasks.length, done = tasks.filter((t) => t.done).length, pct = N ? Math.round((done / N) * 100) : 0;

  // ── Page 1: Header + KPIs + Task Table ────────────────────────────────
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PW, 32, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(project.name, 14, 13);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}   |   ${done}/${N} tasks · ${pct}% complete`, 14, 23);

  const kpiData = [['Target YTD', '100%'], ['Actual YTD', `${pct}%`], ['Achievement', N ? `${Math.round(pct)}%` : '–'], ['Tasks Done', `${done}/${N}`]];
  kpiData.forEach(([l, v], ki) => {
    const kx = 14 + ki * 64;
    doc.setFillColor(241, 245, 249); doc.roundedRect(kx, 36, 60, 18, 2, 2, 'F');
    doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.text(String(l).toUpperCase(), kx + 4, 42);
    doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(String(v), kx + 4, 52);
    doc.setFont('helvetica', 'normal');
  });

  const stClr: any = { Done: [16, 185, 129], Delayed: [239, 68, 68], 'In Progress': [99, 102, 241], Overdue: [245, 158, 11], Planned: [107, 114, 128] };
  (doc as any).autoTable({
    startY: 60,
    head: [['#', 'Task Subject', '✓', 'Status', 'Plan Start', 'Plan End', 'Act. Start', 'Act. End', 'PIC']],
    body: tasks.map((t, i) => [i + 1, t.subject, t.done ? '✓' : '', getStatus(t), fmt(t.planStart), fmt(t.planEnd), fmt(t.actStart), fmt(t.actEnd), t.pic || '–']),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 8, halign: 'center' }, 3: { cellWidth: 24 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 22 }, 7: { cellWidth: 22 }, 8: { cellWidth: 20 } },
    didParseCell(data: any) {
      if (data.section === 'body' && data.column.index === 3) { const c = stClr[data.cell.raw] || [0, 0, 0]; data.cell.styles.textColor = c; data.cell.styles.fontStyle = 'bold'; }
      if (data.section === 'body' && data.column.index === 2) { data.cell.styles.textColor = data.cell.raw === '✓' ? [16, 185, 129] : [203, 213, 225]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 10; }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Page 2: Gantt Chart ───────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PW, 14, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(`${project.name} — Gantt Chart`, 14, 10);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`${done}/${N} tasks done`, PW - 14, 10, { align: 'right' });

  // Timeline setup
  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));
  if (allDates.length === 0) { doc.setTextColor(148, 163, 184); doc.setFontSize(10); doc.text('No task dates available.', PW / 2, 80, { align: 'center' }); }
  else {
    const minD = new Date(Math.min(...allDates.map((d: string) => new Date(d).getTime())));
    const maxD = new Date(Math.max(...allDates.map((d: string) => new Date(d).getTime())));
    const tlS = new Date(minD.getTime() - 7 * 86400000);
    const tlE = new Date(maxD.getTime() + 7 * 86400000);
    const tlDays = (tlE.getTime() - tlS.getTime()) / 86400000;

    // Layout constants (mm)
    const LBL_W = 70; // left label column
    const TL_X = 14 + LBL_W + 2; // timeline start x
    const TL_W_MM = PW - TL_X - 8; // timeline width
    const ROW_H = 6.5;
    const HDR1 = 16, HDR2 = 22; // y positions of header rows
    const DATA_Y = 25; // y where data rows start

    const d2x = (ds: string) => TL_X + ((new Date(ds).getTime() - tlS.getTime()) / 86400000 / tlDays) * TL_W_MM;

    // Build weeks
    const numWeeks = Math.ceil(tlDays / 7);
    const weeks: { x: number; w: number; wkNum: number; month: number; year: number; d: Date }[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const wkS = new Date(tlS.getTime() + i * 7 * 86400000);
      const x = TL_X + (i * 7 / tlDays) * TL_W_MM;
      const w = (7 / tlDays) * TL_W_MM;
      weeks.push({ x, w, wkNum: Math.ceil(wkS.getDate() / 7), month: wkS.getMonth(), year: wkS.getFullYear(), d: wkS });
    }

    // Month bands
    const bands: { label: string; x: number; w: number }[] = [];
    weeks.forEach(wk => {
      const lbl = wk.d.toLocaleString('en-US', { month: 'short' }) + " '" + String(wk.year).slice(2);
      const last = bands[bands.length - 1];
      if (last && last.label === lbl) { last.w += wk.w; }
      else { bands.push({ label: lbl, x: wk.x, w: wk.w }); }
    });

    // Header row 1 — month bands
    doc.setFillColor(30, 41, 59);
    doc.rect(TL_X, HDR1 - 5, TL_W_MM, 5, 'F');
    doc.setFillColor(248, 250, 252); doc.rect(14, HDR1 - 5, LBL_W, 5, 'F');
    doc.setTextColor(203, 213, 225); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    bands.forEach(b => {
      doc.setDrawColor(71, 85, 105); doc.line(b.x, HDR1 - 5, b.x, HDR1);
      doc.text(b.label, b.x + b.w / 2, HDR1 - 1, { align: 'center', maxWidth: b.w - 1 });
    });

    // Header row 2 — week labels
    doc.setFillColor(248, 250, 252); doc.rect(TL_X, HDR1, TL_W_MM, HDR2 - HDR1, 'F');
    doc.setFillColor(248, 250, 252); doc.rect(14, HDR1, LBL_W, HDR2 - HDR1, 'F');
    doc.setTextColor(100, 116, 139); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
    // Column headers
    doc.setTextColor(71, 85, 105); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
    doc.text('Task Subject', 16, HDR2 - 1);
    weeks.forEach(wk => {
      if (wk.w > 3) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
        doc.text(`W${wk.wkNum}`, wk.x + wk.w / 2, HDR2 - 1, { align: 'center' });
      }
      doc.setDrawColor(226, 232, 240); doc.line(wk.x + wk.w, HDR1, wk.x + wk.w, DATA_Y + tasks.length * ROW_H);
    });

    // Header bottom border
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.4); doc.line(14, HDR2, PW - 8, HDR2);

    // Task rows
    tasks.forEach((t: any, i: number) => {
      const y = DATA_Y + i * ROW_H;
      const isEven = i % 2 === 0;

      // Row background
      if (!isEven) { doc.setFillColor(248, 250, 252); doc.rect(14, y, PW - 22, ROW_H, 'F'); }

      // Done checkbox + subject
      const st = getStatus(t);
      const dotClr = stClr[st] || [107, 114, 128];
      doc.setFillColor(...dotClr as [number, number, number]); doc.circle(17, y + ROW_H / 2, 1, 'F');
      doc.setTextColor(t.done ? 148 : 30, t.done ? 163 : 41, t.done ? 184 : 59);
      doc.setFontSize(6); doc.setFont('helvetica', t.done ? 'normal' : 'normal');
      const subj = t.subject.length > 42 ? t.subject.slice(0, 42) + '…' : t.subject;
      doc.text(subj, 20, y + ROW_H / 2 + 1);

      // Plan bar (blue)
      if (t.planStart && t.planEnd) {
        const bx = d2x(t.planStart), bw = Math.max(0.8, d2x(t.planEnd) - d2x(t.planStart));
        doc.setFillColor(191, 219, 254); doc.roundedRect(bx, y + 1, bw, 2, 0.4, 0.4, 'F');
      }
      // Actual bar (green/red)
      if (t.actStart) {
        const ae = t.actEnd || new Date().toISOString().slice(0, 10);
        const bx = d2x(t.actStart), bw = Math.max(0.8, d2x(ae) - d2x(t.actStart));
        const bad = st === 'Delayed' || st === 'Overdue';
        doc.setFillColor(...(bad ? [252, 165, 165] : [167, 243, 208]) as [number, number, number]);
        doc.roundedRect(bx, y + 3.5, bw, 2, 0.4, 0.4, 'F');
      }

      // Row separator
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2); doc.line(14, y + ROW_H, PW - 8, y + ROW_H);
    });

    // Today line
    const todayStr2 = new Date().toISOString().slice(0, 10);
    const tx = d2x(todayStr2);
    if (tx >= TL_X && tx <= TL_X + TL_W_MM) {
      doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.5);
      doc.line(tx, HDR1, tx, DATA_Y + tasks.length * ROW_H);
    }

    // Legend
    const legY = DATA_Y + tasks.length * ROW_H + 5;
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    [[191, 219, 254, 'Plan'], [167, 243, 208, 'Actual'], [252, 165, 165, 'Delayed']].forEach(([r, g, b, lbl], li) => {
      const lx = 14 + li * 28;
      doc.setFillColor(r as number, g as number, b as number); doc.roundedRect(lx, legY, 6, 3, 0.5, 0.5, 'F');
      doc.setTextColor(71, 85, 105); doc.text(lbl as string, lx + 7.5, legY + 2.2);
    });
    doc.setFillColor(239, 68, 68); doc.roundedRect(14 + 3 * 28, legY, 6, 3, 0.5, 0.5, 'F');
    doc.setTextColor(71, 85, 105); doc.text('Today', 14 + 3 * 28 + 7.5, legY + 2.2);
  }

  // ── Footer on all pages ───────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`${project.name} — Page ${i} of ${pages}`, 14, PH - 6);
    doc.text('Generated by FinalPush.io', PW - 14, PH - 6, { align: 'right' });
  }
  return doc;
}


async function exportAllPDF(projects: any[], projectTasks: Record<number, any[]>) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const allTasks = Object.values(projectTasks).flat();
  const totalDone = allTasks.filter((t) => t.done).length;
  const overallPct = allTasks.length ? Math.round((totalDone / allTasks.length) * 100) : 0;
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 297, 32, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('FinalPush.io — All Projects Report', 14, 13);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}   |   ${projects.length} projects   |   ${totalDone}/${allTasks.length} tasks done (${overallPct}%)`, 14, 23);
  [{ l: 'Total Projects', v: String(projects.length) }, { l: 'Total Tasks', v: String(allTasks.length) }, { l: 'Tasks Done', v: String(totalDone) }, { l: 'Overall Progress', v: `${overallPct}%` }]
    .forEach(({ l, v }, i) => {
      const kx = 14 + i * 64;
      doc.setFillColor(241, 245, 249); doc.roundedRect(kx, 36, 60, 18, 2, 2, 'F');
      doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.text(l.toUpperCase(), kx + 4, 42);
      doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(v, kx + 4, 51);
      doc.setFont('helvetica', 'normal');
    });
  (doc as any).autoTable({
    startY: 60,
    head: [['#', 'Project Name', 'Description', 'Tasks', 'Done', 'Progress']],
    body: projects.map((p, i) => { const pt = projectTasks[p.id] || []; const dn = pt.filter((t) => t.done).length; const pct = pt.length ? Math.round((dn / pt.length) * 100) : 0; return [i + 1, p.name, p.description || '–', pt.length, dn, `${pct}%`]; }),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 90 }, 3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 16, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' } },
    margin: { left: 14, right: 14 },
  });
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`FinalPush.io — Page ${i} of ${pages}`, 14, doc.internal.pageSize.height - 6);
    doc.text('Generated by FinalPush.io', 297 - 14, doc.internal.pageSize.height - 6, { align: 'right' });
  }
  doc.save('FinalPush_All_Projects.pdf');
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<Record<number, any[]>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState('gantt');
  const [taskModal, setTaskModal] = useState<any>(null);
  const [projModal, setProjModal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const gRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        const pt: Record<number, any[]> = {};
        for (const p of projs) pt[p.id] = await tasksApi.list(p.id);
        setProjectTasks(pt);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const proj = projects.find((p) => p.id === activeId) || null;
  const tasks = activeId ? projectTasks[activeId] || [] : [];

  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));
  const minDate = allDates.length ? new Date(Math.min(...allDates.map((d: string) => new Date(d).getTime()))) : new Date(2026, 0, 1);
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map((d: string) => new Date(d).getTime()))) : new Date(2027, 11, 31);
  const tlS = new Date(minDate.getTime() - 30 * 86400000), tlE = new Date(maxDate.getTime() + 30 * 86400000);
  const tlDays = (tlE.getTime() - tlS.getTime()) / 86400000;
  const txDay = (ds: string) => (ds ? Math.round(((new Date(ds).getTime() - tlS.getTime()) / 86400000 / tlDays) * TL_W) : null);
  const todayX = txDay(todayStr);

  const saveProject = async (p: any) => {
    try {
      if (p.id) { await projectsApi.update(p.id, p); setProjects(projects.map((x) => (x.id === p.id ? p : x))); }
      else { const c = await projectsApi.create(p); setProjects([...projects, c]); setProjectTasks({ ...projectTasks, [c.id]: [] }); }
      setProjModal(null);
    } catch (e) { console.error(e); }
  };
  const delProject = async (id: number) => {
    try {
      await projectsApi.delete(id); setProjects(projects.filter((p) => p.id !== id));
      const npt = { ...projectTasks }; delete npt[id]; setProjectTasks(npt);
      if (activeId === id) setActiveId(null);
    } catch (e) { console.error(e); }
  };
  const saveTask = async (t: any) => {
    try {
      if (activeId) {
        if (t.id) { await tasksApi.update(activeId, t.id, t); setProjectTasks({ ...projectTasks, [activeId]: tasks.map((x) => (x.id === t.id ? t : x)) }); }
        else { const c = await tasksApi.create(activeId, t); setProjectTasks({ ...projectTasks, [activeId]: [...tasks, c] }); }
      }
      setTaskModal(null);
    } catch (e) { console.error(e); }
  };
  const delTask = async (id: number) => {
    try { if (activeId) { await tasksApi.delete(activeId, id); setProjectTasks({ ...projectTasks, [activeId]: tasks.filter((x) => x.id !== id) }); } }
    catch (e) { console.error(e); }
  };
  const togTask = async (id: number) => {
    try {
      if (activeId) {
        const task = tasks.find((x) => x.id === id);
        if (task) { await tasksApi.toggle(activeId, id); setProjectTasks({ ...projectTasks, [activeId]: tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }); }
      }
    } catch (e) { console.error(e); }
  };
  const reorderTasks = async (newOrder: any[]) => {
    if (!activeId) return;
    setProjectTasks({ ...projectTasks, [activeId]: newOrder });
    try { await tasksApi.reorder(activeId, newOrder.map((t: any) => t.id)); }
    catch (e) { console.error(e); }
  };

  const N = tasks.length;
  // % Target YTD  = tasks whose plan end date has passed (were supposed to be done by today)
  const pDue = tasks.filter((t: any) => t.planEnd && new Date(t.planEnd) <= TODAY).length;
  // % Actual YTD  = tasks that are actually done (actEnd set & ≤ today, OR toggled done without actEnd)
  const actDone = tasks.filter((t: any) =>
    t.actEnd ? new Date(t.actEnd) <= TODAY : t.done
  ).length;
  const tgt = N ? (pDue / N) * 100 : 0;
  const act = N ? (actDone / N) * 100 : 0;
  const ach = tgt > 0 ? (act / tgt) * 100 : 0;
  const maxPEnd = tasks.reduce((m: Date, t: any) => { const d = t.planEnd ? new Date(t.planEnd) : null; return d && d > m ? d : m; }, new Date(0));
  const pc = maxPEnd > new Date(0) ? maxPEnd.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : '–';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.bg, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8ECF4', borderTopColor: T.accent, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: T.muted, fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarW = sidebarCollapsed ? 60 : 234;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13, background: T.bg }}>
      <Sidebar projects={projects} projectTasks={projectTasks} activeId={activeId} user={user} logout={logout}
        onDashboard={() => setActiveId(null)}
        onSelect={(id: number) => { setActiveId(id); setView('gantt'); }}
        onNew={() => setProjModal('add')}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c: boolean) => !c)} />
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, marginLeft: sidebarW, transition: 'margin-left 0.22s cubic-bezier(.4,0,.2,1)' }}>
        {!proj
          ? <Dashboard projects={projects} projectTasks={projectTasks}
              onSelect={(id: number) => { setActiveId(id); setView('gantt'); }}
              onNew={() => setProjModal('add')} onEdit={(p: any) => setProjModal(p)} onDelete={delProject} />
          : <ProjectPage key={proj.id} project={proj} tasks={tasks} view={view} setView={setView} gRef={gRef} todayX={todayX}
              kpis={[
                { l: '% Target YTD',      v: `${tgt.toFixed(1)}%`, sub: `as of ${TODAY.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`, c: '#6366F1' },
                { l: '% Actual YTD',      v: `${act.toFixed(1)}%`, sub: `${actDone}/${N} tasks`, c: '#10B981' },
                { l: '% Achievement YTD', v: `${ach.toFixed(1)}%`, sub: 'Actual ÷ Target', c: ach < 80 ? '#EF4444' : '#10B981' },
                { l: 'Plan Completion',   v: pc, sub: 'Projected end', c: '#F59E0B' },
                { l: '% BE Achievement',  v: `${act.toFixed(1)}%`, sub: 'BE target: 100%', c: '#8B5CF6' },
              ]}
              onAdd={() => setTaskModal('add')} onEditTask={setTaskModal} onDelTask={delTask} onTogTask={togTask} onReorderTasks={reorderTasks}
              onEditProject={() => setProjModal(proj)}
              onGoToToday={() => gRef.current && (gRef.current.scrollLeft = Math.max(0, (todayX || 0) - 280))}
              onGenTasks={() => setTaskModal('generate')} />
        }
      </div>
      {taskModal && <TaskModal task={taskModal === 'add' ? null : taskModal} onSave={saveTask} onClose={() => setTaskModal(null)} />}
      {projModal && <ProjectModal project={projModal === 'add' ? null : projModal} onSave={saveProject} onClose={() => setProjModal(null)} />}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ projects, projectTasks, activeId, user, logout, onDashboard, onSelect, onNew, collapsed, onToggle }: any) {
  const totT = projects.reduce((s: number, p: any) => s + (projectTasks[p.id] || []).length, 0);
  const totD = projects.reduce((s: number, p: any) => s + (projectTasks[p.id] || []).filter((t: any) => t.done).length, 0);
  const pct = totT ? Math.round((totD / totT) * 100) : 0;
  const W = collapsed ? 60 : 234;

  return (
    <div style={{ width: W, flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 100, transition: 'width 0.22s cubic-bezier(.4,0,.2,1)', overflow: 'hidden' }}>
      {/* Logo + toggle */}
      <div style={{ padding: collapsed ? '18px 13px' : '18px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>F</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap' }}>FinalPush.io</div>
              <div style={{ color: T.faint, fontSize: 11, whiteSpace: 'nowrap' }}>Temporary App Only</div>
            </div>
          )}
        </div>
        <button onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 13, padding: 0 }}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        <button onClick={onDashboard} title="Dashboard" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '9px 0' : '8px 11px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 9, border: 'none', cursor: 'pointer', marginBottom: 4, background: activeId === null ? '#EEF2FF' : 'transparent', color: activeId === null ? T.accent : T.muted, fontSize: 13, textAlign: 'left', fontWeight: activeId === null ? 700 : 400, transition: 'all 0.15s' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>⊞</span>
          {!collapsed && 'Dashboard'}
        </button>

        {!collapsed && (
          <div style={{ padding: '14px 11px 6px', color: T.faint, fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Projects</span>
            <span style={{ background: T.bg, color: T.muted, borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{projects.length}</span>
          </div>
        )}
        {collapsed && <div style={{ height: 1, background: T.border, margin: '8px 4px' }} />}

        {projects.map((p: any) => {
          const pt = projectTasks[p.id] || [], pd = pt.filter((t: any) => t.done).length, pp = pt.length ? Math.round((pd / pt.length) * 100) : 0, active = activeId === p.id;
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} title={p.name} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '9px 0' : '8px 11px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 9, border: 'none', cursor: 'pointer', marginBottom: 2, background: active ? '#EEF2FF' : 'transparent', textAlign: 'left', transition: 'all 0.15s' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              {!collapsed && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? T.accent : T.muted, fontSize: 12, fontWeight: active ? 700 : 400 }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, background: '#F1F5F9', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pp}%`, background: p.color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: T.faint, flexShrink: 0 }}>{pp}%</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
        {projects.length === 0 && !collapsed && <div style={{ color: T.faint, fontSize: 11, padding: '12px', textAlign: 'center' }}>No projects yet</div>}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed ? '10px 8px' : '12px 10px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {!collapsed && (
          <>
            <button onClick={onNew} style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.muted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Project
            </button>
            <div style={{ background: '#F5F7FF', border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 13px', marginBottom: user ? 10 : 0 }}>
              <div style={{ color: T.faint, fontSize: 10, marginBottom: 4 }}>Overall Progress</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.accent, marginBottom: 6 }}>{pct}%</div>
              <div style={{ height: 5, background: '#E8ECF4', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: T.accent, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ color: T.faint, fontSize: 10, marginTop: 5 }}>{totD} / {totT} tasks done</div>
            </div>
          </>
        )}
        {collapsed && (
          <button onClick={onNew} title="New Project" style={{ width: '100%', padding: '8px 0', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.muted, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>+</button>
        )}
        {user && (
          <button onClick={logout} title="Logout" style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.faint, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {collapsed ? '⏻' : 'Logout'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ projects, projectTasks, onSelect, onNew, onEdit, onDelete }: any) {
  const [exporting, setExporting] = useState(false);
  const allTasks = Object.values(projectTasks).flat() as any[];
  const statSummary = ['Done', 'In Progress', 'Overdue', 'Planned'].map((s) => ({ s, n: allTasks.filter((t) => getStatus(t) === s).length }));

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.3px' }}>Projects</h1>
          <p style={{ margin: '5px 0 0', color: T.muted, fontSize: 13 }}>{projects.length} project{projects.length !== 1 ? 's' : ''} · {allTasks.length} total tasks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setExporting(true); exportAllPDF(projects, projectTasks).catch(console.error).finally(() => setExporting(false)); }} disabled={exporting} style={{ ...T.btnGhost, opacity: exporting ? 0.5 : 1 }}>
            {exporting ? 'Exporting…' : '⬇ Export PDF'}
          </button>
          <button onClick={onNew} style={T.btnPrimary}>+ New Project</button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {statSummary.map(({ s, n }) => (
          <div key={s} style={{ ...T.card, padding: '16px 20px', borderLeft: `3px solid ${SC[s].dot}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.faint, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 6 }}>{s}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: SC[s].dot, lineHeight: 1, marginBottom: 4 }}>{n}</div>
            <div style={{ fontSize: 11, color: T.faint }}>tasks across all projects</div>
          </div>
        ))}
      </div>

      {/* Project grid */}
      {projects.length === 0 ? (
        <div style={{ ...T.card, textAlign: 'center', padding: '60px 20px', border: `2px dashed ${T.border}`, boxShadow: 'none' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>Create your first project to start tracking timelines</div>
          <button onClick={onNew} style={T.btnPrimary}>+ Create First Project</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 16 }}>
          {projects.map((p: any) => {
            const pt = projectTasks[p.id] || [], pdone = pt.filter((t: any) => t.done).length, pct = pt.length ? Math.round((pdone / pt.length) * 100) : 0;
            const counts: any = { Done: 0, 'In Progress': 0, Overdue: 0, Delayed: 0, Planned: 0 };
            pt.forEach((t: any) => { const s = getStatus(t); if (counts[s] !== undefined) counts[s]++; });
            const maxP = pt.reduce((m: Date, t: any) => { const d = t.planEnd ? new Date(t.planEnd) : null; return d && d > m ? d : m; }, new Date(0));
            const endDate = maxP > new Date(0) ? maxP.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
            return (
              <div key={p.id} onClick={() => onSelect(p.id)}
                style={{ ...T.card, cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(99,102,241,0.12)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = T.card.boxShadow as string; }}>
                <div style={{ height: 4, background: p.color }} />
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontWeight: 700, color: T.text, fontSize: 14, lineHeight: 1.3, marginBottom: 5 }}>{p.name}</div>
                      <span style={{ background: `${p.color}15`, color: p.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6 }}>{p.irCode || 'No IR Code'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onEdit(p)} style={{ ...T.btnGhost, padding: '4px 9px', fontSize: 11 }}>Edit</button>
                      <button onClick={() => onDelete(p.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontSize: 11 }}>Del</button>
                    </div>
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>{p.description}</div>}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: T.muted }}>Progress</span>
                      <span style={{ fontWeight: 700, color: p.color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 14 }}>
                    {Object.entries(counts).map(([st, n]) => (
                      <div key={st} style={{ textAlign: 'center', background: SC[st]?.bg, borderRadius: 8, padding: '6px 2px' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: SC[st]?.dot }}>{n as number}</div>
                        <div style={{ fontSize: 9, color: SC[st]?.tx, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 1, opacity: 0.8 }}>{st === 'In Progress' ? 'Active' : st}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 12, fontSize: 11 }}>
                    <span style={{ color: T.faint }}>{pt.length} tasks · ends {endDate}</span>
                    <span style={{ color: p.color, fontWeight: 700 }}>Open →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Project Page ──────────────────────────────────────────────────────
function ProjectPage({ project, tasks, view, setView, gRef, todayX, kpis, onAdd, onEditTask, onDelTask, onTogTask, onReorderTasks, onEditProject, onGoToToday, onGenTasks }: any) {
  const [showIR, setShowIR] = useState(false);
  const [exporting, setExporting] = useState(false);

  return (
    <div>
      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
              <span style={{ fontSize: 19, fontWeight: 700, color: T.text, letterSpacing: '-0.2px' }}>{project.name}</span>
              <button onClick={onEditProject} style={{ ...T.btnGhost, padding: '3px 10px', fontSize: 11 }}>Edit</button>
            </div>
            <div style={{ color: T.faint, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>Timeline · {tasks.length} tasks</span>
              {(project.plan_start || project.plan_end) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 1, height: 12, background: T.border }} />
                  <span style={{ color: T.accent, fontWeight: 600 }}>
                    {project.plan_start ? fmt(project.plan_start) : '–'} → {project.plan_end ? fmt(project.plan_end) : '–'}
                  </span>
                </span>
              )}
            </div>
          </div>
          {/* View switcher */}
          <div style={{ display: 'flex', gap: 4, background: T.bg, padding: 4, borderRadius: 11, border: `1px solid ${T.border}` }}>
            {['gantt', 'list', 'board', 'kanban'].map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: view === v ? T.surface : 'transparent', color: view === v ? T.accent : T.muted, fontWeight: view === v ? 700 : 400, boxShadow: view === v ? `0 1px 4px rgba(0,0,0,0.08)` : 'none', transition: 'all 0.15s' }}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {project.irCode && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowIR((x: boolean) => !x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: `1px solid ${showIR ? T.accent + '55' : T.border}`, background: showIR ? '#EEF2FF' : 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: showIR ? T.accent : T.muted }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: showIR ? T.accent : T.faint, display: 'inline-block' }} />
              IR Context
            </button>
            {showIR && <span style={{ background: '#EEF2FF', border: `1px solid ${T.accent}33`, borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: T.accent }}>{project.irCode}</span>}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, padding: '20px 24px 12px' }}>
        {kpis.map((k: any, i: number) => (
          <div key={i} style={{ ...T.card, padding: '14px 18px', borderLeft: `3px solid ${k.c}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.faint, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 5 }}>{k.l}</div>
            <div style={{ fontSize: i === 3 ? 19 : 26, fontWeight: 700, color: k.c, lineHeight: 1.1, marginBottom: 3 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: T.faint }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 24px 16px' }}>
        <button onClick={onAdd} style={T.btnPrimary}>+ Add Task</button>
        <button onClick={onGenTasks} style={{ ...T.btnGhost, display: 'flex', alignItems: 'center', gap: 5, opacity: 0.65 }}>
          ✨ Generate Tasks
          <span style={{ fontSize: 10, background: '#F1F5F9', color: T.faint, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>Soon</span>
        </button>
        {view === 'gantt' && <button onClick={onGoToToday} style={T.btnGhost}>Go to Today</button>}
        <button onClick={() => {
          setExporting(true);
          buildProjectPDF(project, tasks)
            .then(doc => {
              const url = URL.createObjectURL(doc.output('blob'));
              window.open(url, '_blank');
            })
            .catch(console.error)
            .finally(() => setExporting(false));
        }} disabled={exporting} style={{ ...T.btnGhost, opacity: exporting ? 0.5 : 1 }}>
          {exporting ? 'Building PDF…' : '⬇ Export PDF'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: T.muted }}>
          {[['#BFDBFE', 'Planned'], ['#A7F3D0', 'Actual'], ['#FCA5A5', 'Delayed'], ['#EF4444', 'Today']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 22, height: 7, borderRadius: 4, background: c, display: 'inline-block', border: `1px solid ${T.border}` }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* View content */}
      <div style={{ padding: '0 24px 28px' }}>
        {view === 'gantt'  && <GanttView  tasks={tasks} todayX={todayX} gRef={gRef} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask} onReorder={onReorderTasks} />}
        {view === 'list'   && <ListView   tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask} onReorder={onReorderTasks} />}
        {view === 'board'  && <BoardView  tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask} />}
        {view === 'kanban' && <KanbanView tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask} />}
      </div>

    </div>
  );
}

// ── Gantt ─────────────────────────────────────────────────────────────
function GanttView({ tasks, todayX, gRef, onEdit, onDel, onTog, onReorder }: any) {
  const RH = 52, HH = 52;
  const [pendingDel, setPendingDel] = useState<number | null>(null);
  const [dragId, setDragId]     = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const from = tasks.findIndex((t: any) => t.id === dragId);
    const to   = tasks.findIndex((t: any) => t.id === targetId);
    const reordered = [...tasks];
    reordered.splice(from, 1);
    reordered.splice(to, 0, tasks[from]);
    onReorder(reordered);
    setDragId(null); setDragOverId(null);
  };

  const COLS = [
    { k: 'drag',      l: '',             w: 24  },
    { k: 'actions',   l: '',             w: 52  },
    { k: 'subject',   l: 'Task Subject', w: 180 },
    { k: 'planStart', l: 'Plan\nStart',  w: 88  },
    { k: 'planEnd',   l: 'Plan\nEnd',    w: 88  },
    { k: 'actStart',  l: 'Act.\nStart',  w: 88  },
    { k: 'actEnd',    l: 'Act.\nEnd',    w: 88  },
    { k: 'pic',       l: 'PIC',          w: 68  },
  ];

  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));
  const minDate = allDates.length ? new Date(Math.min(...allDates.map((d: string) => new Date(d).getTime()))) : new Date(2026, 0, 1);
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map((d: string) => new Date(d).getTime()))) : new Date(2027, 11, 31);
  const TL_S = new Date(minDate.getTime() - 14 * 86400000), TL_E = new Date(maxDate.getTime() + 14 * 86400000);
  const TL_DAYS = (TL_E.getTime() - TL_S.getTime()) / 86400000;
  const d2x = (ds: string) => (ds ? Math.round(((new Date(ds).getTime() - TL_S.getTime()) / 86400000 / TL_DAYS) * TL_W) : null);

  // Build week grid
  const NUM_WEEKS = Math.ceil(TL_DAYS / 7);
  const WEEKS = Array.from({ length: NUM_WEEKS }, (_, i) => {
    const wkStart = new Date(TL_S.getTime() + i * 7 * 86400000);
    const x = Math.round((i * 7 * TL_W) / TL_DAYS);
    const w = Math.round(((i + 1) * 7 * TL_W) / TL_DAYS) - x;
    const wkNum = Math.ceil(wkStart.getDate() / 7);
    return { x, w, wkNum, month: wkStart.getMonth(), year: wkStart.getFullYear(), wkStart };
  });

  // Group weeks into month bands for the top row
  const MONTH_BANDS: { label: string; x: number; w: number }[] = [];
  WEEKS.forEach((wk) => {
    const lbl = wk.wkStart.toLocaleString('en-US', { month: 'short' }) + " '" + String(wk.year).slice(2);
    const last = MONTH_BANDS[MONTH_BANDS.length - 1];
    if (last && last.label === lbl) { last.w += wk.w; }
    else { MONTH_BANDS.push({ label: lbl, x: wk.x, w: wk.w }); }
  });

  const dateCell: React.CSSProperties = { fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <div style={{ ...T.card, overflow: 'hidden' }}>
      <div style={{ display: 'flex' }}>
        {/* Fixed left panel */}
        <div style={{ flexShrink: 0 }}>
          {/* Header — spans both sub-rows */}
          <div style={{ display: 'flex', height: HH, background: '#FAFBFF', borderBottom: `1px solid ${T.border}`, borderRight: `2px solid ${T.border}` }}>
            {COLS.map((c) => (
              <div key={c.k} style={{ width: c.w, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: c.k === 'actions' ? 'center' : 'flex-start', flexShrink: 0, fontSize: 10, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{c.l}</div>
            ))}
          </div>

          {/* Data rows */}
          {tasks.map((t: any, i: number) => {
            const sc = SC[getStatus(t)];
            const isDragging  = dragId === t.id;
            const isDragOver  = dragOverId === t.id && dragId !== t.id;
            const isConfirming = pendingDel === t.id;
            return (
              <div key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(t.id); }}
                onDrop={() => handleDrop(t.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                style={{ display: 'flex', height: RH, borderBottom: `1px solid ${T.border}`, borderRight: `2px solid ${T.border}`, background: isDragOver ? '#EEF2FF' : i % 2 === 0 ? '#fff' : '#FAFBFF', opacity: isDragging ? 0.4 : 1, transition: 'background 0.1s' }}>
                {/* Drag handle */}
                <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'grab', color: T.faint, fontSize: 13, userSelect: 'none' }}>⠿</div>
                {/* Edit / Delete */}
                <div style={{ width: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0 }}>
                  {isConfirming ? (
                    <>
                      <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700, marginRight: 2 }}>Delete?</span>
                      <button onClick={() => { onDel(t.id); setPendingDel(null); }} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
                      <button onClick={() => setPendingDel(null)} style={{ background: '#F1F5F9', color: T.muted, border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>✗</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onEdit(t)} style={{ background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>✏</button>
                      <button onClick={() => setPendingDel(t.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                    </>
                  )}
                </div>
                <div style={{ width: 180, display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px', overflow: 'hidden', flexShrink: 0 }}>
                  <div onClick={() => onTog(t.id)} style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${t.done ? '#10B981' : '#CBD5E1'}`, background: t.done ? '#10B981' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
                    {t.done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: t.done ? T.faint : T.text, textDecoration: t.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                </div>
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                  <span style={dateCell}>{fmt(t.planStart)}</span>
                </div>
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid ${T.border}` }}>
                  <span style={dateCell}>{fmt(t.planEnd)}</span>
                </div>
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid #F0F4FF`, background: i % 2 === 0 ? '#FAFEFF' : '#F5FAFF' }}>
                  <span style={{ ...dateCell, color: t.actStart ? '#059669' : T.faint }}>{fmt(t.actStart)}</span>
                </div>
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid #F0F4FF`, background: i % 2 === 0 ? '#FAFEFF' : '#F5FAFF' }}>
                  <span style={{ ...dateCell, color: t.actEnd ? '#059669' : T.faint }}>{fmt(t.actEnd)}</span>
                </div>
                {/* PIC */}
                <div style={{ width: 68, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.pic || '–'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <div ref={gRef} style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{ minWidth: TL_W, position: 'relative' }}>
            {/* Two-row header */}
            <div style={{ height: HH, background: '#FAFBFF', borderBottom: `1px solid ${T.border}`, position: 'relative' }}>
              {/* Top row: month bands */}
              {MONTH_BANDS.map((m, i) => (
                <div key={i} style={{ position: 'absolute', left: m.x, width: m.w, top: 0, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.text, letterSpacing: '0.3px', background: '#F5F7FF' }}>
                  {m.label}
                </div>
              ))}
              {/* Bottom row: week labels */}
              {WEEKS.map((wk, i) => (
                <div key={i} style={{ position: 'absolute', left: wk.x, width: wk.w, top: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${T.border}`, fontSize: 9, fontWeight: 600, color: T.faint }}>
                  {wk.w > 18 ? `W${wk.wkNum}` : ''}
                </div>
              ))}
            </div>

            {/* Data rows with week grid lines */}
            {tasks.map((t: any, i: number) => {
              const px1 = d2x(t.planStart), px2 = d2x(t.planEnd);
              const ax1 = d2x(t.actStart), ax2 = t.actEnd ? d2x(t.actEnd) : (t.actStart ? d2x(todayStr) : null);
              const bad = getStatus(t) === 'Delayed' || getStatus(t) === 'Overdue';
              const isDragging = dragId === t.id;
              const isDragOver = dragOverId === t.id && dragId !== t.id;
              return (
                <div key={t.id} style={{ height: RH, borderBottom: `1px solid ${T.border}`, position: 'relative', background: isDragOver ? '#EEF2FF' : i % 2 === 0 ? '#fff' : '#FAFBFF', opacity: isDragging ? 0.4 : 1 }}>
                  {/* Week grid lines */}
                  {WEEKS.map((wk, wi) => (
                    <div key={wi} style={{ position: 'absolute', left: wk.x + wk.w - 1, top: 0, bottom: 0, width: 1, background: wk.wkNum === 4 || wk.wkNum === 5 ? '#E8ECF4' : '#F1F5F9' }} />
                  ))}
                  {px1 !== null && px2 !== null && <div style={{ position: 'absolute', left: px1, width: Math.max(4, px2 - px1), top: RH / 2 - 12, height: 9, borderRadius: 5, background: '#BFDBFE' }} />}
                  {ax1 !== null && ax2 !== null && <div style={{ position: 'absolute', left: ax1, width: Math.max(4, ax2 - ax1), top: RH / 2 + 3, height: 9, borderRadius: 5, background: bad ? '#FCA5A5' : '#A7F3D0' }} />}
                  {todayX !== null && <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: 2, background: '#EF4444', opacity: 0.6, zIndex: 3 }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '7px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFF' }}>
        <span style={{ fontSize: 11, color: T.faint, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#BFDBFE', display: 'inline-block' }} /> Plan
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#A7F3D0', display: 'inline-block', marginLeft: 4 }} /> Actual
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FCA5A5', display: 'inline-block', marginLeft: 4 }} /> Delayed
        </span>
        <span style={{ fontSize: 11, color: T.faint }}>
          {tasks.length} tasks · {TL_S.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {TL_E.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────
function ListView({ tasks, onEdit, onDel, onTog, onReorder }: any) {
  const [pendingDel, setPendingDel] = useState<number | null>(null);
  const [dragId, setDragId]         = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const from = tasks.findIndex((t: any) => t.id === dragId);
    const to   = tasks.findIndex((t: any) => t.id === targetId);
    const reordered = [...tasks];
    reordered.splice(from, 1);
    reordered.splice(to, 0, tasks[from]);
    onReorder(reordered);
    setDragId(null); setDragOverId(null);
  };

  return (
    <div style={{ ...T.card, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FAFBFF', borderBottom: `2px solid ${T.border}` }}>
            {['', '#', 'Task Subject', 'Done', 'Status', 'PIC', ''].map((h) => (
              <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: T.faint, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t: any, i: number) => {
            const st = getStatus(t), sc = SC[st];
            const isDragging   = dragId === t.id;
            const isDragOver   = dragOverId === t.id && dragId !== t.id;
            const isConfirming = pendingDel === t.id;
            return (
              <tr key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(t.id); }}
                onDrop={() => handleDrop(t.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                style={{ borderBottom: `1px solid ${T.border}`, background: isDragOver ? '#EEF2FF' : i % 2 === 0 ? '#fff' : '#FAFBFF', opacity: isDragging ? 0.4 : 1, transition: 'background 0.1s' }}>
                <td style={{ padding: '0 8px', width: 20, cursor: 'grab', color: T.faint, fontSize: 14, textAlign: 'center', userSelect: 'none' }}>⠿</td>
                <td style={{ padding: '11px 14px', color: T.faint, width: 30 }}>{i + 1}</td>
                <td style={{ padding: '11px 14px', maxWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ color: t.done ? T.faint : T.text, textDecoration: t.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                  </div>
                </td>
                <td style={{ padding: '11px 14px', textAlign: 'center', width: 50 }}>
                  <div onClick={() => onTog(t.id)} style={{ width: 19, height: 19, borderRadius: 6, border: `2px solid ${t.done ? '#10B981' : '#CBD5E1'}`, background: t.done ? '#10B981' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {t.done && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ background: sc.bg, color: sc.tx, padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st}</span>
                </td>
                <td style={{ padding: '11px 14px', color: T.muted, whiteSpace: 'nowrap' }}>{t.pic || '–'}</td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  {isConfirming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>Delete?</span>
                      <button onClick={() => { onDel(t.id); setPendingDel(null); }} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
                      <button onClick={() => setPendingDel(null)} style={{ background: '#F1F5F9', color: T.muted, border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>✗</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => onEdit(t)} style={{ background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                      <button onClick={() => setPendingDel(t.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontSize: 11 }}>Del</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Board View ────────────────────────────────────────────────────────
function BoardView({ tasks, onEdit, onDel, onTog }: any) {
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
      {['Planned', 'In Progress', 'Overdue', 'Delayed', 'Done'].map((col) => {
        const ct = tasks.filter((t: any) => getStatus(t) === col), sc = SC[col];
        return (
          <div key={col} style={{ flexShrink: 0, width: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>{col}</span>
              <span style={{ marginLeft: 'auto', background: sc.bg, color: sc.tx, borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 700 }}>{ct.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {ct.map((t: any) => (
                <div key={t.id} style={{ ...T.card, padding: '13px 15px' }}>
                  <div style={{ fontWeight: 700, color: T.text, fontSize: 12, marginBottom: 5, lineHeight: 1.4 }}>{t.subject}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>PIC: {t.pic || '–'}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>Due: {fmt(t.planEnd)}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => onTog(t.id)} style={{ flex: 1, background: sc.bg, color: sc.tx, border: `1px solid ${sc.dot}33`, borderRadius: 7, padding: '5px 0', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{t.done ? 'Reopen' : 'Mark Done'}</button>
                    <button onClick={() => onEdit(t)} style={{ ...T.btnGhost, padding: '5px 9px', fontSize: 11 }}>✏</button>
                    <button onClick={() => onDel(t.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                </div>
              ))}
              {ct.length === 0 && <div style={{ ...T.card, color: T.faint, fontSize: 12, textAlign: 'center', padding: '22px 0', border: `1.5px dashed ${T.border}`, boxShadow: 'none' }}>No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kanban View ───────────────────────────────────────────────────────
function KanbanView({ tasks, onEdit, onDel, onTog }: any) {
  return (
    <div style={{ ...T.card, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
        {['Planned', 'In Progress', 'Overdue', 'Delayed', 'Done'].map((col) => {
          const ct = tasks.filter((t: any) => getStatus(t) === col), sc = SC[col];
          return (
            <div key={col} style={{ borderRight: `1px solid ${T.border}`, minHeight: 300 }}>
              <div style={{ padding: '11px 13px', background: sc.bg, borderBottom: `2px solid ${sc.dot}55`, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot }} />
                <span style={{ fontWeight: 700, color: sc.tx, fontSize: 12 }}>{col}</span>
                <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.7)', color: sc.tx, borderRadius: 20, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>{ct.length}</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ct.map((t: any) => (
                  <div key={t.id} style={{ ...T.card, padding: '9px 11px', boxShadow: 'none', background: '#FAFBFF' }}>
                    <div style={{ fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.3, fontSize: 11 }}>{t.subject}</div>
                    <div style={{ color: T.muted, fontSize: 10, marginBottom: 8 }}>{t.pic || '–'} · {fmt(t.planEnd)}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => onTog(t.id)} style={{ flex: 1, background: sc.bg, color: sc.tx, border: 'none', borderRadius: 6, padding: '4px 0', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{t.done ? 'Reopen' : 'Done'}</button>
                      <button onClick={() => onEdit(t)} style={{ background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 10 }}>✏</button>
                      <button onClick={() => onDel(t.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                    </div>
                  </div>
                ))}
                {ct.length === 0 && <div style={{ color: T.faint, fontSize: 11, textAlign: 'center', padding: '20px 0' }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────
function TaskModal({ task, onSave, onClose }: any) {
  const [f, setF] = useState(() => task ? { ...task } : { subject: '', planStart: '', planEnd: '', actStart: '', actEnd: '', pic: '', done: false });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  if (task === 'generate') {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...T.card, padding: 36, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>✨</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: T.text }}>AI Task Generation</h3>
          <div style={{ display: 'inline-block', background: '#EEF2FF', color: T.accent, fontSize: 10, fontWeight: 700, padding: '3px 11px', borderRadius: 20, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 16 }}>Coming Soon</div>
          <p style={{ margin: '0 0 26px', fontSize: 13, color: T.muted, lineHeight: 1.7 }}>Automatically generate tasks using AI. This feature is currently under development and will be available soon.</p>
          <button onClick={onClose} style={T.btnPrimary}>Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...T.card, padding: 28, width: 500, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        <h3 style={{ margin: '0 0 22px', fontSize: 16, fontWeight: 700, color: T.text }}>{task ? 'Edit Task' : 'Add New Task'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={T.label}>Task Subject *</label>
            <input value={f.subject} onChange={(e) => upd('subject', e.target.value)} placeholder="Enter task name…" style={T.input} />
          </div>
          <div><label style={T.label}>Plan Start</label><input type="date" value={f.planStart} onChange={(e) => upd('planStart', e.target.value)} style={T.input} /></div>
          <div><label style={T.label}>Plan End</label><input type="date" value={f.planEnd} onChange={(e) => upd('planEnd', e.target.value)} style={T.input} /></div>
          <div><label style={T.label}>Act. Start</label><input type="date" value={f.actStart} onChange={(e) => upd('actStart', e.target.value)} style={T.input} /></div>
          <div><label style={T.label}>Act. End</label><input type="date" value={f.actEnd} onChange={(e) => upd('actEnd', e.target.value)} style={T.input} /></div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={T.label}>PIC</label>
            <input value={f.pic} onChange={(e) => upd('pic', e.target.value)} placeholder="Person in charge…" style={T.input} />
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => upd('done', !f.done)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${f.done ? '#10B981' : '#CBD5E1'}`, background: f.done ? '#10B981' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
              {f.done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: T.muted, cursor: 'pointer' }} onClick={() => upd('done', !f.done)}>Mark as completed</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={T.btnGhost}>Cancel</button>
          <button onClick={() => { if (f.subject.trim()) onSave(f); }} style={{ ...T.btnPrimary, opacity: f.subject.trim() ? 1 : 0.4 }}>
            {task ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Modal ─────────────────────────────────────────────────────
function ProjectModal({ project, onSave, onClose }: any) {
  const [f, setF] = useState(() => project
    ? { ...project, planStart: project.plan_start || '', planEnd: project.plan_end || '' }
    : { name: '', irCode: '', description: '', color: '#6366F1', planStart: '', planEnd: '' });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...T.card, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        <h3 style={{ margin: '0 0 22px', fontSize: 16, fontWeight: 700, color: T.text }}>{project ? 'Edit Project' : 'New Project'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div><label style={T.label}>Project Name *</label><input value={f.name} onChange={(e) => upd('name', e.target.value)} placeholder="e.g. ERP System Implementation" style={T.input} /></div>
          <div><label style={T.label}>IR Code</label><input value={f.irCode || ''} onChange={(e) => upd('irCode', e.target.value)} placeholder="e.g. IR-CRA-2025-001" style={T.input} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={T.label}>Plan Start</label><input type="date" value={f.planStart || ''} onChange={(e) => upd('planStart', e.target.value)} style={T.input} /></div>
            <div><label style={T.label}>Plan End</label><input type="date" value={f.planEnd || ''} onChange={(e) => upd('planEnd', e.target.value)} style={T.input} /></div>
          </div>
          <div><label style={T.label}>Description</label><textarea value={f.description || ''} onChange={(e) => upd('description', e.target.value)} placeholder="Brief project description…" style={{ ...T.input, minHeight: 72, resize: 'vertical' } as any} /></div>
          <div>
            <label style={T.label}>Project Color</label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {PROJ_COLORS.map((c) => (
                <button key={c} onClick={() => upd('color', c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: f.color === c ? `3px solid #0F172A` : `3px solid transparent`, cursor: 'pointer', outline: 'none', transition: 'all 0.15s' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={T.btnGhost}>Cancel</button>
          <button onClick={() => { if (f.name.trim()) onSave(f); }} style={{ ...T.btnPrimary, opacity: f.name.trim() ? 1 : 0.4 }}>
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
