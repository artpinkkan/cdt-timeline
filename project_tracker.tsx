import { useState, useRef, useEffect } from "react";

const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth()+1).padStart(2,'0')}-${String(TODAY.getDate()).padStart(2,'0')}`;
const TL_S=new Date('2024-06-01'),TL_E=new Date('2026-05-31'),TL_DAYS=(TL_E-TL_S)/864e5,TL_W=1920;
const MONTHS=Array.from({length:24},(_,i)=>{const d=new Date(2024,5+i,1);return{label:d.toLocaleString('en-US',{month:'short'})+" '"+String(d.getFullYear()).slice(2),x:Math.round(i*TL_W/24),w:Math.round(TL_W/24)};});
const d2x=ds=>ds?Math.round(((new Date(ds)-TL_S)/864e5/TL_DAYS)*TL_W):null;
const fmt=ds=>ds?new Date(ds).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'–';
const getStatus=t=>{if(t.done)return(t.actEnd&&t.planEnd&&new Date(t.actEnd)>new Date(t.planEnd))?'Delayed':'Done';if(t.planEnd&&TODAY>new Date(t.planEnd))return'Overdue';if(t.actStart)return'In Progress';return'Planned';};
const SC={Done:{bg:'#D1FAE5',tx:'#065F46',dot:'#10B981'},Delayed:{bg:'#FEE2E2',tx:'#991B1B',dot:'#EF4444'},'In Progress':{bg:'#DBEAFE',tx:'#1E40AF',dot:'#3B82F6'},Overdue:{bg:'#FEF3C7',tx:'#92400E',dot:'#F59E0B'},Planned:{bg:'#F3F4F6',tx:'#374151',dot:'#9CA3AF'}};
const PROJ_COLORS=['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899','#14B8A6'];

const SEED={
  projects:[{id:1,name:'Regulatory Information Management',irCode:'IR-CRA-2025-001',description:'Kalbe RIM system implementation',color:'#3B82F6',createdAt:'2024-01-15'}],
  projectTasks:{1:[
    {id:1,subject:'Initiative Request & Approval',planStart:'2024-06-03',planEnd:'2024-07-12',actStart:'2024-06-03',actEnd:'2024-07-15',pic:'Team A',done:true},
    {id:2,subject:'URS Preparation & Sign-off',planStart:'2024-07-15',planEnd:'2024-09-13',actStart:'2024-07-22',actEnd:'2024-09-20',pic:'Team B',done:true},
    {id:3,subject:'System Architecture & Design',planStart:'2024-09-02',planEnd:'2024-10-11',actStart:'2024-09-09',actEnd:'2024-10-18',pic:'Team C',done:true},
    {id:4,subject:'Backend Development',planStart:'2024-10-14',planEnd:'2025-01-17',actStart:'2024-10-21',actEnd:'2025-01-24',pic:'Dev Team',done:true},
    {id:5,subject:'Frontend Development',planStart:'2024-11-01',planEnd:'2025-02-28',actStart:'2024-11-15',actEnd:null,pic:'UI Team',done:false},
    {id:6,subject:'Integration Testing',planStart:'2025-01-20',planEnd:'2025-03-15',actStart:'2025-02-01',actEnd:null,pic:'QA Team',done:false},
    {id:7,subject:'User Acceptance Testing',planStart:'2025-03-01',planEnd:'2025-04-30',actStart:null,actEnd:null,pic:'Business',done:false},
    {id:8,subject:'Training & Documentation',planStart:'2025-03-15',planEnd:'2025-05-15',actStart:null,actEnd:null,pic:'Training',done:false},
    {id:9,subject:'Go Live Preparation',planStart:'2025-04-15',planEnd:'2025-05-31',actStart:null,actEnd:null,pic:'PM',done:false},
    {id:10,subject:'System Integration',planStart:'2025-05-01',planEnd:'2025-07-31',actStart:null,actEnd:null,pic:'Dev Ops',done:false},
    {id:11,subject:'Performance Optimization',planStart:'2025-06-01',planEnd:'2025-08-31',actStart:null,actEnd:null,pic:'Dev Team',done:false},
    {id:12,subject:'Security Audit',planStart:'2025-07-01',planEnd:'2025-09-30',actStart:null,actEnd:null,pic:'Security',done:false},
    {id:13,subject:'Production Deployment',planStart:'2025-09-01',planEnd:'2025-10-31',actStart:null,actEnd:null,pic:'DevOps',done:false},
    {id:14,subject:'Post-Launch Review',planStart:'2025-10-01',planEnd:'2025-12-31',actStart:null,actEnd:null,pic:'PM',done:false},
  ]},
  npid:2,ntid:15
};

// ── PDF Export ────────────────────────────────────────────────────────
const loadScript=src=>new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`)){res();return;}const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});

