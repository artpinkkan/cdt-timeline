import { useState, useRef, useEffect, Component } from 'react';
import { projectsApi, tasksApi } from './api/client';
import { useAuth } from './auth/AuthContext';
import * as XLSX from 'xlsx';

class ErrorBoundary extends Component<{ children: any }, { error: any }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#EF4444', background: '#FEF2F2', minHeight: '100vh' }}>
        <h2 style={{ marginBottom: 12 }}>⚠ Render Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.error?.message || this.state.error)}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#6B7280', marginTop: 12 }}>{this.state.error?.stack}</pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Dismiss</button>
      </div>
    );
    return this.props.children;
  }
}

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

const getStatus = (t: any): string => {
  if (t.actEnd) return t.planEnd && new Date(t.actEnd) > new Date(t.planEnd) ? 'Delayed' : 'Done';
  if (t.planEnd && TODAY > new Date(t.planEnd)) return 'Overdue';
  if (t.actStart) return 'In Progress';
  return 'Planned';
};

// Month boundaries for MTD — computed once at module level (constant per session)
const _MTD_MONTH = TODAY.getMonth(), _MTD_YEAR = TODAY.getFullYear();
const _MONTH_START = new Date(_MTD_YEAR, _MTD_MONTH, 1);
const _MONTH_END   = new Date(_MTD_YEAR, _MTD_MONTH + 1, 0);
const overlapsThisMonth = (t: any) =>
  !!t.planStart && !!t.planEnd &&
  new Date(t.planStart) <= _MONTH_END &&
  new Date(t.planEnd)   >= _MONTH_START;

const fmt = (ds: string) => (ds ? new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '–');

