import {useEffect,useState} from 'react';
import {api} from './api';
export default function SharedMessages(){
 const [contacts,setContacts]=useState([]),[messages,setMessages]=useState([]),[selected,setSelected]=useState(''),[draft,setDraft]=useState(''),[error,setError]=useState('');
 const refresh=()=>api('/api/messages/threads').then(setMessages).catch(e=>setError(e.message));
 useEffect(()=>{api('/api/messages/contacts').then(setContacts).catch(e=>setError(e.message));refresh()},[]);
 const peers=[...contacts].sort((a,b)=>Number(messages.some(m=>m.otherId===b.id))-Number(messages.some(m=>m.otherId===a.id)));
 const current=selected||peers[0]?.id;
 async function send(e){e.preventDefault();if(!draft.trim()||!current)return;try{await api('/api/messages',{method:'POST',body:JSON.stringify({recipientId:Number(current),body:draft.trim()})});setDraft('');refresh()}catch(e){setError(e.message)}}
 return <section className="partner-panel"><h2>Messages</h2><p>Message students, educators and employers.</p>{error&&<p className="partner-error">{error}</p>}<div className="messages-layout"><div className="conversation-list">{peers.map(p=><button key={p.id} className={'conversation-row'+(Number(current)===p.id?' active':'')} onClick={()=>setSelected(p.id)}><span className="conversation-avatar">{p.name[0]}</span><span className="conversation-body"><strong>{p.name}</strong><small> · {p.role}</small></span></button>)}</div><div className="thread-panel">{current?<><div className="thread-header"><strong>{contacts.find(c=>c.id===Number(current))?.name}</strong></div><div className="thread-messages">{messages.filter(m=>m.otherId===Number(current)).map(m=><div className={'bubble-row '+(m.isMine?'me':'them')} key={m.id}><div className="bubble">{m.body}</div><small>{m.createdAt}</small></div>)}</div><form className="thread-input-row" onSubmit={send}><input className="thread-input" value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} placeholder="Write a message…"/><button className="btn btn-primary">Send</button></form></>:<p>No contacts available.</p>}</div></div></section>
}