async function exportProjectPDF(project, tasks) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const N=tasks.length,done=tasks.filter(t=>t.done).length,pct=N?Math.round(done/N*100):0;

  // Header band
  doc.setFillColor(15,23,42);doc.rect(0,0,297,32,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(15);doc.setFont('helvetica','bold');
  doc.text(project.name,14,13);
  doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  const sub=[project.irCode?`IR: ${project.irCode}`:'',`Generated: ${new Date().toLocaleDateString('en-GB')}`,`${done}/${N} tasks · ${pct}% complete`].filter(Boolean).join('   |   ');
  doc.text(sub,14,23);

  // KPI row
  const kpiData=[['Target YTD','100%'],['Actual YTD',`${pct}%`],['Achievement',N?`${Math.round(pct)}%`:'–'],['Tasks Done',`${done}/${N}`]];
  let kx=14;
  kpiData.forEach(([l,v])=>{
    doc.setFillColor(241,245,249);doc.roundedRect(kx,36,60,18,2,2,'F');
    doc.setTextColor(148,163,184);doc.setFontSize(7);doc.text(l.toUpperCase(),kx+4,42);
    doc.setTextColor(15,23,42);doc.setFontSize(13);doc.setFont('helvetica','bold');doc.text(v,kx+4,52);
    doc.setFont('helvetica','normal');kx+=64;
  });

  // Task table
  const stClr={Done:[16,185,129],Delayed:[239,68,68],'In Progress':[59,130,246],Overdue:[245,158,11],Planned:[107,114,128]};
  doc.autoTable({
    startY:60,
    head:[['#','Task Subject','✓','Status','Plan Start','Plan End','Act. Start','Act. End','PIC']],
    body:tasks.map((t,i)=>[i+1,t.subject,t.done?'✓':'',getStatus(t),fmt(t.planStart),fmt(t.planEnd),fmt(t.actStart),fmt(t.actEnd),t.pic||'–']),
    headStyles:{fillColor:[30,41,59],textColor:255,fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:7.5,textColor:[30,41,59]},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{0:{cellWidth:8},2:{cellWidth:8,halign:'center'},3:{cellWidth:24},4:{cellWidth:22},5:{cellWidth:22},6:{cellWidth:22},7:{cellWidth:22},8:{cellWidth:18}},
    didParseCell(data){
      if(data.section==='body'&&data.column.index===3){const c=stClr[data.cell.raw]||[0,0,0];data.cell.styles.textColor=c;data.cell.styles.fontStyle='bold';}
      if(data.section==='body'&&data.column.index===2){data.cell.styles.textColor=data.cell.raw==='✓'?[16,185,129]:[203,213,225];data.cell.styles.fontStyle='bold';data.cell.styles.fontSize=10;}
    },
    margin:{left:14,right:14},
  });

  // Footer
  const pages=doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(148,163,184);doc.text(`${project.name} — Page ${i} of ${pages}`,14,doc.internal.pageSize.height-6);doc.text('Generated by RIM Tracker',297-14,doc.internal.pageSize.height-6,{align:'right'});}

  doc.save(`${project.name.replace(/[^a-z0-9]/gi,'_')}_report.pdf`);
}

