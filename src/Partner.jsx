import SharedMessages from './SharedMessages';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api, clearPartnerSession, getPartnerSession, savePartnerSession } from './api';

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

export function PartnerLogin({onSuccess}) {
 const navigate=useNavigate();
 const expectedRole=new URLSearchParams(window.location.search).get('role');
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function login(e){e.preventDefault();setError('');setBusy(true);
  try{const result=await post('/api/auth/login',{email:email.trim().toLowerCase(),password});
   if(!['student','educator','employer'].includes(result.role)){setError('This account has an unsupported role.');return;}
   if(expectedRole && expectedRole!==result.role){setError(`This account is registered as ${result.role}. Go back and choose that role.`);return;}
   const session={token:result.token,role:result.role,email:email.trim().toLowerCase(),userId:result.user?.id ?? result.userId};savePartnerSession(session);onSuccess?.(session);
   navigate(result.role==='student'?'/':'/partner',{replace:true});
  }catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the API. Start the backend in the backend folder with npm install then npm start, and confirm http://localhost:4000 is running.':err.message);}finally{setBusy(false);}}
 return <div className="partner-wrap"><div className="partner-panel partner-login"><Link to="/">← Choose role</Link><h1>{expectedRole?`${expectedRole[0].toUpperCase()+expectedRole.slice(1)} login`:'Sign in to Alumable'}</h1><p>Use the credentials supplied by your administrator.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p role="alert" className="partner-error">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Signing in…':'Log in'}</button></form></div></div>;
}
function useRemote(path, deps = []) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { let alive = true; setLoading(true); api(path).then(d => { if (alive) { setData(d); setError(''); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [path, refresh, ...deps]);
  return { data, error, loading, reload: () => setRefresh(v=>v+1) };
}
function Notice({message}) { return message ? <p className="partner-error" role="alert">{message}</p> : null; }
function Marking() {
  const claims = useRemote('/api/educator/claims?status=pending');
  const rubric = useRemote('/api/educator/rubric');
  const [selected, setSelected] = useState(null), [scores, setScores] = useState({}), [comments, setComments] = useState({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const criteria = rubric.data?.criteria || [];
  const weighted = criteria.reduce((sum, c) => sum + (Number(scores[c.id] || 0) / 4) * c.weight, 0);
  async function submit(decision) {
    setBusy(true); setMessage('');
    try {
      const result = await post(`/api/educator/claims/${selected.id}/mark`, { decision, marks: criteria.map(c => ({ criterion: c.id, score: Number(scores[c.id] || 0), comment: comments[c.id] || '' })) });
      setMessage(`${result.status}: weighted score ${result.weightedScore}%, ${result.xpAwarded} XP awarded`);
      setSelected(null); claims.reload();
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="partner-panel"><h2>Marking queue</h2><p className="partner-muted">Rubric: placeholder until Scott confirms</p><Notice message={claims.error || rubric.error || message}/>{claims.loading || rubric.loading ? <p>Loading queue…</p> : !selected ? <>{!claims.data?.length && <p>No pending claims.</p>}{(claims.data || []).map(c => <button className="partner-list-button" key={c.id} onClick={() => { setSelected(c); setScores({}); setComments({}); setMessage(''); }}><strong>{c.studentName}</strong> · {c.activityTitle} <span>Review →</span></button>)}</> : <div><button className="btn btn-outline" onClick={() => setSelected(null)}>← Back to queue</button><h3>{selected.studentName}: {selected.activityTitle}</h3><p>Evidence: {selected.evidence || 'No evidence text supplied'}</p>{criteria.map(c => <div className="partner-criterion" key={c.id}><label><strong>{c.name}</strong> ({c.weight}%)<select value={scores[c.id] ?? 0} onChange={e=>setScores(s=>({...s,[c.id]:Number(e.target.value)}))}>{[0,1,2,3,4].map(n=><option key={n} value={n}>{n} — {rubric.data.scale?.levels?.[n] || ''}</option>)}</select></label><p className="partner-muted">{c.descriptors?.[scores[c.id] ?? 0]}</p><label>Comment<textarea maxLength={500} value={comments[c.id] || ''} onChange={e=>setComments(s=>({...s,[c.id]:e.target.value}))}/></label></div>)}<h3>Weighted score: {Math.round(weighted*10)/10}%</h3><div className="partner-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>submit('approve')}>Approve & award XP</button><button className="btn btn-outline" disabled={busy} onClick={()=>submit('reject')}>Reject</button></div></div>}</section>;
}
function Assignments() {
  const students = useRemote('/api/educator/students');
  const assignments = useRemote('/api/educator/assignments');
  const [activities, setActivities] = useState([]), [error, setError] = useState(''), [form, setForm] = useState({ studentId:'', activityId:'', bonusXp:0, dueDate:'', note:'' });
  useEffect(() => { api('/api/educator/activities').then(setActivities).catch(e => setError(e.message)); }, []);
  async function create(e) { e.preventDefault(); setError(''); try { await post('/api/educator/assignments', { studentId: Number(form.studentId), activityId: form.activityId, bonusXp: Number(form.bonusXp), ...(form.dueDate ? { dueDate:form.dueDate } : {}), note:form.note }); assignments.reload(); setForm(f=>({...f, note:'', dueDate:'', bonusXp:0})); } catch(err) { setError(err.message); } }
  return <section className="partner-panel"><h2>Assign work</h2><Notice message={error || students.error || assignments.error}/><form onSubmit={create}><label>Student<select required value={form.studentId} onChange={e=>setForm(f=>({...f,studentId:e.target.value}))}><option value="">Choose a student</option>{(students.data||[]).map(s=><option key={s.id} value={s.id}>{s.name} · Level {s.level} · {s.totalXp ?? s.xp ?? 0} XP</option>)}</select></label><label>Activity<select required value={form.activityId} onChange={e=>setForm(f=>({...f,activityId:e.target.value}))}><option value="">Choose an activity</option>{activities.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.title} · {a.base_xp} XP</option>)}</select></label><label>Bonus XP (0–100)<input type="number" min="0" max="100" value={form.bonusXp} onChange={e=>setForm(f=>({...f,bonusXp:e.target.value}))}/></label><label>Due date<input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/></label><label>Instructions<textarea maxLength={500} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></label><button className="btn btn-primary">Assign activity</button></form><h3>My assignments</h3>{(assignments.data||[]).map(a=><div className="partner-list-button" key={a.id}>{a.studentName} · {a.activityId} · {a.status} · +{a.bonusXp} XP</div>)}</section>;
}
function Diaries() {
  const students = useRemote('/api/educator/students');
  const [id,setId]=useState('');
  const diary = useRemote(id ? `/api/educator/students/${id}/diary` : '/api/educator/students/0/diary');
  return <section className="partner-panel"><h2>Shared student diary</h2><p>Only entries explicitly shared by the student are visible.</p><label>Student<select value={id} onChange={e=>setId(e.target.value)}><option value="">Choose a student</option>{(students.data||[]).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{id && <><Notice message={diary.error}/>{diary.loading ? <p>Loading…</p> : diary.data?.length ? diary.data.map(d=><article className="partner-criterion" key={d.id}><small>{d.createdAt}</small><p>{d.body}</p></article>) : <p>No shared diary entries.</p>}</>}</section>;
}
function Activities() {
  const list = useRemote('/api/educator/activities');
  const [form,setForm] = useState({title:'',description:'',category:'Learning',duration:'30 min',baseXp:25,type:'repeatable',requiresMarking:true});
  const [message,setMessage] = useState('');
  async function create(e) { e.preventDefault(); try { await post('/api/educator/activities', {...form,baseXp:Number(form.baseXp)}); setMessage('Activity created'); list.reload(); } catch(err) {setMessage(err.message);} }
  async function edit(a){const title=window.prompt('Activity title',a.title);if(title===null)return;const description=window.prompt('Description',a.description||'');if(description===null)return;const points=window.prompt('XP reward',String(a.base_xp));if(points===null)return;try{await api(`/api/educator/activities/${a.id}`,{method:'PUT',body:JSON.stringify({title,description,baseXp:Number(points)})});list.reload();setMessage('Activity updated')}catch(e){setMessage(e.message)}}
  async function toggle(a) { try { await api(`/api/educator/activities/${a.id}`, { method:'PUT',body:JSON.stringify({active:!a.active}) }); list.reload(); } catch(e) {setMessage(e.message);} }
  return <section className="partner-panel"><h2>Activities</h2><Notice message={message || list.error}/><form onSubmit={create}><label>Title<input required maxLength={120} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></label><label>Description<textarea maxLength={1000} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></label><label>XP reward<input type="number" min="0" max="500" value={form.baseXp} onChange={e=>setForm(f=>({...f,baseXp:e.target.value}))}/></label><label>Type<select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="repeatable">Repeatable</option><option value="once">Once</option><option value="daily">Daily</option></select></label><label><input type="checkbox" checked={form.requiresMarking} onChange={e=>setForm(f=>({...f,requiresMarking:e.target.checked}))}/> Requires marking</label><button className="btn btn-primary">Create activity</button></form><h3>Available activities</h3>{(list.data||[]).map(a=><div className="partner-list-button" key={a.id}><span>{a.title} · {a.base_xp} XP · {a.active?'Active':'Inactive'}</span><button className="btn btn-outline" onClick={()=>edit(a)}>Edit</button><button className="btn btn-outline" onClick={()=>toggle(a)}>{a.active?'Deactivate':'Activate'}</button></div>)}</section>;
}
function Gigs() {
 const list=useRemote('/api/educator/my-gigs');
 const [form,setForm]=useState({title:'',description:'',pay:'',minLevel:1}),[message,setMessage]=useState('');
 async function create(e){e.preventDefault();try{await post('/api/educator/my-gigs',{...form,minLevel:Number(form.minLevel)});setMessage('Gig posted');list.reload();setForm({title:'',description:'',pay:'',minLevel:1});}catch(err){setMessage(err.message)}}
 async function complete(id){try{await post(`/api/educator/gig-applications/${id}/complete`,{});setMessage('Gig marked complete; student slot freed');list.reload();}catch(err){setMessage(err.message)}}
 return <section className="partner-panel"><h2>My gigs</h2><Notice message={list.error||message}/><h3>Post a gig</h3><form onSubmit={create}><label>Title<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Description<textarea required maxLength={2000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Pay<input required maxLength={100} value={form.pay} onChange={e=>setForm({...form,pay:e.target.value})} placeholder="$80 fixed"/></label><label>Minimum level<input type="number" min="1" max="100" required value={form.minLevel} onChange={e=>setForm({...form,minLevel:e.target.value})}/></label><button className="btn btn-primary">Post gig</button></form><h3>Posted gigs and applicants</h3>{list.loading?<p>Loading…</p>:!(list.data||[]).length?<p>No gigs posted yet.</p>:(list.data||[]).map(g=><div className="partner-criterion" key={g.id}><h3>{g.title}</h3><p>{g.description} · {g.pay} · Level {g.min_level}+</p><strong>Applicants</strong>{!g.applicants.length?<p>No applicants yet.</p>:g.applicants.map(a=><div key={a.id} className="partner-list-button"><span>{a.studentName} · Level {a.level} · {a.status}</span>{a.status==='active'&&<button className="btn btn-primary" onClick={()=>complete(a.id)}>Mark complete</button>}</div>)}</div>)}</section>;
}
function Audit() { const log=useRemote('/api/educator/audit'); return <section className="partner-panel"><h2>Audit log</h2><Notice message={log.error}/>{(log.data||[]).map(e=><div key={e.id} className="partner-list-button">{e.action} · {e.detail} <small>{e.createdAt}</small></div>)}</section>; }
function PartnerMessages(){return <SharedMessages/>}
export function PartnerPortal() {
  const session=getPartnerSession(), navigate=useNavigate();
  const [tab,setTab]=useState('overview');
  if (!session?.token || !['educator','employer'].includes(session.role)) return <Navigate to="/partner/login" replace/>;
  const educator=session.role==='educator';
  const tabs=[['overview','Overview'],...(educator?[['marking','Marking queue'],['activities','Activities']]:[]),['assign','Assign work'],['messages','Messages'],...(educator?[['diary','Shared diary'],['audit','Audit log']]:[['gigs','My gigs']])];
  const screens={marking:<Marking/>,activities:<Activities/>,assign:<Assignments/>,diary:<Diaries/>,audit:<Audit/>,gigs:<Gigs/>,messages:<PartnerMessages/>};
  return <div className="partner-wrap"><header className="partner-header"><Link to="/" className="partner-brand"><img src="/alumable-logo.png" alt=""/> Alumable <span>Partner portal</span></Link><div>{session.email} · {session.role} <button className="btn btn-outline" onClick={()=>{clearPartnerSession();window.location.replace('/');}}>Log out</button></div></header><div className="partner-layout"><nav className="partner-nav">{tabs.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</nav><main className="partner-content">{tab==='overview'?<section className="partner-panel"><h1>Welcome, {educator?'educator':'employer'}!</h1><p>You're signed in to the live Alumable API. Choose a tool on the left to get started.</p><div className="partner-summary">{tabs.slice(1).map(([key,label])=><button key={key} className="partner-tile" onClick={()=>setTab(key)}>{label} →</button>)}</div></section>:screens[tab]}</main></div></div>;
}