// ── Confirm / Delete modal ────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(5px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', width: 380, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 18px' }}>🗑️</div>
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: T.text }}>{title}</h3>
        <p style={{ margin: '0 0 26px', fontSize: 13, color: T.muted, lineHeight: 1.65 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '9px 22px', borderRadius: 9, border: `1px solid ${T.border}`, background: '#fff', color: T.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const loadScript = (src: string) =>
  new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(null); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(null); s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

async function buildProjectPDF(project: any, tasks: any[], kpis: any[]): Promise<any> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const N = tasks.length, done = tasks.filter((t) => t.actEnd).length, pct = N ? Math.round((done / N) * 100) : 0;

  // hex color → [r,g,b]
  const hex2rgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };

  // ── Page 1: Header + KPIs + Task Table ────────────────────────────────
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PW, 28, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(project.name, 14, 11);
  if (project.irCode) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(project.irCode, 14, 19);
  }
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}   ·   ${done}/${N} tasks completed`, PW - 14, 19, { align: 'right' });

  // ── 5 KPI cards ──────────────────────────────────────────────────────
  const CARD_Y = 32, CARD_H = 22, CARD_GAP = 3;
  const CARD_W = (PW - 28 - CARD_GAP * 4) / 5; // 14mm margins each side
  kpis.forEach((k: any, ki: number) => {
    const kx = 14 + ki * (CARD_W + CARD_GAP);
    const [r, g, b] = hex2rgb(k.c);
    doc.setFillColor(248, 250, 252); doc.roundedRect(kx, CARD_Y, CARD_W, CARD_H, 1.5, 1.5, 'F');
    doc.setFillColor(r, g, b); doc.roundedRect(kx, CARD_Y, 2, CARD_H, 0.5, 0.5, 'F');
    doc.setTextColor(148, 163, 184); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
    doc.text(k.l.toUpperCase(), kx + 4, CARD_Y + 5.5);
    doc.setTextColor(r, g, b); doc.setFontSize(ki === 3 ? 11 : 13); doc.setFont('helvetica', 'bold');
    doc.text(String(k.v), kx + 4, CARD_Y + 14);
    doc.setTextColor(148, 163, 184); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(String(k.sub), kx + 4, CARD_Y + 20);
  });

  const stClr: any = { Done: [16, 185, 129], Delayed: [239, 68, 68], 'In Progress': [99, 102, 241], Overdue: [245, 158, 11], Planned: [107, 114, 128] };
  (doc as any).autoTable({
    startY: 58,
    head: [['#', 'Task Subject', 'Status', 'Plan Start', 'Plan End', 'Act. Start', 'Act. End', 'PIC']],
    body: tasks.map((t, i) => [i + 1, t.subject, getStatus(t), fmt(t.planStart), fmt(t.planEnd), fmt(t.actStart), fmt(t.actEnd), t.pic || '–']),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 26 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 22 }, 7: { cellWidth: 20 } },
    didParseCell(data: any) {
      if (data.section === 'body' && data.column.index === 2) { const c = stClr[data.cell.raw] || [0, 0, 0]; data.cell.styles.textColor = c; data.cell.styles.fontStyle = 'bold'; }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Page 2+: Gantt Chart ─────────────────────────────────────────────
  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));

  const ML = 14, MR = 14; // left/right margin
  const LBL_W = 72;       // label column width
  const ROW_H = 7;        // row height mm
  const ROWS_PER_PAGE = 22; // max task rows per gantt page
  const HDR_H = 16;       // total header height (month band 8 + week row 8)
  const PAGE_TITLE_H = 16; // dark title bar height
  const DATA_START = PAGE_TITLE_H + HDR_H; // y where rows begin = 32

  const drawGanttPage = (pageTasks: any[], startIdx: number, totalPages: number, pageNum: number) => {
    doc.addPage();
    const TL_X = ML + LBL_W;
    const TL_W = PW - TL_X - MR;
    const FOOTER_Y = PH - 8;

    // ── Page title bar ──────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PW, PAGE_TITLE_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`${project.name} — Gantt Chart`, ML, 10);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    const pageLabel = totalPages > 1 ? ` (${pageNum}/${totalPages})` : '';
    doc.text(`${done}/${N} tasks done${pageLabel}`, PW - MR, 10, { align: 'right' });

    if (allDates.length === 0) {
      doc.setTextColor(148, 163, 184); doc.setFontSize(10);
      doc.text('No task dates available.', PW / 2, 80, { align: 'center' });
      return;
    }

    const minD = new Date(Math.min(...allDates.map((d: string) => new Date(d).getTime())));
    const maxD = new Date(Math.max(...allDates.map((d: string) => new Date(d).getTime())));
    const tlS = new Date(minD.getTime() - 7 * 86400000);
    const tlE = new Date(maxD.getTime() + 7 * 86400000);
    const tlDays = (tlE.getTime() - tlS.getTime()) / 86400000;
    const d2x = (ds: string) => TL_X + ((new Date(ds).getTime() - tlS.getTime()) / 86400000 / tlDays) * TL_W;

    // ── Build week columns ──────────────────────────────────────────────
    const numWeeks = Math.ceil(tlDays / 7);
    const weeks: { x: number; w: number; wkNum: number; d: Date }[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const wkS = new Date(tlS.getTime() + i * 7 * 86400000);
      weeks.push({
        x: TL_X + (i * 7 / tlDays) * TL_W,
        w: (7 / tlDays) * TL_W,
        wkNum: Math.ceil(wkS.getDate() / 7),
        d: wkS,
      });
    }

    // ── Build month bands ───────────────────────────────────────────────
    const bands: { label: string; x: number; w: number }[] = [];
    weeks.forEach(wk => {
      const lbl = wk.d.toLocaleString('en-US', { month: 'short' }) + " '" + String(wk.d.getFullYear()).slice(2);
      const last = bands[bands.length - 1];
      if (last && last.label === lbl) last.w += wk.w;
      else bands.push({ label: lbl, x: wk.x, w: wk.w });
    });

    const BAND_Y  = PAGE_TITLE_H + 4;  // month band — 4mm gap below title bar
    const WEEK_Y  = BAND_Y + 8;        // week row
    const HDR_BOT = WEEK_Y + 8;        // bottom of header bands
    const GAP_H   = 4;                 // breathing room between header and first row
    const ROW_START = HDR_BOT + GAP_H; // y where task rows actually begin

    const dataEndY = ROW_START + pageTasks.length * ROW_H;

    // ── Draw vertical week grid lines (behind everything) ───────────────
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.15);
    weeks.forEach(wk => {
      doc.line(wk.x, BAND_Y, wk.x, dataEndY); // extends through gap into rows
    });

    // ── Month band row ──────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.rect(TL_X, BAND_Y, TL_W, 8, 'F');
    // label column header bg
    doc.setFillColor(30, 41, 59);
    doc.rect(ML, BAND_Y, LBL_W, 8, 'F');
    doc.setTextColor(203, 213, 225); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('Task Subject', ML + 3, BAND_Y + 5.5);
    // month labels clipped to their band
    bands.forEach(b => {
      doc.setDrawColor(71, 85, 105); doc.setLineWidth(0.3);
      doc.line(b.x, BAND_Y, b.x, BAND_Y + 8);
      if (b.w > 4) {
        doc.setTextColor(203, 213, 225); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
        // no maxWidth — prevents jsPDF from wrapping the label onto two lines
        doc.text(b.label, b.x + b.w / 2, BAND_Y + 5.5, { align: 'center' });
      }
    });

    // ── Week label row ──────────────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(ML, WEEK_Y, LBL_W + TL_W, 8, 'F');
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.line(ML, WEEK_Y, ML + LBL_W + TL_W, WEEK_Y); // top border
    weeks.forEach(wk => {
      if (wk.w > 3) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
        doc.text(`W${wk.wkNum}`, wk.x + wk.w / 2, WEEK_Y + 5.5, { align: 'center' });
      }
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.15);
      doc.line(wk.x, WEEK_Y, wk.x, WEEK_Y + 8);
    });
    // header bottom border
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.4);
    doc.line(ML, HDR_BOT, ML + LBL_W + TL_W, HDR_BOT);
    // vertical separator between label col and timeline
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.line(ML + LBL_W, BAND_Y, ML + LBL_W, dataEndY);

    // ── Task rows ───────────────────────────────────────────────────────
    pageTasks.forEach((t: any, i: number) => {
      const y = ROW_START + i * ROW_H;
      const globalIdx = startIdx + i;

      // alternating row bg
      if (globalIdx % 2 !== 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, y, LBL_W + TL_W, ROW_H, 'F');
      }

      // status dot + subject label
      const st = getStatus(t);
      const dotClr = stClr[st] || [107, 114, 128];
      doc.setFillColor(...dotClr as [number, number, number]);
      doc.circle(ML + 3, y + ROW_H / 2, 1, 'F');
      const isDone = !!t.actEnd;
      doc.setTextColor(isDone ? 148 : 30, isDone ? 163 : 41, isDone ? 184 : 59);
      doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
      const maxChars = 46;
      const subj = t.subject.length > maxChars ? t.subject.slice(0, maxChars) + '…' : t.subject;
      doc.text(subj, ML + 7, y + ROW_H / 2 + 1, { maxWidth: LBL_W - 9 });

      // plan bar
      if (t.planStart && t.planEnd) {
        const bx = d2x(t.planStart);
        const bw = Math.max(0.8, d2x(t.planEnd) - bx);
        doc.setFillColor(191, 219, 254);
        doc.roundedRect(bx, y + 1.5, bw, 2.2, 0.4, 0.4, 'F');
      }
      // actual bar
      if (t.actStart) {
        const ae = t.actEnd || new Date().toISOString().slice(0, 10);
        const bx = d2x(t.actStart);
        const bw = Math.max(0.8, d2x(ae) - bx);
        const bad = st === 'Delayed' || st === 'Overdue';
        doc.setFillColor(...(bad ? [252, 165, 165] : [167, 243, 208]) as [number, number, number]);
        doc.roundedRect(bx, y + 4, bw, 2.2, 0.4, 0.4, 'F');
      }

      // row divider
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.15);
      doc.line(ML, y + ROW_H, ML + LBL_W + TL_W, y + ROW_H);
    });

    // ── Today line ──────────────────────────────────────────────────────
    const todayStr2 = new Date().toISOString().slice(0, 10);
    const tx = d2x(todayStr2);
    if (tx >= TL_X && tx <= TL_X + TL_W) {
      doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.5);
      doc.line(tx, BAND_Y, tx, dataEndY);
    }

    // ── Legend ──────────────────────────────────────────────────────────
    const legY = Math.min(dataEndY + 5, FOOTER_Y - 8);
    ([[191, 219, 254, 'Plan'], [167, 243, 208, 'Actual'], [252, 165, 165, 'Delayed'], [239, 68, 68, 'Today']] as any[]).forEach(([r, g, b, lbl]: any, li: number) => {
      const lx = ML + li * 32;
      doc.setFillColor(r, g, b); doc.roundedRect(lx, legY, 7, 3.5, 0.5, 0.5, 'F');
      doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text(lbl, lx + 9, legY + 2.5);
    });
  };

  // Split tasks into pages if needed
  const ganttPages = Math.ceil(tasks.length / ROWS_PER_PAGE) || 1;
  for (let pg = 0; pg < ganttPages; pg++) {
    const slice = tasks.slice(pg * ROWS_PER_PAGE, (pg + 1) * ROWS_PER_PAGE);
    drawGanttPage(slice, pg * ROWS_PER_PAGE, ganttPages, pg + 1);
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
  const PW = 297, PH = 210;

  const hex2rgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };

  // ── Compute overall KPIs ──────────────────────────────────────────────
  const allTasks = Object.values(projectTasks).flat() as any[];
  const N = allTasks.length;
  const totalDone   = allTasks.filter((t: any) => t.actEnd).length;
  const totalTgtDue = allTasks.filter((t: any) => t.planEnd && new Date(t.planEnd) <= TODAY).length;
  const actPct = N ? (totalDone / N) * 100 : 0;
  const tgtPct = N ? (totalTgtDue / N) * 100 : 0;
  const achPct = tgtPct > 0 ? (actPct / tgtPct) * 100 : actPct > 0 ? 100 : 0;

  const statusTotals: Record<string, number> = { Done: 0, 'In Progress': 0, Overdue: 0, Planned: 0 };
  allTasks.forEach((t: any) => { const s = getStatus(t); if (s in statusTotals) statusTotals[s]++; });

  // ── Header (compact) ─────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PW, 15, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('All Projects Report', 14, 7);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  ${projects.length} projects  ·  ${N} tasks  ·  ${totalDone} completed`,
    PW - 14, 7, { align: 'right' }
  );

  // ── 5 KPI summary cards (compact) ────────────────────────────────────
  const CARD_Y = 18, CARD_H = 14, CARD_GAP = 2.5;
  const CARD_W = (PW - 28 - CARD_GAP * 4) / 5;
  const summaryKpis = [
    { l: 'Total Projects',    v: String(projects.length),           sub: `${N} total tasks`,                    c: '#6366F1' },
    { l: '% Target YTD',      v: N ? `${tgtPct.toFixed(1)}%` : '–', sub: `${totalTgtDue}/${N} tasks due today`, c: '#8B5CF6' },
    { l: '% Actual YTD',      v: N ? `${actPct.toFixed(1)}%` : '–', sub: `${totalDone}/${N} tasks completed`,   c: '#10B981' },
    { l: '% Achievement YTD', v: N ? `${achPct.toFixed(1)}%` : '–', sub: 'Actual ÷ Target',                    c: achPct < 80 ? '#EF4444' : '#10B981' },
    { l: 'Tasks Overdue',     v: String(statusTotals['Overdue']),    sub: `${statusTotals['In Progress']} in progress`, c: '#EF4444' },
  ];
  summaryKpis.forEach((k, ki) => {
    const kx = 14 + ki * (CARD_W + CARD_GAP);
    const [r, g, b] = hex2rgb(k.c);
    doc.setFillColor(248, 250, 252); doc.roundedRect(kx, CARD_Y, CARD_W, CARD_H, 1, 1, 'F');
    doc.setFillColor(r, g, b); doc.roundedRect(kx, CARD_Y, 1.8, CARD_H, 0.5, 0.5, 'F');
    doc.setTextColor(148, 163, 184); doc.setFontSize(5); doc.setFont('helvetica', 'bold');
    doc.text(k.l.toUpperCase(), kx + 3.5, CARD_Y + 4);
    doc.setTextColor(r, g, b); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(k.v, kx + 3.5, CARD_Y + 10);
    doc.setTextColor(148, 163, 184); doc.setFontSize(5); doc.setFont('helvetica', 'normal');
    doc.text(k.sub, kx + 3.5, CARD_Y + 13.5);
  });

  // ── Project summary table ─────────────────────────────────────────────
  const stClr: any = { Done: [16,185,129], 'In Progress': [99,102,241], Overdue: [239,68,68], Planned: [107,114,128] };
  const tableBody = projects.map((p, i) => {
    const pt = (projectTasks[p.id] || []) as any[];
    const pN = pt.length;
    const pDone    = pt.filter((t: any) => t.actEnd).length;
    const pTgtDue  = pt.filter((t: any) => t.planEnd && new Date(t.planEnd) <= TODAY).length;
    const pActPct  = pN ? (pDone / pN) * 100 : 0;
    const pTgtPct  = pN ? (pTgtDue / pN) * 100 : 0;
    const pAchPct  = pTgtPct > 0 ? (pActPct / pTgtPct) * 100 : pActPct > 0 ? 100 : 0;
    const pEnd     = p.plan_end ? new Date(p.plan_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '–';
    const pCounts: Record<string,number> = { Done:0,'In Progress':0,Overdue:0,Planned:0 };
    pt.forEach((t: any) => { const s = getStatus(t); if (s in pCounts) pCounts[s]++; });
    return [
      i + 1,
      p.name,
      p.irCode || '–',
      pN,
      `${pTgtPct.toFixed(0)}%`,
      `${pActPct.toFixed(0)}%`,
      `${pAchPct.toFixed(0)}%`,
      pCounts['Done'],
      pCounts['In Progress'],
      pCounts['Overdue'],
      pEnd,
    ];
  });

  (doc as any).autoTable({
    startY: 35,
    head: [['#', 'Project Name', 'IR Code', 'Tasks', 'Target%', 'Actual%', 'Achiev%', 'Done', 'Active', 'Overdue', 'Plan End']],
    body: tableBody,
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7, fontStyle: 'bold', cellPadding: 1.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0:  { cellWidth: 8,  halign: 'center' },
      2:  { cellWidth: 22 },
      3:  { cellWidth: 14, halign: 'center' },
      4:  { cellWidth: 18, halign: 'center' },
      5:  { cellWidth: 18, halign: 'center' },
      6:  { cellWidth: 18, halign: 'center' },
      7:  { cellWidth: 14, halign: 'center' },
      8:  { cellWidth: 14, halign: 'center' },
      9:  { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 20, halign: 'center' },
    },
    didParseCell(data: any) {
      if (data.section !== 'body') return;
      // Color % Achievement column
      if (data.column.index === 6) {
        const val = parseFloat(data.cell.raw);
        data.cell.styles.textColor = val < 80 ? [239,68,68] : [16,185,129];
        data.cell.styles.fontStyle = 'bold';
      }
      // Color Overdue column
      if (data.column.index === 9 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = [239,68,68];
        data.cell.styles.fontStyle = 'bold';
      }
      // Color Done column
      if (data.column.index === 7 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = [16,185,129];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer ────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`All Projects Report — Page ${i} of ${pages}`, 14, PH - 6);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, PW - 14, PH - 6, { align: 'right' });
  }
  doc.save(`All_Projects_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── App ───────────────────────────────────────────────────────────────
function AppInner() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<Record<number, any[]>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState('gantt');
  const [taskModal, setTaskModal] = useState<any>(null);
  const [projModal, setProjModal] = useState<any>(null);
  const [delProjConfirm, setDelProjConfirm] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [actMonth, setActMonth] = useState('');
  const [tgtMonth, setTgtMonth] = useState('');
  const [mtdMonthSel, setMtdMonthSel] = useState(() => `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`);
  const gRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Render cached data instantly while fresh data loads in background
    try {
      const cached = localStorage.getItem('fp_cache');
      if (cached) {
        const { projects: cp, projectTasks: ct } = JSON.parse(cached);
        setProjects(cp);
        setProjectTasks(ct);
      }
    } catch {}

    (async () => {
      try {
        const projs = await projectsApi.list();
        // Apply saved sort order from localStorage
        const savedOrder: number[] = JSON.parse(localStorage.getItem('fp_proj_order') || '[]');
        if (savedOrder.length) {
          projs.sort((a: any, b: any) => {
            const ai = savedOrder.indexOf(a.id), bi = savedOrder.indexOf(b.id);
            return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
          });
        }
        setProjects(projs);
        // Fetch all project tasks in parallel — allSettled so a slow/failed project doesn't block others
        const results = await Promise.allSettled(projs.map((p: any) => tasksApi.list(p.id)));
        const pt: Record<number, any[]> = {};
        projs.forEach((p: any, i: number) => {
          pt[p.id] = results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<any[]>).value : (projectTasks[p.id] || []);
        });
        setProjectTasks(pt);
        try { localStorage.setItem('fp_cache', JSON.stringify({ projects: projs, projectTasks: pt })); } catch {}
      } catch (e) { console.error(e); }
    })();
  }, []);

  const proj = projects.find((p) => p.id === activeId) || null;
  const tasks = activeId ? projectTasks[activeId] || [] : [];

  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));
  const validDates = allDates.filter((d: string) => { const t = new Date(d).getTime(); return !isNaN(t) && new Date(d).getFullYear() < 2100; });
  const minDate = validDates.length ? new Date(Math.min(...validDates.map((d: string) => new Date(d).getTime()))) : new Date(2026, 0, 1);
  const maxDate = validDates.length ? new Date(Math.max(...validDates.map((d: string) => new Date(d).getTime()))) : new Date(2027, 11, 31);
  const tlS = new Date(minDate.getTime() - 30 * 86400000), tlE = new Date(maxDate.getTime() + 30 * 86400000);
  const tlDays = (tlE.getTime() - tlS.getTime()) / 86400000;
  const txDay = (ds: string) => (ds ? Math.round(((new Date(ds).getTime() - tlS.getTime()) / 86400000 / tlDays) * TL_W) : null);
  const todayX = txDay(todayStr);

  const updateCache = (nextProjects: any[], nextTasks: Record<number, any[]>) => {
    try { localStorage.setItem('fp_cache', JSON.stringify({ projects: nextProjects, projectTasks: nextTasks })); } catch {}
  };

  const saveProject = async (p: any) => {
    // Normalize to camelCase (server expects camelCase in body; project objects from server use snake_case)
    const payload = {
      name:               p.name,
      irCode:             p.irCode             ?? p.ir_code             ?? null,
      description:        p.description        ?? null,
      color:              p.color              ?? '#3B82F6',
      planStart:          p.planStart          ?? p.plan_start          ?? null,
      planEnd:            p.planEnd            ?? p.plan_end            ?? null,
      strategicDirection: p.strategicDirection ?? p.strategic_direction ?? null,
    };
    try {
      let nextProjects: any[];
      if (p.id) {
        const updated = await projectsApi.update(p.id, payload);
        nextProjects = projects.map((x) => (x.id === p.id ? updated : x));
      } else {
        const c = await projectsApi.create(payload);
        nextProjects = [...projects, c];
        const nextTasks = { ...projectTasks, [c.id]: [] };
        setProjectTasks(nextTasks);
        updateCache(nextProjects, nextTasks);
      }
      setProjects(nextProjects);
      updateCache(nextProjects, projectTasks);
      setProjModal(null);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save project: ${e?.message || 'Unknown error'}. Please try again.`);
    }
  };
  const delProject = async (id: number) => {
    try {
      await projectsApi.delete(id);
      const nextProjects = projects.filter((p: any) => p.id !== id);
      const nextTasks = { ...projectTasks }; delete nextTasks[id];
      setProjects(nextProjects); setProjectTasks(nextTasks);
      updateCache(nextProjects, nextTasks);
      if (activeId === id) setActiveId(null);
    } catch (e) { console.error(e); }
  };
  const saveTask = async (t: any) => {
    try {
      if (activeId) {
        let nextTasks: any[];
        if (t.id) { await tasksApi.update(activeId, t.id, t); nextTasks = tasks.map((x) => (x.id === t.id ? t : x)); }
        else { const c = await tasksApi.create(activeId, t); nextTasks = [...tasks, c]; }
        const nextProjectTasks = { ...projectTasks, [activeId]: nextTasks };
        setProjectTasks(nextProjectTasks);
        updateCache(projects, nextProjectTasks);
      }
      setTaskModal(null);
    } catch (e) { console.error(e); }
  };
  const delTask = async (id: number) => {
    try {
      if (activeId) {
        await tasksApi.delete(activeId, id);
        const nextProjectTasks = { ...projectTasks, [activeId]: tasks.filter((x) => x.id !== id) };
        setProjectTasks(nextProjectTasks);
        updateCache(projects, nextProjectTasks);
      }
    } catch (e) { console.error(e); }
  };
  const syncTasksFromUpload = async (parsedTasks: any[]): Promise<string> => {
    if (!activeId) return 'No active project';
    const current = projectTasks[activeId] || [];
    const toUpdate: { existing: any; incoming: any }[] = [];
    const toCreate: any[] = [];
    const toDelete: any[] = [];
    parsedTasks.forEach((inc: any) => {
      const match = current.find((t: any) => t.subject.trim().toLowerCase() === inc.subject.trim().toLowerCase());
      match ? toUpdate.push({ existing: match, incoming: inc }) : toCreate.push(inc);
    });
    current.forEach((t: any) => {
      if (!parsedTasks.find((p: any) => p.subject.trim().toLowerCase() === t.subject.trim().toLowerCase())) toDelete.push(t);
    });
    try {
      await Promise.all(toUpdate.map(({ existing, incoming }) => tasksApi.update(activeId, existing.id, incoming)));
      await Promise.all(toCreate.map((inc: any) => tasksApi.create(activeId, inc)));
      for (const t of toDelete) await tasksApi.delete(activeId, t.id);
      const updated = await tasksApi.list(activeId);
      const next = { ...projectTasks, [activeId]: updated };
      setProjectTasks(next);
      updateCache(projects, next);
      return `Updated ${toUpdate.length} · Created ${toCreate.length} · Deleted ${toDelete.length}`;
    } catch (e) { console.error(e); return 'Sync failed'; }
  };
  const reorderTasks = async (newOrder: any[]) => {
    if (!activeId) return;
    setProjectTasks({ ...projectTasks, [activeId]: newOrder });
    try { await tasksApi.reorder(activeId, newOrder.map((t: any) => t.id)); }
    catch (e) { console.error(e); }
  };

  const N = tasks.length;
  // All months in the project's full date range (minDate → maxDate) — shared by all dropdowns
  const projectMonthRange: string[] = (() => {
    if (!allDates.length) return [];
    const result: string[] = [];
    let y = minDate.getFullYear(), m = minDate.getMonth();
    const ey = Math.min(maxDate.getFullYear(), minDate.getFullYear() + 10); // cap at 10 years to guard bad dates
    const em = maxDate.getFullYear() > minDate.getFullYear() + 10 ? 11 : maxDate.getMonth();
    while (y < ey || (y === ey && m <= em)) {
      result.push(`${y}-${String(m + 1).padStart(2, '0')}`);
      m++; if (m > 11) { m = 0; y++; }
    }
    return result;
  })();
  // %Target YTD cutoff: end of selected month, or TODAY if none selected
  const tgtCutoffDate: Date = tgtMonth
    ? (() => { const [y, m] = tgtMonth.split('-').map(Number); return new Date(y, m, 0, 23, 59, 59); })()
    : TODAY;
  // % Target YTD = tasks planned to be done by cutoff / all tasks in the project
  const tgtDue = tasks.filter((t: any) => !!t.planEnd && new Date(t.planEnd) <= tgtCutoffDate).length;
  const tgt = N > 0 ? (tgtDue / N) * 100 : 0;
  // %Actual YTD cutoff: end of selected month, or all-time if none selected
  const actCutoffDate: Date = actMonth
    ? (() => { const [y, m] = actMonth.split('-').map(Number); return new Date(y, m, 0, 23, 59, 59); })()
    : new Date(8640000000000000);
  // % Actual YTD = tasks with actEnd ≤ cutoff / all tasks
  const actDone = tasks.filter((t: any) => !!t.actEnd && new Date(t.actEnd) <= actCutoffDate).length;
  const act = N ? (actDone / N) * 100 : 0;
  const ach = tgt > 0 ? (act / tgt) * 100 : act > 0 ? 100 : 0;
  const tgtLabel = tgtMonth ? (() => { const [y,m] = tgtMonth.split('-').map(Number); return new Date(y,m-1,1).toLocaleString('en-US',{month:'short',year:'numeric'}); })() : 'Today';
  const actLabel = actMonth ? (() => { const [y,m] = actMonth.split('-').map(Number); return new Date(y,m-1,1).toLocaleString('en-US',{month:'short',year:'numeric'}); })() : 'All time';
  // Plan Completion from project-level plan_end (editable via Edit Project modal)
  const pc = proj?.plan_end ? new Date(proj.plan_end).toLocaleString('en-US', { month: 'short', year: 'numeric' }) : '–';
  // % MTD = tasks whose plan overlaps the selected month vs those actually started/done
  const [mtdSelYear, mtdSelMo] = mtdMonthSel.split('-').map(Number);
  const mtdSelStart = new Date(mtdSelYear, mtdSelMo - 1, 1);
  const mtdSelEnd   = new Date(mtdSelYear, mtdSelMo, 0, 23, 59, 59);
  const overlapsMtdSel = (t: any) =>
    !!t.planStart && !!t.planEnd &&
    new Date(t.planStart) <= mtdSelEnd &&
    new Date(t.planEnd)   >= mtdSelStart;
  const mtdTargetTasks = tasks.filter(overlapsMtdSel);
  const mtdTarget = mtdTargetTasks.length;
  const mtdActual = mtdTargetTasks.filter((t: any) => t.actStart || t.actEnd).length;
  const mtd = mtdTarget > 0 ? (mtdActual / mtdTarget) * 100 : 0;
  const mtdLabel = new Date(mtdSelYear, mtdSelMo - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });


  const sidebarW = sidebarCollapsed ? 60 : 234;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13, background: T.bg }}>
      <Sidebar projects={projects} projectTasks={projectTasks} activeId={activeId} user={user} logout={logout}
        onDashboard={() => setActiveId(null)}
        onSelect={(id: number) => { setActiveId(id); setView('gantt'); setActMonth(''); setTgtMonth(''); setMtdMonthSel(`${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`); }}
        onNew={() => setProjModal('add')}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c: boolean) => !c)}
        onReorder={(reordered: any[]) => {
          setProjects(reordered);
          localStorage.setItem('fp_proj_order', JSON.stringify(reordered.map((p: any) => p.id)));
        }} />
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, marginLeft: sidebarW, transition: 'margin-left 0.22s cubic-bezier(.4,0,.2,1)' }}>
        {!proj
          ? <Dashboard projects={projects} projectTasks={projectTasks}
              onSelect={(id: number) => { setActiveId(id); setView('gantt'); setActMonth(''); setTgtMonth(''); setMtdMonthSel(`${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`); }}
              onNew={() => setProjModal('add')} onEdit={(p: any) => setProjModal(p)} onDelete={(p: any) => setDelProjConfirm(p)} />
          : <ProjectPage key={proj.id} project={proj} tasks={tasks} view={view} setView={setView} gRef={gRef} todayX={todayX}
              kpis={[
                { l: '% Target YTD',      v: N > 0 ? `${tgt.toFixed(1)}%` : '–', sub: `${tgtDue}/${N} tasks · ${tgtLabel}`, c: '#6366F1' },
                { l: '% Actual YTD',      v: `${act.toFixed(1)}%`, sub: `${actDone}/${N} tasks · ${actLabel}`, c: '#10B981' },
                { l: '% Achievement YTD', v: `${ach.toFixed(1)}%`, sub: `${act.toFixed(1)}% ÷ ${tgt.toFixed(1)}%`, c: ach < 80 ? '#EF4444' : '#10B981' },
                { l: '% MTD',             v: mtdTarget > 0 ? `${mtd.toFixed(1)}%` : '–', sub: `${mtdActual}/${mtdTarget} tasks · ${mtdLabel}`, c: '#8B5CF6' },
                { l: 'Plan Completion',   v: pc, sub: 'Projected end', c: '#F59E0B' },
              ]}
              actMonth={actMonth} setActMonth={(m: string) => setActMonth(m)}
              tgtMonth={tgtMonth} setTgtMonth={(m: string) => setTgtMonth(m)}
              mtdMonthSel={mtdMonthSel} setMtdMonthSel={(m: string) => setMtdMonthSel(m)}
              projectMonthRange={projectMonthRange}
              onAdd={() => setTaskModal('add')} onEditTask={setTaskModal} onDelTask={delTask} onReorderTasks={reorderTasks}
              onEditProject={() => setProjModal(proj)}
              onGoToToday={() => gRef.current && (gRef.current.scrollLeft = Math.max(0, (todayX || 0) - 280))}
              onGenTasks={() => setTaskModal('generate')}
              onInlineSave={saveTask}
              onSyncUpload={syncTasksFromUpload} />
        }
      </div>
      {taskModal && <TaskModal task={taskModal === 'add' ? null : taskModal} onSave={saveTask} onClose={() => setTaskModal(null)} />}
      {projModal && <ProjectModal project={projModal === 'add' ? null : projModal} onSave={saveProject} onClose={() => setProjModal(null)} />}
      {delProjConfirm && (
        <ConfirmModal
          title="Delete Project"
          message={`Are you sure you want to delete "${delProjConfirm.name}" and all its tasks? This action cannot be undone.`}
          onConfirm={() => { delProject(delProjConfirm.id); setDelProjConfirm(null); }}
          onCancel={() => setDelProjConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ projects, projectTasks, activeId, user, logout, onDashboard, onSelect, onNew, collapsed, onToggle, onReorder }: any) {
  const totT = projects.reduce((s: number, p: any) => s + (projectTasks[p.id] || []).length, 0);
  const totD = projects.reduce((s: number, p: any) => s + (projectTasks[p.id] || []).filter((t: any) => t.actEnd).length, 0);
  const pct = totT ? Math.round((totD / totT) * 100) : 0;
  const W = collapsed ? 60 : 234;
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  return (
    <div style={{ width: W, flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 100, transition: 'width 0.22s cubic-bezier(.4,0,.2,1)', overflow: 'hidden' }}>
      {/* Logo + toggle */}
      <div style={{ padding: collapsed ? '18px 13px' : '18px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>F</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap' }}>FinalPush.io</div>
              <div style={{ color: T.faint, fontSize: 11 }}>Menuju CDT tanpa<br />#PICAPA</div>
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

        {projects.map((p: any, idx: number) => {
          const pt = projectTasks[p.id] || [], pd = pt.filter((t: any) => t.actEnd).length, pp = pt.length ? Math.round((pd / pt.length) * 100) : 0, active = activeId === p.id;
          const handleDrop = () => {
            if (dragIdx.current === null || dragIdx.current === idx) return;
            const reordered = [...projects];
            const [moved] = reordered.splice(dragIdx.current, 1);
            reordered.splice(idx, 0, moved);
            dragIdx.current = null; dragOverIdx.current = null;
            onReorder(reordered);
          };
          return (
            <div
              key={p.id}
              onDragOver={(e) => { e.preventDefault(); dragOverIdx.current = idx; }}
              onDrop={handleDrop}
              onDragEnd={() => { dragIdx.current = null; dragOverIdx.current = null; }}
              style={{ display: 'flex', alignItems: 'center', marginBottom: 2, borderRadius: 9, background: active ? '#EEF2FF' : 'transparent' }}
            >
              {!collapsed && (
                <span
                  draggable
                  onDragStart={(e) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move'; }}
                  title="Drag to reorder"
                  style={{ padding: '8px 4px 8px 8px', cursor: 'grab', color: T.faint, fontSize: 11, flexShrink: 0, lineHeight: 1, userSelect: 'none' }}
                >⠿</span>
              )}
              <button onClick={() => onSelect(p.id)} title={p.name} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '9px 0' : '8px 8px 8px 4px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 9, border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                {!collapsed && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: active ? T.accent : T.muted, fontSize: 12, fontWeight: active ? 700 : 400, lineHeight: 1.35 }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: '#F1F5F9', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pp}%`, background: p.color, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 10, color: T.faint, flexShrink: 0 }}>{pp}%</span>
                    </div>
                  </div>
                )}
              </button>
            </div>
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

// ── Overview Charts ───────────────────────────────────────────────────
function OverviewTab({ projects, projectTasks }: any) {
  const allTasks = Object.values(projectTasks).flat() as any[];
  const [selectedProjIds, setSelectedProjIds] = useState<Set<number>>(() => new Set(projects.map((p: any) => p.id)));

  // Per-project stats, sorted by actual completion %
  const projStats = projects.map((p: any) => {
    const tasks = (projectTasks[p.id] || []) as any[];
    const N = tasks.length;
    const done = tasks.filter((t: any) => !!t.actEnd).length;
    const tgtDue = tasks.filter((t: any) => t.planEnd && new Date(t.planEnd) <= TODAY).length;
    const actPct = N ? Math.round((done / N) * 100) : 0;
    const tgtPct = N ? Math.round((tgtDue / N) * 100) : 0;
    return { ...p, N, done, tgtDue, actPct, tgtPct };
  }).sort((a: any, b: any) => b.actPct - a.actPct);

  // Status totals
  const sCounts: Record<string, number> = { Done: 0, 'In Progress': 0, Overdue: 0, Planned: 0 };
  allTasks.forEach((t: any) => { const s = getStatus(t); if (s in sCounts) sCounts[s]++; });
  const total = allTasks.length;
  const donutColors: Record<string, string> = { Done: '#10B981', 'In Progress': '#3B82F6', Overdue: '#EF4444', Planned: '#94A3B8' };

  // Donut segments
  const C = 2 * Math.PI * 36;
  let cum = 0;
  const donutSegs = Object.entries(sCounts).map(([label, count]) => {
    const f = total > 0 ? count / total : 0;
    const seg = { label, count, f, offset: -(cum * C), color: donutColors[label] };
    cum += f;
    return seg;
  });

  const dlPNG = (canvas: HTMLCanvasElement, name: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  };

  // Export: Project Completion bars (only selected projects)
  const exportCompletionPNG = () => {
    const filtered = projStats.filter((p: any) => selectedProjIds.has(p.id));
    if (!filtered.length) return;
    const DPR = 2, PAD = 36, ROW_H = 56, HEADER_H = 52, W = 700;
    const H = PAD + HEADER_H + filtered.length * ROW_H + PAD;
    const canvas = document.createElement('canvas');
    canvas.width = W * DPR; canvas.height = H * DPR;
    const ctx = canvas.getContext('2d')!; ctx.scale(DPR, DPR);
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, W, H);
    // Card
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, 12); ctx.fill();
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, 12); ctx.stroke();
    // Title
    ctx.fillStyle = '#1E293B'; ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.fillText('Project Completion', PAD + 20, PAD + 26);
    ctx.fillStyle = '#94A3B8'; ctx.font = '11px system-ui,sans-serif';
    ctx.fillText("Solid bar = actual  ·  tick = today's target", PAD + 20, PAD + 42);
    // Rows
    const barX = PAD + 20, barW = W - PAD * 2 - 110;
    filtered.forEach((p: any, i: number) => {
      const rowY = PAD + HEADER_H + i * ROW_H;
      const barY = rowY + 22, barH = 9, pctX = barX + barW + 12;
      // Name
      ctx.fillStyle = '#1E293B'; ctx.font = '600 12px system-ui,sans-serif';
      let name = p.name;
      while (ctx.measureText(name).width > barW - 10 && name.length > 4) name = name.slice(0, -1);
      if (name !== p.name) name += '…';
      ctx.fillText(name, barX, rowY + 14);
      // % label
      ctx.fillStyle = p.color; ctx.font = 'bold 13px system-ui,sans-serif';
      ctx.fillText(`${p.actPct}%`, pctX + 16, rowY + 14);
      ctx.fillStyle = '#94A3B8'; ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(`Target ${p.tgtPct}%`, pctX, rowY + 27);
      // Track
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();
      // Actual bar
      if (p.actPct > 0) {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.roundRect(barX, barY, Math.round(barW * p.actPct / 100), barH, 4); ctx.fill();
      }
      // Target tick
      if (p.tgtPct > 0) {
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(barX + Math.round(barW * p.tgtPct / 100) - 1, barY - 3, 2, barH + 6);
      }
      // Sub
      ctx.fillStyle = '#94A3B8'; ctx.font = '10px system-ui,sans-serif';
      ctx.fillText(`${p.done}/${p.N} tasks completed`, barX, barY + barH + 13);
    });
    dlPNG(canvas, `project-completion-${new Date().toISOString().slice(0, 10)}.png`);
  };

  // Export: Task Status donut
  const exportStatusPNG = () => {
    const DPR = 2, W = 340, DONUT_R = 70, DONUT_SW = 18, PAD = 28, HEADER_H = 48;
    const legendH = Object.keys(sCounts).length * 30;
    const H = PAD + HEADER_H + DONUT_R * 2 + 28 + legendH + PAD;
    const canvas = document.createElement('canvas');
    canvas.width = W * DPR; canvas.height = H * DPR;
    const ctx = canvas.getContext('2d')!; ctx.scale(DPR, DPR);
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, 12); ctx.fill();
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - PAD * 2, H - PAD * 2, 12); ctx.stroke();
    ctx.fillStyle = '#1E293B'; ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.fillText('Task Status', PAD + 16, PAD + 24);
    // Donut
    const cx = W / 2, cy = PAD + HEADER_H + DONUT_R;
    ctx.strokeStyle = '#F1F5F9'; ctx.lineWidth = DONUT_SW;
    ctx.beginPath(); ctx.arc(cx, cy, DONUT_R, 0, Math.PI * 2); ctx.stroke();
    if (total > 0) {
      let angle = -Math.PI / 2;
      Object.entries(sCounts).forEach(([label, count]) => {
        const sweep = (count / total) * Math.PI * 2;
        ctx.strokeStyle = donutColors[label]; ctx.lineWidth = DONUT_SW;
        ctx.beginPath(); ctx.arc(cx, cy, DONUT_R, angle, angle + sweep); ctx.stroke();
        angle += sweep;
      });
    }
    ctx.fillStyle = '#1E293B'; ctx.font = 'bold 20px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(total), cx, cy + 7);
    ctx.fillStyle = '#94A3B8'; ctx.font = '10px system-ui,sans-serif';
    ctx.fillText('total tasks', cx, cy + 22);
    ctx.textAlign = 'left';
    const legY = cy + DONUT_R + 22;
    Object.entries(sCounts).forEach(([label, count], i) => {
      const ly = legY + i * 30;
      ctx.fillStyle = donutColors[label];
      ctx.beginPath(); ctx.arc(PAD + 24, ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#64748B'; ctx.font = '12px system-ui,sans-serif';
      ctx.fillText(label, PAD + 36, ly + 4);
      ctx.fillStyle = '#1E293B'; ctx.font = 'bold 12px system-ui,sans-serif';
      ctx.fillText(`${count} (${total > 0 ? Math.round(count / total * 100) : 0}%)`, W - PAD - 70, ly + 4);
    });
    dlPNG(canvas, `task-status-${new Date().toISOString().slice(0, 10)}.png`);
  };

  // Monthly plan vs completed across all tasks
  const monthMap: Record<string, { plan: number; act: number }> = {};
  allTasks.forEach((t: any) => {
    if (t.planEnd) { const k = t.planEnd.slice(0, 7); if (!monthMap[k]) monthMap[k] = { plan: 0, act: 0 }; monthMap[k].plan++; }
    if (t.actEnd)  { const k = t.actEnd.slice(0, 7);  if (!monthMap[k]) monthMap[k] = { plan: 0, act: 0 }; monthMap[k].act++; }
  });
  const months = Object.keys(monthMap).sort();
  const maxMonthVal = Math.max(...months.map((m) => Math.max(monthMap[m].plan, monthMap[m].act)), 1);
  const todayMonthKey = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Row 1: completion bars + status donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', gap: 20, alignItems: 'start' }}>

        {/* Project completion bars */}
        <div style={{ ...T.card, padding: '20px 24px' }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>Project Completion</div>
              <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>Solid bar = actual · tick = today's target</div>
            </div>
            <button onClick={exportCompletionPNG} style={{ ...T.btnGhost, padding: '4px 10px', fontSize: 11, flexShrink: 0, marginLeft: 10 }}>⬇ PNG</button>
          </div>
          {/* Project selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: T.faint, flexShrink: 0 }}>Export selection:</span>
            <button onClick={() => setSelectedProjIds(new Set(projStats.map((p: any) => p.id)))}
              style={{ fontSize: 10, color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>All</button>
            <button onClick={() => setSelectedProjIds(new Set())}
              style={{ fontSize: 10, color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>None</button>
            <span style={{ fontSize: 10, color: T.faint }}>({selectedProjIds.size} selected)</span>
          </div>
          {projStats.map((p: any) => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                {/* Checkbox + name */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                  <input type="checkbox" checked={selectedProjIds.has(p.id)}
                    onChange={() => {
                      const next = new Set(selectedProjIds);
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                      setSelectedProjIds(next);
                    }}
                    style={{ accentColor: p.color, width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: 10, color: T.faint }}>Target {p.tgtPct}%</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.color, minWidth: 36, textAlign: 'right' }}>{p.actPct}%</span>
                </div>
              </div>
              <div style={{ height: 9, background: '#F1F5F9', borderRadius: 5, position: 'relative', overflow: 'visible' }}>
                <div style={{ height: '100%', width: `${p.actPct}%`, background: p.color, borderRadius: 5, transition: 'width 0.5s' }} />
                {p.tgtPct > 0 && (
                  <div style={{ position: 'absolute', top: -3, left: `${p.tgtPct}%`, width: 2, height: 15, background: '#94A3B8', borderRadius: 1, transform: 'translateX(-50%)' }} />
                )}
              </div>
              <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{p.done}/{p.N} tasks completed</div>
            </div>
          ))}
        </div>

        {/* Status donut */}
        <div style={{ ...T.card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>Task Status</div>
            <button onClick={exportStatusPNG} style={{ ...T.btnGhost, padding: '4px 10px', fontSize: 11 }}>⬇ PNG</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width={100} height={100} viewBox="0 0 96 96">
              <circle cx={48} cy={48} r={36} fill="none" stroke="#F1F5F9" strokeWidth={13} />
              {total > 0 && donutSegs.map((seg, i) => (
                <circle key={i} cx={48} cy={48} r={36} fill="none"
                  stroke={seg.color} strokeWidth={13}
                  strokeDasharray={`${seg.f * C} ${(1 - seg.f) * C}`}
                  strokeDashoffset={seg.offset}
                  transform="rotate(-90, 48, 48)"
                />
              ))}
              <text x={48} y={45} textAnchor="middle" fontSize={16} fontWeight="bold" fill={T.text as string}>{total}</text>
              <text x={48} y={58} textAnchor="middle" fontSize={9} fill={T.muted as string}>total tasks</text>
            </svg>
            <div style={{ width: '100%', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {donutSegs.map((seg) => (
                <div key={seg.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: T.muted }}>{seg.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{seg.count}</span>
                    <span style={{ fontSize: 10, color: T.faint, minWidth: 28, textAlign: 'right' }}>{total > 0 ? Math.round(seg.f * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Monthly task activity */}
      <div style={{ ...T.card, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 2 }}>Monthly Task Activity</div>
            <div style={{ fontSize: 11, color: T.faint }}>Tasks due by plan end vs tasks actually completed per month</div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 6, background: '#BFDBFE', borderRadius: 2, display: 'inline-block' }} />Planned</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 6, background: '#10B981', borderRadius: 2, display: 'inline-block' }} />Completed</span>
          </div>
        </div>
        {months.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.faint, fontSize: 12, padding: '24px 0' }}>No task dates available</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {months.map((m) => {
              const { plan, act } = monthMap[m];
              const BAR_H = 80;
              const planH = Math.max(2, Math.round((plan / maxMonthVal) * BAR_H));
              const actH  = Math.max(act > 0 ? 2 : 0, Math.round((act  / maxMonthVal) * BAR_H));
              const [y, mo] = m.split('-');
              const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short' });
              const isCurrent = m === todayMonthKey;
              return (
                <div key={m} title={`${label} ${y} — Planned: ${plan}, Completed: ${act}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 38, flex: '0 0 38px', opacity: isCurrent ? 1 : 0.85 }}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: BAR_H }}>
                    <div style={{ width: 14, height: planH, background: '#BFDBFE', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ width: 14, height: actH,  background: '#10B981', borderRadius: '3px 3px 0 0' }} />
                  </div>
                  <div style={{ height: 2, width: '100%', background: isCurrent ? T.accent : 'transparent', marginTop: 3, borderRadius: 1 }} />
                  <div style={{ fontSize: 9, color: isCurrent ? T.accent : T.faint, marginTop: 3, fontWeight: isCurrent ? 700 : 400 }}>{label}</div>
                  <div style={{ fontSize: 8, color: T.faint }}>{y}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Direction Tab ─────────────────────────────────────────────────────
function DirectionTab({ projects, projectTasks, onSelect }: any) {
  // Group projects by strategic_direction
  const groups: Record<string, any[]> = {};
  for (const p of projects) {
    const dir = (p.strategic_direction || '').trim() || 'Unassigned';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(p);
  }

  const DIRECTION_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316'];
  const dirNames = Object.keys(groups).sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
        {dirNames.map((dir, idx) => {
          const projs = groups[dir];
          const allT = projs.flatMap((p: any) => projectTasks[p.id] || []);
          const done = allT.filter((t: any) => t.actEnd).length;
          const pct = allT.length ? Math.round((done / allT.length) * 100) : 0;
          const color = dir === 'Unassigned' ? T.faint : DIRECTION_COLORS[idx % DIRECTION_COLORS.length];
          return (
            <div key={dir} style={{ ...T.card, padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Strategic Direction</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 10, lineHeight: 1.3 }}>{dir}</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{projs.length}</div>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projects</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{allT.length}</div>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tasks</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Done</div>
                </div>
              </div>
              <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              {/* Status breakdown */}
              {(() => {
                const sc: Record<string, number> = { Done: 0, 'In Progress': 0, Overdue: 0, Delayed: 0, Planned: 0 };
                allT.forEach((t: any) => { const s = getStatus(t); if (s in sc) sc[s]++; });
                return (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {Object.entries(sc).filter(([, n]) => n > 0).map(([s, n]) => (
                      <span key={s} style={{ background: SC[s]?.bg, color: SC[s]?.tx, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>
                        {n} {s === 'In Progress' ? 'Active' : s}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Per-direction project lists */}
      {dirNames.map((dir, idx) => {
        const projs = groups[dir];
        const color = dir === 'Unassigned' ? T.faint : DIRECTION_COLORS[idx % DIRECTION_COLORS.length];
        return (
          <div key={dir} style={{ ...T.card }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>{dir}</span>
              <span style={{ background: `${color}18`, color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6 }}>{projs.length} project{projs.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: '10px 0' }}>
              {projs.map((p: any) => {
                const pt = projectTasks[p.id] || [];
                const done = pt.filter((t: any) => t.actEnd).length;
                const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
                const overdue = pt.filter((t: any) => getStatus(t) === 'Overdue').length;
                return (
                  <div key={p.id} onClick={() => onSelect(p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer', borderRadius: 8, margin: '0 8px', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.bg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 600, color: T.text, fontSize: 13 }}>{p.name}</span>
                    {overdue > 0 && <span style={{ background: SC.Overdue.bg, color: SC.Overdue.tx, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>{overdue} overdue</span>}
                    <span style={{ fontSize: 12, color: T.muted, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                    <div style={{ width: 80, height: 5, background: '#F1F5F9', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ color: T.accent, fontSize: 11, fontWeight: 700 }}>Open →</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ projects, projectTasks, onSelect, onNew, onEdit, onDelete }: any) {
  const [dashTab, setDashTab] = useState<'projects' | 'overview' | 'direction'>('projects');
  const allTasks = Object.values(projectTasks).flat() as any[];
  const _statusCounts: Record<string, number> = { Done: 0, 'In Progress': 0, Overdue: 0, Planned: 0 };
  allTasks.forEach((t) => { const s = getStatus(t); if (s in _statusCounts) _statusCounts[s]++; });
  const statSummary = Object.entries(_statusCounts).map(([s, n]) => ({ s, n }));

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.3px' }}>Projects</h1>
          <p style={{ margin: '5px 0 0', color: T.muted, fontSize: 13 }}>{projects.length} project{projects.length !== 1 ? 's' : ''} · {allTasks.length} total tasks</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportAllPDF(projects, projectTasks).catch(console.error)} style={T.btnGhost}>
            ⬇ Export PDF
          </button>
          <button onClick={onNew} style={T.btnPrimary}>+ New Project</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: T.bg, padding: 4, borderRadius: 11, border: `1px solid ${T.border}`, marginBottom: 20, width: 'fit-content' }}>
        {([['projects', 'Projects'], ['overview', 'Overview'], ['direction', 'By Direction']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setDashTab(tab)} style={{ padding: '5px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, background: dashTab === tab ? T.surface : 'transparent', color: dashTab === tab ? T.accent : T.muted, fontWeight: dashTab === tab ? 700 : 400, boxShadow: dashTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {dashTab === 'overview' ? (
        <OverviewTab projects={projects} projectTasks={projectTasks} />
      ) : dashTab === 'direction' ? (
        <DirectionTab projects={projects} projectTasks={projectTasks} onSelect={onSelect} />
      ) : (<>

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
            const pt = projectTasks[p.id] || [], pdone = pt.filter((t: any) => t.actEnd).length, pct = pt.length ? Math.round((pdone / pt.length) * 100) : 0;
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
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ background: `${p.color}15`, color: p.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6 }}>{p.irCode || 'No IR Code'}</span>
                        {p.strategic_direction && <span style={{ background: '#F0FDF4', color: '#16A34A', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6 }}>{p.strategic_direction}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onEdit(p)} style={{ ...T.btnGhost, padding: '4px 9px', fontSize: 11 }}>Edit</button>
                      <button onClick={() => onDelete(p)} style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontSize: 11 }}>Del</button>
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
      </>)}
    </div>
  );
}

// ── Project Page ──────────────────────────────────────────────────────
function ProjectPage({ project, tasks, view, setView, gRef, todayX, kpis, actMonth, setActMonth, tgtMonth, setTgtMonth, mtdMonthSel, setMtdMonthSel, projectMonthRange, onAdd, onEditTask, onDelTask, onReorderTasks, onEditProject, onGoToToday, onGenTasks, onInlineSave, onSyncUpload }: any) {
  const [showIR, setShowIR] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = tasks.map((t: any) => ({
      'Subject':       t.subject   || '',
      'Plan Start':    t.planStart || '',
      'Plan End':      t.planEnd   || '',
      'Actual Start':  t.actStart  || '',
      'Actual End':    t.actEnd    || '',
      'PIC':           t.pic       || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    XLSX.writeFile(wb, `${project.name.replace(/[^a-z0-9]/gi, '_')}_timeline.xlsx`);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false }) as any[];
      const fmtDate = (v: any) => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        const s = String(v).trim();
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      const parsed = rawRows
        .map((r: any) => ({
          subject:    String(r['Subject'] || r['subject'] || '').trim(),
          planStart:  fmtDate(r['Plan Start']   || r['plan_start']  || r['planStart']),
          planEnd:    fmtDate(r['Plan End']     || r['plan_end']    || r['planEnd']),
          actStart:   fmtDate(r['Actual Start'] || r['act_start']   || r['actStart']),
          actEnd:     fmtDate(r['Actual End']   || r['act_end']     || r['actEnd']),
          pic:        String(r['PIC'] || r['pic'] || '').trim() || null,
          done:       !!fmtDate(r['Actual End'] || r['act_end'] || r['actEnd']),
        }))
        .filter((r: any) => r.subject);
      if (!parsed.length) { alert('No valid tasks found in the file.'); return; }

      const current = tasks;
      const toUpdate = parsed.filter((p: any) => current.find((t: any) => t.subject.trim().toLowerCase() === p.subject.toLowerCase()));
      const toCreate = parsed.filter((p: any) => !current.find((t: any) => t.subject.trim().toLowerCase() === p.subject.toLowerCase()));
      const toDelete = current.filter((t: any) => !parsed.find((p: any) => p.subject.toLowerCase() === t.subject.trim().toLowerCase()));

      const ok = window.confirm(
        `Ready to sync "${project.name}":\n\n` +
        `  • Update:  ${toUpdate.length} tasks\n` +
        `  • Create:  ${toCreate.length} new tasks\n` +
        `  • Delete:  ${toDelete.length} tasks\n\n` +
        `Continue?`
      );
      if (!ok) return;

      setSyncMsg('');
      const result = await onSyncUpload(parsed);
      setSyncMsg(result);
      setTimeout(() => setSyncMsg(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Failed to read file. Make sure it uses the correct template.');
    }
  };

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
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {project.irCode && (<>
            <button onClick={() => setShowIR((x: boolean) => !x)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: `1px solid ${showIR ? T.accent + '55' : T.border}`, background: showIR ? '#EEF2FF' : 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: showIR ? T.accent : T.muted }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: showIR ? T.accent : T.faint, display: 'inline-block' }} />
              IR Context
            </button>
            {showIR && <span style={{ background: '#EEF2FF', border: `1px solid ${T.accent}33`, borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: T.accent }}>{project.irCode}</span>}
          </>)}
          {project.strategic_direction && (
            <span style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              {project.strategic_direction}
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, padding: '20px 24px 12px' }}>
        {kpis.map((k: any, i: number) => {
          const selValue = i === 0 ? tgtMonth : i === 1 ? actMonth : i === 3 ? mtdMonthSel : '';
          const selOpts  = projectMonthRange;
          const selDefault = i === 0 ? 'Up to today' : i === 1 ? 'All time' : '';
          const onSelChange = i === 0 ? setTgtMonth : i === 1 ? setActMonth : i === 3 ? setMtdMonthSel : null;
          const hasSelector = i === 0 || i === 1 || i === 3;
          return (
            <div key={i} style={{ ...T.card, padding: '14px 18px', borderLeft: `3px solid ${k.c}`, position: 'relative' }}>
              {hasSelector && (
                <select
                  value={selValue}
                  onChange={e => onSelChange && onSelChange(e.target.value)}
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: T.muted, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 4px', cursor: 'pointer', maxWidth: 90 }}
                >
                  {selDefault && <option value="">{selDefault}</option>}
                  {selOpts.map((m: string) => {
                    const [y, mo] = m.split('-');
                    const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.faint, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 5, paddingRight: hasSelector ? 70 : 0 }}>{k.l}</div>
              <div style={{ fontSize: i === 3 ? 19 : 26, fontWeight: 700, color: k.c, lineHeight: 1.1, marginBottom: 3 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: T.faint }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 24px 16px' }}>
        <button onClick={onAdd} style={T.btnPrimary}>+ Add Task</button>
        {view === 'gantt' && <button onClick={onGoToToday} style={T.btnGhost}>Go to Today</button>}
        <button onClick={() => {
          buildProjectPDF(project, tasks, kpis)
            .then(doc => {
              const url = URL.createObjectURL(doc.output('blob'));
              window.open(url, '_blank');
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            })
            .catch(console.error);
        }} style={T.btnGhost}>⬇ Export PDF</button>
        <button onClick={downloadTemplate} style={T.btnGhost}>⬇ Template</button>
        <input ref={uploadRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUploadFile} />
        <button onClick={() => uploadRef.current?.click()} style={T.btnGhost}>⬆ Upload</button>
        {syncMsg && <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{syncMsg}</span>}
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
        {view === 'gantt'  && <GanttView  tasks={tasks} todayX={todayX} gRef={gRef} onEdit={onEditTask} onDel={onDelTask} onReorder={onReorderTasks} onInlineSave={onInlineSave} />}
        {view === 'list'   && <ListView   tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onReorder={onReorderTasks} />}
        {view === 'board'  && <BoardView  tasks={tasks} onEdit={onEditTask} onDel={onDelTask} />}
        {view === 'kanban' && <KanbanView tasks={tasks} onEdit={onEditTask} onDel={onDelTask} />}
      </div>

    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}

// ── Gantt ─────────────────────────────────────────────────────────────
function GanttView({ tasks, todayX, gRef, onEdit, onDel, onReorder, onInlineSave }: any) {
  const RH = 52, HH = 52;
  const [pendingDel, setPendingDel] = useState<any | null>(null);
  const [dragId, setDragId]         = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [editCell, setEditCell]     = useState<{ taskId: number; field: string; value: string } | null>(null);
  const [tooltip, setTooltip]       = useState<{ text: string; x: number; y: number } | null>(null);
  const [subjectColW, setSubjectColW] = useState(180);
  const resizingRef = useRef<{ startX: number; startW: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const mouseXRef = useRef(0);

  const startEdit = (e: React.MouseEvent, taskId: number, field: string, value: string) => {
    e.stopPropagation();
    setEditCell({ taskId, field, value: value || '' });
  };

  const commitEdit = (task: any) => {
    if (!editCell) return;
    const merged: any = { ...task, [editCell.field]: editCell.value || null };
    if (editCell.field === 'actEnd') merged.done = !!editCell.value;
    setEditCell(null);
    onInlineSave(merged);
  };

  const cancelEdit = () => setEditCell(null);
  const isEditing = (taskId: number, field: string) => editCell?.taskId === taskId && editCell?.field === field;
  const inputStyle = { border: 'none', borderBottom: '2px solid #6366F1', outline: 'none', background: 'transparent', color: T.text } as React.CSSProperties;

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
    { k: 'drag',      l: '',             w: 24           },
    { k: 'actions',   l: '',             w: 52           },
    { k: 'subject',   l: 'Task Subject', w: subjectColW  },
    { k: 'planStart', l: 'Plan\nStart',  w: 88           },
    { k: 'planEnd',   l: 'Plan\nEnd',    w: 88           },
    { k: 'actStart',  l: 'Act.\nStart',  w: 88           },
    { k: 'actEnd',    l: 'Act.\nEnd',    w: 88           },
    { k: 'pic',       l: 'PIC',          w: 68           },
  ];

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { startX: e.clientX, startW: subjectColW };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      mouseXRef.current = ev.clientX;
      if (rafRef.current !== null) return; // already a frame pending — skip
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!resizingRef.current) return;
        const newW = Math.max(120, resizingRef.current.startW + mouseXRef.current - resizingRef.current.startX);
        setSubjectColW(newW);
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const allDates = tasks.flatMap((t: any) => [t.planStart, t.planEnd, t.actStart, t.actEnd].filter(Boolean));
  const validDates = allDates.filter((d: string) => { const t = new Date(d).getTime(); return !isNaN(t) && new Date(d).getFullYear() < 2100; });
  const minDate = validDates.length ? new Date(Math.min(...validDates.map((d: string) => new Date(d).getTime()))) : new Date(2026, 0, 1);
  const maxDate = validDates.length ? new Date(Math.max(...validDates.map((d: string) => new Date(d).getTime()))) : new Date(2027, 11, 31);
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
              <div key={c.k} style={{ width: c.w, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: c.k === 'actions' ? 'center' : 'flex-start', flexShrink: 0, fontSize: 10, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3, whiteSpace: 'pre-line', position: 'relative' }}>
                {c.l}
                {c.k === 'subject' && (
                  <div onMouseDown={startResize}
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 2, height: 18, background: T.border, borderRadius: 1 }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {tasks.map((t: any, i: number) => {
            const sc = SC[getStatus(t)];
            const isDragging  = dragId === t.id;
            const isDragOver  = dragOverId === t.id && dragId !== t.id;
            return (
              <div key={t.id}
                draggable={editCell?.taskId !== t.id}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== t.id) setDragOverId(t.id); }}
                onDrop={() => handleDrop(t.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                style={{ display: 'flex', height: RH, borderBottom: `1px solid ${T.border}`, borderRight: `2px solid ${T.border}`, background: isDragOver ? '#EEF2FF' : editCell?.taskId === t.id ? '#F5F7FF' : i % 2 === 0 ? '#fff' : '#FAFBFF', opacity: isDragging ? 0.4 : 1, transition: 'background 0.1s' }}>
                {/* Drag handle */}
                <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'grab', color: T.faint, fontSize: 13, userSelect: 'none' }}>⠿</div>
                {/* Edit / Delete */}
                <div style={{ width: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0 }}>
                  <button onClick={() => onEdit(t)} style={{ background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>✏</button>
                  <button onClick={() => setPendingDel(t)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
                {/* Subject */}
                <div style={{ width: subjectColW, display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px', overflow: 'hidden', flexShrink: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  {isEditing(t.id, 'subject')
                    ? <input autoFocus type="text" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 12 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'subject', t.subject)}
                        onMouseEnter={e => {
                          const el = e.currentTarget;
                          if (el.scrollWidth > el.clientWidth) {
                            const r = el.getBoundingClientRect();
                            setTooltip({ text: t.subject, x: r.left, y: r.bottom + 6 });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{ fontSize: 12, color: t.actEnd ? T.faint : T.text, textDecoration: t.actEnd ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, cursor: 'text' }}>
                        {t.subject}
                      </span>}
                </div>
                {/* Plan Start */}
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                  {isEditing(t.id, 'planStart')
                    ? <input autoFocus type="date" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'planStart', t.planStart)} title="Double-click to edit" style={{ ...dateCell, display: 'block', width: '100%', cursor: 'text' }}>{fmt(t.planStart)}</span>}
                </div>
                {/* Plan End */}
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid ${T.border}` }}>
                  {isEditing(t.id, 'planEnd')
                    ? <input autoFocus type="date" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'planEnd', t.planEnd)} title="Double-click to edit" style={{ ...dateCell, display: 'block', width: '100%', cursor: 'text' }}>{fmt(t.planEnd)}</span>}
                </div>
                {/* Act Start */}
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid #F0F4FF`, background: i % 2 === 0 ? '#FAFEFF' : '#F5FAFF' }}>
                  {isEditing(t.id, 'actStart')
                    ? <input autoFocus type="date" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'actStart', t.actStart)} title="Double-click to edit" style={{ ...dateCell, color: t.actStart ? '#059669' : T.faint, display: 'block', width: '100%', cursor: 'text' }}>{fmt(t.actStart)}</span>}
                </div>
                {/* Act End */}
                <div style={{ width: 88, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid #F0F4FF`, background: i % 2 === 0 ? '#FAFEFF' : '#F5FAFF' }}>
                  {isEditing(t.id, 'actEnd')
                    ? <input autoFocus type="date" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'actEnd', t.actEnd)} title="Double-click to edit" style={{ ...dateCell, color: t.actEnd ? '#059669' : T.faint, display: 'block', width: '100%', cursor: 'text' }}>{fmt(t.actEnd)}</span>}
                </div>
                {/* PIC */}
                <div style={{ width: 68, display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0, borderLeft: `1px solid ${T.border}` }}>
                  {isEditing(t.id, 'pic')
                    ? <input autoFocus type="text" value={editCell!.value}
                        onChange={e => setEditCell({ ...editCell!, value: e.target.value })}
                        onBlur={() => commitEdit(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(t); if (e.key === 'Escape') cancelEdit(); e.stopPropagation(); }}
                        style={{ ...inputStyle, width: '100%', fontSize: 11 }} />
                    : <span onDoubleClick={e => startEdit(e, t.id, 'pic', t.pic)} title="Double-click to edit" style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%', cursor: 'text' }}>{t.pic || '–'}</span>}
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
              const _st = getStatus(t); const bad = _st === 'Delayed' || _st === 'Overdue';
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
        <span style={{ fontSize: 11, color: T.faint, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{tasks.length} tasks · {TL_S.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {TL_E.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          <span style={{ color: '#A5B4FC' }}>✎ Double-click any cell to edit inline</span>
        </span>
      </div>
      {pendingDel && (
        <ConfirmModal
          title="Delete Task"
          message={`Are you sure you want to delete "${pendingDel.subject}"? This action cannot be undone.`}
          onConfirm={() => { onDel(pendingDel.id); setPendingDel(null); }}
          onCancel={() => setPendingDel(null)}
        />
      )}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999, background: '#1E293B', color: '#F1F5F9', padding: '6px 11px', borderRadius: 7, fontSize: 12, maxWidth: 360, wordBreak: 'break-word', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none', lineHeight: 1.5 }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────
function ListView({ tasks, onEdit, onDel, onReorder }: any) {
  const [pendingDel, setPendingDel] = useState<any | null>(null);
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
            return (
              <tr key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverId !== t.id) setDragOverId(t.id); }}
                onDrop={() => handleDrop(t.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                style={{ borderBottom: `1px solid ${T.border}`, background: isDragOver ? '#EEF2FF' : i % 2 === 0 ? '#fff' : '#FAFBFF', opacity: isDragging ? 0.4 : 1, transition: 'background 0.1s' }}>
                <td style={{ padding: '0 8px', width: 20, cursor: 'grab', color: T.faint, fontSize: 14, textAlign: 'center', userSelect: 'none' }}>⠿</td>
                <td style={{ padding: '11px 14px', color: T.faint, width: 30 }}>{i + 1}</td>
                <td style={{ padding: '11px 14px', maxWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ color: t.actEnd ? T.faint : T.text, textDecoration: t.actEnd ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                  </div>
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ background: sc.bg, color: sc.tx, padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st}</span>
                </td>
                <td style={{ padding: '11px 14px', color: T.muted, whiteSpace: 'nowrap' }}>{t.pic || '–'}</td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => onEdit(t)} style={{ background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                    <button onClick={() => setPendingDel(t)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontSize: 11 }}>Del</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pendingDel && (
        <ConfirmModal
          title="Delete Task"
          message={`Are you sure you want to delete "${pendingDel.subject}"? This action cannot be undone.`}
          onConfirm={() => { onDel(pendingDel.id); setPendingDel(null); }}
          onCancel={() => setPendingDel(null)}
        />
      )}
    </div>
  );
}

// ── Board View ────────────────────────────────────────────────────────
function BoardView({ tasks, onEdit, onDel }: any) {
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
                    <button onClick={() => onEdit(t)} style={{ ...T.btnGhost, flex: 1, padding: '5px 9px', fontSize: 11 }}>✏ Edit</button>
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
function KanbanView({ tasks, onEdit, onDel }: any) {
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
                      <button onClick={() => onEdit(t)} style={{ flex: 1, background: '#EEF2FF', color: T.accent, border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 10 }}>✏ Edit</button>
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
    ? { ...project, planStart: project.plan_start || '', planEnd: project.plan_end || '', strategicDirection: project.strategic_direction || '' }
    : { name: '', irCode: '', description: '', color: '#6366F1', planStart: '', planEnd: '', strategicDirection: '' });
  const upd = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...T.card, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        <h3 style={{ margin: '0 0 22px', fontSize: 16, fontWeight: 700, color: T.text }}>{project ? 'Edit Project' : 'New Project'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div><label style={T.label}>Project Name *</label><input value={f.name} onChange={(e) => upd('name', e.target.value)} placeholder="e.g. ERP System Implementation" style={T.input} /></div>
          <div><label style={T.label}>Strategic Direction</label><input value={f.strategicDirection || ''} onChange={(e) => upd('strategicDirection', e.target.value)} placeholder="e.g. Digital Transformation, AI Innovation…" style={T.input} /></div>
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