// ── App ──────────────────────────────────────────────────────────────
export default function App(){
  const [s,setS]=useState(SEED);
  const [activeId,setActiveId]=useState(null);
  const [view,setView]=useState('gantt');
  const [taskModal,setTaskModal]=useState(null);
  const [projModal,setProjModal]=useState(null);
  const gRef=useRef();

  useEffect(()=>{(async()=>{try{const r=await window.storage.get('aps3');if(r)setS(JSON.parse(r.value));}catch{}})();},[]);
  const persist=ns=>{setS(ns);window.storage.set('aps3',JSON.stringify(ns)).catch(()=>{});};

  const proj=s.projects.find(p=>p.id===activeId)||null;
  const tasks=activeId?(s.projectTasks[activeId]||[]):[];

  const saveProject=p=>{let np,nn;if(p.id){np=s.projects.map(x=>x.id===p.id?p:x);}else{np=[...s.projects,{...p,id:s.npid,createdAt:todayStr}];nn=s.npid+1;}persist({...s,projects:np,npid:nn||s.npid});setProjModal(null);};
  const delProject=id=>{const npt={...s.projectTasks};delete npt[id];persist({...s,projects:s.projects.filter(p=>p.id!==id),projectTasks:npt});if(activeId===id)setActiveId(null);};
  const saveTask=t=>{let nt,nn;if(t.id){nt=tasks.map(x=>x.id===t.id?t:x);}else{nt=[...tasks,{...t,id:s.ntid}];nn=s.ntid+1;}persist({...s,projectTasks:{...s.projectTasks,[activeId]:nt},ntid:nn||s.ntid});setTaskModal(null);};
  const delTask=id=>persist({...s,projectTasks:{...s.projectTasks,[activeId]:tasks.filter(x=>x.id!==id)}});
  const togTask=id=>persist({...s,projectTasks:{...s.projectTasks,[activeId]:tasks.map(x=>x.id===id?{...x,done:!x.done}:x)}});

  const N=tasks.length,done=tasks.filter(t=>t.done).length,pDue=tasks.filter(t=>t.planEnd&&new Date(t.planEnd)<=TODAY).length;
  const tgt=N?(pDue/N*100).toFixed(1):'0.0',act=N?(done/N*100).toFixed(1):'0.0',ach=+tgt>0?(+act/+tgt*100).toFixed(1):'0.0';
  const maxP=tasks.reduce((m,t)=>{const d=t.planEnd?new Date(t.planEnd):null;return d&&d>m?d:m;},new Date(0));
  const pc=maxP>new Date(0)?maxP.toLocaleString('en-US',{month:'short',year:'numeric'}):'–';
  const txDay=d2x(todayStr);

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',fontSize:13}}>
      <Sidebar projects={s.projects} projectTasks={s.projectTasks} activeId={activeId}
        onDashboard={()=>setActiveId(null)} onSelect={id=>{setActiveId(id);setView('gantt');}} onNew={()=>setProjModal('add')}/>
      <div style={{flex:1,background:'#F1F5F9',overflow:'auto',minWidth:0}}>
        {!proj
          ?<Dashboard projects={s.projects} projectTasks={s.projectTasks} onSelect={id=>{setActiveId(id);setView('gantt');}} onNew={()=>setProjModal('add')} onEdit={p=>setProjModal(p)} onDelete={delProject}/>
          :<ProjectPage key={proj.id} project={proj} tasks={tasks} view={view} setView={setView} gRef={gRef} txDay={txDay}
              kpis={[
                {l:'% Target YTD',v:`${tgt}%`,sub:`as of ${TODAY.toLocaleString('en-US',{month:'short',year:'numeric'})}`,c:'#3B82F6'},
                {l:'% Actual YTD',v:`${act}%`,sub:`${done}/${N} tasks`,c:'#10B981'},
                {l:'% Achievement YTD',v:`${ach}%`,sub:'Actual ÷ Target',c:+ach<80?'#EF4444':'#10B981'},
                {l:'Plan Completion',v:pc,sub:'Projected end',c:'#F59E0B'},
                {l:'% BE Achievement',v:`${act}%`,sub:'BE target: 100%',c:'#8B5CF6'},
              ]}
              onAdd={()=>setTaskModal('add')} onEditTask={setTaskModal} onDelTask={delTask} onTogTask={togTask}
              onEditProject={()=>setProjModal(proj)}
              onGoToToday={()=>gRef.current&&(gRef.current.scrollLeft=Math.max(0,txDay-280))}/>
        }
      </div>
      {taskModal&&<TaskModal task={taskModal==='add'?null:taskModal} onSave={saveTask} onClose={()=>setTaskModal(null)}/>}
      {projModal&&<ProjectModal project={projModal==='add'?null:projModal} onSave={saveProject} onClose={()=>setProjModal(null)}/>}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────
function Sidebar({projects,projectTasks,activeId,onDashboard,onSelect,onNew}){
  const totT=projects.reduce((s,p)=>s+(projectTasks[p.id]||[]).length,0);
  const totD=projects.reduce((s,p)=>s+(projectTasks[p.id]||[]).filter(t=>t.done).length,0);
  const pct=totT?Math.round(totD/totT*100):0;
  return (
    <div style={{width:230,flexShrink:0,background:'#0F172A',display:'flex',flexDirection:'column',minHeight:'100vh'}}>
      <div style={{padding:'18px 16px',borderBottom:'1px solid #1E293B'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:'#3B82F6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'#fff',flexShrink:0}}>R</div>
          <div><div style={{color:'#F1F5F9',fontWeight:700,fontSize:14,lineHeight:1.2}}>RIM Tracker</div><div style={{color:'#475569',fontSize:11}}>Project Manager</div></div>
        </div>
      </div>
      <div style={{flex:1,padding:'12px 8px',overflowY:'auto'}}>
        <button onClick={onDashboard} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',marginBottom:4,background:activeId===null?'rgba(59,130,246,0.18)':'transparent',color:activeId===null?'#93C5FD':'#64748B',fontSize:13,textAlign:'left',fontWeight:activeId===null?700:400}}>
          <span style={{fontSize:14,opacity:0.8}}>⊞</span>Dashboard
        </button>
        <div style={{padding:'14px 10px 6px',color:'#334155',fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Projects</span><span style={{background:'#1E293B',color:'#64748B',borderRadius:10,padding:'1px 7px',fontSize:10}}>{projects.length}</span>
        </div>
        {projects.map(p=>{
          const pt=projectTasks[p.id]||[],pd=pt.filter(t=>t.done).length,pp=pt.length?Math.round(pd/pt.length*100):0,active=activeId===p.id;
          return(
            <button key={p.id} onClick={()=>onSelect(p.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',marginBottom:2,background:active?'rgba(59,130,246,0.18)':'transparent',textAlign:'left'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:p.color,flexShrink:0}}/>
              <div style={{flex:1,overflow:'hidden'}}>
                <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:active?'#E2E8F0':'#94A3B8',fontSize:12,fontWeight:active?700:400}}>{p.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                  <div style={{flex:1,height:3,background:'#1E293B',borderRadius:2}}><div style={{height:'100%',width:`${pp}%`,background:p.color,borderRadius:2}}/></div>
                  <span style={{fontSize:10,color:'#475569',flexShrink:0}}>{pp}%</span>
                </div>
              </div>
            </button>
          );
        })}
        {projects.length===0&&<div style={{color:'#334155',fontSize:11,padding:'10px',textAlign:'center'}}>No projects yet</div>}
      </div>
      <div style={{padding:'12px 8px',borderTop:'1px solid #1E293B'}}>
        <button onClick={onNew} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #1E293B',background:'transparent',color:'#64748B',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:10}}>
          <span style={{fontSize:18,lineHeight:1}}>+</span>New Project
        </button>
        <div style={{background:'#1E293B',borderRadius:10,padding:'10px 12px'}}>
          <div style={{color:'#475569',fontSize:10,marginBottom:3}}>Overall Progress</div>
          <div style={{fontSize:16,fontWeight:700,color:'#E2E8F0',marginBottom:6}}>{pct}% complete</div>
          <div style={{height:5,background:'#334155',borderRadius:3}}><div style={{height:'100%',width:`${pct}%`,background:'#3B82F6',borderRadius:3}}/></div>
          <div style={{color:'#475569',fontSize:10,marginTop:5}}>{totD} / {totT} tasks done</div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────
function Dashboard({projects,projectTasks,onSelect,onNew,onEdit,onDelete}){
  const allTasks=Object.values(projectTasks).flat();
  const statSummary=['Done','In Progress','Overdue','Planned'].map(s=>({s,n:allTasks.filter(t=>getStatus(t)===s).length}));
  return(
    <div style={{padding:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div><h1 style={{margin:0,fontSize:22,fontWeight:700,color:'#0F172A'}}>Projects</h1><p style={{margin:'4px 0 0',color:'#64748B',fontSize:13}}>{projects.length} project{projects.length!==1?'s':''} · {allTasks.length} total tasks</p></div>
        <button onClick={onNew} style={{background:'#3B82F6',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontWeight:700,fontSize:13}}>+ New Project</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {statSummary.map(({s,n})=>(
          <div key={s} style={{background:'#fff',borderRadius:10,padding:'12px 16px',borderLeft:`4px solid ${SC[s].dot}`,boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94A3B8',letterSpacing:'0.8px',textTransform:'uppercase'}}>{s}</div>
            <div style={{fontSize:26,fontWeight:700,color:SC[s].dot,lineHeight:1.2,margin:'3px 0'}}>{n}</div>
            <div style={{fontSize:11,color:'#94A3B8'}}>tasks across all projects</div>
          </div>
        ))}
      </div>
      {projects.length===0
        ?<div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:14,border:'2px dashed #E2E8F0'}}>
          <div style={{fontSize:44,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:700,color:'#374151',marginBottom:6}}>No projects yet</div>
          <div style={{fontSize:13,color:'#94A3B8',marginBottom:20}}>Create your first project to start tracking timelines</div>
          <button onClick={onNew} style={{background:'#3B82F6',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',cursor:'pointer',fontWeight:700,fontSize:13}}>+ Create First Project</button>
        </div>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:16}}>
          {projects.map(p=>{
            const pt=projectTasks[p.id]||[],pdone=pt.filter(t=>t.done).length,pct=pt.length?Math.round(pdone/pt.length*100):0;
            const counts={Done:0,'In Progress':0,Overdue:0,Delayed:0,Planned:0};pt.forEach(t=>{const s=getStatus(t);if(counts[s]!==undefined)counts[s]++;});
            const maxP2=pt.reduce((m,t)=>{const d=t.planEnd?new Date(t.planEnd):null;return d&&d>m?d:m;},new Date(0));
            const endDate=maxP2>new Date(0)?maxP2.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'–';
            return(
              <div key={p.id} style={{background:'#fff',borderRadius:14,border:'1px solid #E2E8F0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.05)',cursor:'pointer'}} onClick={()=>onSelect(p.id)}>
                <div style={{height:5,background:p.color}}/>
                <div style={{padding:'18px 20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div style={{flex:1,marginRight:8}}>
                      <div style={{fontWeight:700,color:'#0F172A',fontSize:15,lineHeight:1.3,marginBottom:3}}>{p.name}</div>
                      <span style={{background:`${p.color}18`,color:p.color,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:5}}>{p.irCode||'No IR Code'}</span>
                    </div>
                    <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>onEdit(p)} style={{background:'#F8FAFC',color:'#64748B',border:'1px solid #E2E8F0',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11}}>Edit</button>
                      <button onClick={()=>{if(confirm(`Delete "${p.name}"?`))onDelete(p.id);}} style={{background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11}}>Del</button>
                    </div>
                  </div>
                  {p.description&&<div style={{fontSize:12,color:'#64748B',marginBottom:12,lineHeight:1.4}}>{p.description}</div>}
                  <div style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748B',marginBottom:5}}><span>Progress</span><span style={{fontWeight:700,color:p.color}}>{pct}%</span></div>
                    <div style={{height:7,background:'#F1F5F9',borderRadius:4}}><div style={{height:'100%',width:`${pct}%`,background:p.color,borderRadius:4}}/></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:14}}>
                    {Object.entries(counts).map(([st,n])=>(
                      <div key={st} style={{textAlign:'center',background:'#F8FAFC',borderRadius:7,padding:'6px 2px'}}>
                        <div style={{fontSize:15,fontWeight:700,color:SC[st].dot}}>{n}</div>
                        <div style={{fontSize:9,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.3px',marginTop:1}}>{st==='In Progress'?'Active':st}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #F1F5F9',paddingTop:12,fontSize:11}}>
                    <span style={{color:'#94A3B8'}}>{pt.length} tasks · ends {endDate}</span>
                    <span style={{color:p.color,fontWeight:700}}>Open →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

// ── Project Page ─────────────────────────────────────────────────────
function ProjectPage({project,tasks,view,setView,gRef,txDay,kpis,onAdd,onEditTask,onDelTask,onTogTask,onEditProject,onGoToToday}){
  const [showIR,setShowIR]=useState(false);
  const [exporting,setExporting]=useState(false);

  const handleExport=async()=>{
    setExporting(true);
    try{await exportProjectPDF(project,tasks);}catch(e){console.error(e);}
    setExporting(false);
  };

  return(
    <div>
      <div style={{background:'#fff',borderBottom:'1px solid #E2E8F0',padding:'14px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:project.color,flexShrink:0}}/>
              <span style={{fontSize:20,fontWeight:700,color:'#0F172A'}}>{project.name}</span>
              <button onClick={onEditProject} style={{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontSize:11,color:'#64748B'}}>Edit</button>
            </div>
            <div style={{color:'#64748B',fontSize:12}}>Timeline · {tasks.length} tasks</div>
          </div>
          <div style={{display:'flex',gap:5}}>
            {['gantt','list','board','kanban'].map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'6px 13px',borderRadius:7,border:'1px solid',cursor:'pointer',fontSize:12,borderColor:view===v?'#3B82F6':'#E2E8F0',background:view===v?'#EFF6FF':'#fff',color:view===v?'#3B82F6':'#64748B',fontWeight:view===v?700:400}}>
                {v[0].toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {project.irCode&&(
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <button onClick={()=>setShowIR(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 13px',borderRadius:20,border:'1px solid',cursor:'pointer',fontSize:11,fontWeight:700,borderColor:showIR?'#3B82F6':'#E2E8F0',background:showIR?'#EFF6FF':'#F8FAFC',color:showIR?'#3B82F6':'#94A3B8'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:showIR?'#3B82F6':'#CBD5E1',display:'inline-block'}}/>
              IR Context
            </button>
            {showIR&&<div style={{background:'#F8FAFC',border:'1px solid #BFDBFE',borderRadius:8,padding:'5px 14px',display:'inline-flex',alignItems:'center',gap:8}}>
              <strong style={{color:'#3B82F6',fontSize:12}}>{project.irCode}</strong>
            </div>}
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,padding:'16px 20px 10px'}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:'#fff',borderRadius:12,padding:'12px 16px',borderLeft:`4px solid ${k.c}`,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94A3B8',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:i===3?20:26,fontWeight:700,color:k.c,lineHeight:1.15,marginBottom:2}}>{k.v}</div>
            <div style={{fontSize:11,color:'#94A3B8'}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 20px 12px'}}>
        <button onClick={onAdd} style={{background:'#3B82F6',color:'#fff',border:'none',borderRadius:8,padding:'7px 16px',cursor:'pointer',fontWeight:700,fontSize:12}}>+ Add Task</button>
        {view==='gantt'&&<button onClick={onGoToToday} style={{background:'#fff',border:'1px solid #E2E8F0',borderRadius:8,padding:'7px 14px',cursor:'pointer',color:'#475569',fontSize:12}}>Go to Today</button>}
        <button onClick={handleExport} disabled={exporting} style={{background:exporting?'#F1F5F9':'#fff',border:'1px solid #E2E8F0',borderRadius:8,padding:'7px 14px',cursor:exporting?'default':'pointer',color:exporting?'#94A3B8':'#475569',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
          {exporting?'Exporting…':'⬇ Export PDF'}
        </button>
        <div style={{marginLeft:'auto',display:'flex',gap:14,alignItems:'center',fontSize:11,color:'#64748B'}}>
          {[['#BFDBFE','Planned'],['#6EE7B7','Actual'],['#FCA5A5','Delayed'],['#EF4444','Today']].map(([c,l])=>(
            <span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:20,height:8,borderRadius:4,background:c,display:'inline-block'}}/>{l}</span>
          ))}
        </div>
      </div>

      <div style={{padding:'0 20px 24px'}}>
        {view==='gantt'&&<GanttView tasks={tasks} txDay={txDay} gRef={gRef} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask}/>}
        {view==='list'&&<ListView tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask}/>}
        {view==='board'&&<BoardView tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask}/>}
        {view==='kanban'&&<KanbanView tasks={tasks} onEdit={onEditTask} onDel={onDelTask} onTog={onTogTask}/>}
      </div>
    </div>
  );
}

// ── Gantt ────────────────────────────────────────────────────────────
function GanttView({tasks,txDay,gRef,onEdit,onDel,onTog}){
  const RH=50,HH=36;
  const LC=[{k:'cb',l:'Done',w:54},{k:'subject',l:'Task Subject',w:240},{k:'pic',l:'PIC',w:80},{k:'act',l:'',w:60}];
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2E8F0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{display:'flex'}}>
        <div style={{flexShrink:0}}>
          <div style={{display:'flex',height:HH,background:'#F8FAFC',borderBottom:'2px solid #E2E8F0',borderRight:'2px solid #E2E8F0'}}>
            {LC.map(c=><div key={c.k} style={{width:c.w,padding:'0 8px',display:'flex',alignItems:'center',justifyContent:c.k==='cb'?'center':'flex-start',flexShrink:0,fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.5px'}}>{c.l}</div>)}
          </div>
          {tasks.map((t,i)=>{
            const sc=SC[getStatus(t)];
            return(
              <div key={t.id} style={{display:'flex',height:RH,borderBottom:'1px solid #F1F5F9',borderRight:'2px solid #E2E8F0',background:i%2===0?'#fff':'#FAFAFA'}}>
                {/* Completion checkbox */}
                <div style={{width:54,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <div onClick={()=>onTog(t.id)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${t.done?'#10B981':'#CBD5E1'}`,background:t.done?'#10B981':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all 0.15s'}}>
                    {t.done&&<span style={{color:'#fff',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
                  </div>
                </div>
                {/* Subject */}
                <div style={{width:240,display:'flex',alignItems:'center',gap:6,padding:'0 6px',overflow:'hidden',flexShrink:0}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,color:t.done?'#94A3B8':'#1E293B',textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.subject}</span>
                </div>
                {/* PIC */}
                <div style={{width:80,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,color:'#64748B',overflow:'hidden',whiteSpace:'nowrap',padding:'0 4px'}}>{t.pic||'–'}</div>
                {/* Actions */}
                <div style={{width:60,display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0}}>
                  <button onClick={()=>onEdit(t)} style={{background:'#EFF6FF',color:'#3B82F6',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',fontSize:11}}>✏</button>
                  <button onClick={()=>onDel(t.id)} style={{background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',fontSize:11}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={gRef} style={{flex:1,overflowX:'auto'}}>
          <div style={{minWidth:TL_W}}>
            <div style={{height:HH,background:'#F8FAFC',borderBottom:'2px solid #E2E8F0',position:'relative'}}>
              {MONTHS.map((m,i)=><div key={i} style={{position:'absolute',left:m.x,width:m.w,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRight:'1px solid #E2E8F0',fontSize:11,fontWeight:600,color:'#64748B'}}>{m.label}</div>)}
            </div>
            {tasks.map((t,i)=>{
              const px1=d2x(t.planStart),px2=d2x(t.planEnd),ax1=d2x(t.actStart);
              const ax2=t.actEnd?d2x(t.actEnd):(t.actStart?d2x(todayStr):null);
              const bad=getStatus(t)==='Delayed'||getStatus(t)==='Overdue';
              return(
                <div key={t.id} style={{height:RH,borderBottom:'1px solid #F1F5F9',position:'relative',background:i%2===0?'#fff':'#FAFAFA'}}>
                  {MONTHS.map((_,mi)=><div key={mi} style={{position:'absolute',left:MONTHS[mi].x,top:0,bottom:0,width:1,background:'#F1F5F9'}}/>)}
                  {px1!==null&&px2!==null&&<div style={{position:'absolute',left:px1,width:Math.max(4,px2-px1),top:RH/2-12,height:10,borderRadius:5,background:'#BFDBFE'}}/>}
                  {ax1!==null&&ax2!==null&&<div style={{position:'absolute',left:ax1,width:Math.max(4,ax2-ax1),top:RH/2+2,height:10,borderRadius:5,background:bad?'#FCA5A5':'#6EE7B7'}}/>}
                  {txDay!==null&&<div style={{position:'absolute',left:txDay,top:0,bottom:0,width:2,background:'#EF4444',opacity:0.75,zIndex:3}}/>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{borderTop:'1px solid #F1F5F9',padding:'7px 16px',display:'flex',justifyContent:'flex-end',background:'#FAFAFA'}}>
        <span style={{fontSize:11,color:'#94A3B8'}}>Project Timeline · {tasks.length} tasks · 01 Jun '24 – 31 May '26</span>
      </div>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────
function ListView({tasks,onEdit,onDel,onTog}){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2E8F0',overflowX:'auto',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:'#F8FAFC',borderBottom:'2px solid #E2E8F0'}}>
          {['#','Task Subject','Done','Status','PIC',''].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',color:'#475569',fontWeight:700,fontSize:10,textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {tasks.map((t,i)=>{const st=getStatus(t);const sc=SC[st];return(
            <tr key={t.id} style={{borderBottom:'1px solid #F1F5F9',background:i%2===0?'#fff':'#FAFAFA'}}>
              <td style={{padding:'10px 12px',color:'#94A3B8',width:30}}>{i+1}</td>
              <td style={{padding:'10px 12px',maxWidth:260}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
                  <span style={{color:t.done?'#94A3B8':'#1E293B',textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.subject}</span>
                </div>
              </td>
              <td style={{padding:'10px 12px',textAlign:'center',width:50}}>
                <div onClick={()=>onTog(t.id)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${t.done?'#10B981':'#CBD5E1'}`,background:t.done?'#10B981':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.15s'}}>
                  {t.done&&<span style={{color:'#fff',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
                </div>
              </td>
              <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}><span style={{background:sc.bg,color:sc.tx,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{st}</span></td>
              <td style={{padding:'10px 12px',color:'#64748B',whiteSpace:'nowrap'}}>{t.pic||'–'}</td>
              <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}><div style={{display:'flex',gap:5}}>
                <button onClick={()=>onEdit(t)} style={{background:'#EFF6FF',color:'#3B82F6',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11}}>Edit</button>
                <button onClick={()=>onDel(t.id)} style={{background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11}}>Del</button>
              </div></td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────
function BoardView({tasks,onEdit,onDel,onTog}){
  return(
    <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:4}}>
      {['Planned','In Progress','Overdue','Delayed','Done'].map(col=>{
        const ct=tasks.filter(t=>getStatus(t)===col);const sc=SC[col];
        return(
          <div key={col} style={{flexShrink:0,width:215}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              <span style={{width:9,height:9,borderRadius:'50%',background:sc.dot,flexShrink:0}}/>
              <span style={{fontWeight:700,color:'#374151',fontSize:13}}>{col}</span>
              <span style={{marginLeft:'auto',background:sc.bg,color:sc.tx,borderRadius:20,fontSize:11,padding:'1px 8px',fontWeight:700}}>{ct.length}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {ct.map(t=>(
                <div key={t.id} style={{background:'#fff',borderRadius:10,padding:'12px 14px',border:'1px solid #E2E8F0',boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
                  <div style={{fontWeight:700,color:'#1E293B',fontSize:12,marginBottom:5,lineHeight:1.4}}>{t.subject}</div>
                  <div style={{fontSize:11,color:'#94A3B8',marginBottom:2}}>PIC: {t.pic||'–'}</div>
                  <div style={{fontSize:11,color:'#94A3B8',marginBottom:10}}>Due: {fmt(t.planEnd)}</div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>onTog(t.id)} style={{flex:1,background:sc.bg,color:sc.tx,border:`1px solid ${sc.dot}44`,borderRadius:6,padding:'5px 0',cursor:'pointer',fontSize:11,fontWeight:700}}>{t.done?'Reopen':'Mark Done'}</button>
                    <button onClick={()=>onEdit(t)} style={{background:'#F8FAFC',color:'#64748B',border:'1px solid #E2E8F0',borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:11}}>✏</button>
                    <button onClick={()=>onDel(t.id)} style={{background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:6,padding:'5px 8px',cursor:'pointer',fontSize:11}}>✕</button>
                  </div>
                </div>
              ))}
              {ct.length===0&&<div style={{color:'#CBD5E1',fontSize:12,textAlign:'center',padding:'22px 0',border:'2px dashed #F1F5F9',borderRadius:10}}>No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kanban ───────────────────────────────────────────────────────────
function KanbanView({tasks,onEdit,onDel,onTog}){
  return(
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2E8F0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)'}}>
        {['Planned','In Progress','Overdue','Delayed','Done'].map(col=>{
          const ct=tasks.filter(t=>getStatus(t)===col);const sc=SC[col];
          return(
            <div key={col} style={{borderRight:'1px solid #E2E8F0',minHeight:300}}>
              <div style={{padding:'10px 12px',background:sc.bg,borderBottom:`2px solid ${sc.dot}`,display:'flex',alignItems:'center',gap:7}}>
                <span style={{width:9,height:9,borderRadius:'50%',background:sc.dot}}/>
                <span style={{fontWeight:700,color:sc.tx,fontSize:12}}>{col}</span>
                <span style={{marginLeft:'auto',background:'rgba(255,255,255,0.65)',color:sc.tx,borderRadius:20,fontSize:11,padding:'1px 7px',fontWeight:700}}>{ct.length}</span>
              </div>
              <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:7}}>
                {ct.map(t=>(
                  <div key={t.id} style={{background:'#fff',borderRadius:8,padding:'9px 11px',border:'1px solid #E2E8F0',fontSize:12}}>
                    <div style={{fontWeight:700,color:'#1E293B',marginBottom:3,lineHeight:1.3,fontSize:11}}>{t.subject}</div>
                    <div style={{color:'#94A3B8',fontSize:10,marginBottom:7}}>{t.pic||'–'} · {fmt(t.planEnd)}</div>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>onTog(t.id)} style={{flex:1,background:sc.bg,color:sc.tx,border:'none',borderRadius:5,padding:'4px 0',cursor:'pointer',fontSize:10,fontWeight:700}}>{t.done?'Reopen':'Done'}</button>
                      <button onClick={()=>onEdit(t)} style={{background:'#F1F5F9',color:'#64748B',border:'none',borderRadius:5,padding:'4px 7px',cursor:'pointer',fontSize:10}}>✏</button>
                      <button onClick={()=>onDel(t.id)} style={{background:'#FEF2F2',color:'#EF4444',border:'none',borderRadius:5,padding:'4px 7px',cursor:'pointer',fontSize:10}}>✕</button>
                    </div>
                  </div>
                ))}
                {ct.length===0&&<div style={{color:'#CBD5E1',fontSize:11,textAlign:'center',padding:'18px 0'}}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task Modal ───────────────────────────────────────────────────────
function TaskModal({task,onSave,onClose}){
  const [f,setF]=useState(()=>task?{...task}:{subject:'',planStart:'',planEnd:'',actStart:'',actEnd:'',pic:'',done:false});
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const fi={width:'100%',padding:'8px 11px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:13,boxSizing:'border-box',outline:'none'};
  const lb={display:'block',fontSize:10,fontWeight:700,color:'#64748B',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'};
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:500,maxWidth:'100%',boxShadow:'0 25px 60px rgba(0,0,0,.2)'}}>
        <h3 style={{margin:'0 0 20px',fontSize:16,fontWeight:700,color:'#0F172A'}}>{task?'Edit Task':'Add New Task'}</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div style={{gridColumn:'1/-1'}}><label style={lb}>Task Subject *</label><input value={f.subject} onChange={e=>upd('subject',e.target.value)} placeholder="Enter task name..." style={fi}/></div>

          <div><label style={lb}>PIC</label><input value={f.pic||''} onChange={e=>upd('pic',e.target.value)} placeholder="Person in Charge" style={fi}/></div>
          <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:22}}>
            <div onClick={()=>upd('done',!f.done)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${f.done?'#10B981':'#CBD5E1'}`,background:f.done?'#10B981':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all 0.15s'}}>
              {f.done&&<span style={{color:'#fff',fontSize:14,fontWeight:700,lineHeight:1}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:'#475569',cursor:'pointer'}} onClick={()=>upd('done',!f.done)}>Mark as completed</span>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',color:'#64748B',fontSize:13}}>Cancel</button>
          <button onClick={()=>{if(f.subject.trim())onSave(f);}} style={{padding:'9px 22px',borderRadius:8,border:'none',background:f.subject.trim()?'#3B82F6':'#CBD5E1',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:13}}>{task?'Save Changes':'Add Task'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Project Modal ─────────────────────────────────────────────────────
function ProjectModal({project,onSave,onClose}){
  const [f,setF]=useState(()=>project?{...project}:{name:'',irCode:'',description:'',color:'#3B82F6'});
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const fi={width:'100%',padding:'8px 11px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:13,boxSizing:'border-box',outline:'none'};
  const lb={display:'block',fontSize:10,fontWeight:700,color:'#64748B',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.5px'};
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:460,maxWidth:'100%',boxShadow:'0 25px 60px rgba(0,0,0,.2)'}}>
        <h3 style={{margin:'0 0 20px',fontSize:16,fontWeight:700,color:'#0F172A'}}>{project?'Edit Project':'New Project'}</h3>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={lb}>Project Name *</label><input value={f.name} onChange={e=>upd('name',e.target.value)} placeholder="e.g. ERP System Implementation" style={fi}/></div>
          <div><label style={lb}>IR Code</label><input value={f.irCode||''} onChange={e=>upd('irCode',e.target.value)} placeholder="e.g. IR-CRA-2025-001" style={fi}/></div>
          <div><label style={lb}>Description</label><input value={f.description||''} onChange={e=>upd('description',e.target.value)} placeholder="Brief project description..." style={fi}/></div>
          <div>
            <label style={lb}>Project Color</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {PROJ_COLORS.map(c=><button key={c} onClick={()=>upd('color',c)} style={{width:32,height:32,borderRadius:'50%',background:c,border:f.color===c?'3px solid #0F172A':'3px solid transparent',cursor:'pointer',outline:'none',flexShrink:0}}/>)}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:8,border:'1px solid #E2E8F0',background:'#fff',cursor:'pointer',color:'#64748B',fontSize:13}}>Cancel</button>
          <button onClick={()=>{if(f.name.trim())onSave(f);}} style={{padding:'9px 22px',borderRadius:8,border:'none',background:f.name.trim()?'#3B82F6':'#CBD5E1',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:13}}>{project?'Save Changes':'Create Project'}</button>
        </div>
      </div>
    </div>
  );
}
