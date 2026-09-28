import { useState } from "react";
import { useStudent } from "./StudentContext";

export default function Messages() {
  const { conversations, sendMessage, markRead } = useStudent();
  const [activeId, setActiveId] = useState(conversations[0]?.id);
  const [text, setText] = useState("");
  const active = conversations.find((c) => c.id === activeId);

  function open(id) {
    setActiveId(id);
    markRead(id);
  }
  function send() {
    const t = text.trim();
    if (!t) return;
    sendMessage(activeId, t);
    setText("");
  }

  return (
    <div className="container">
      <h1 className="page-title">Messages</h1>
      <p className="page-subtitle">Chats with companies and gig posters.</p>
      <div className="messages-layout">
        <div className="conversation-list">
          {conversations.map((c) => (
            <button key={c.id} className={`conversation-row${c.id === activeId ? " active" : ""}`} onClick={() => open(c.id)}>
              <div className="conversation-avatar">{c.name[0]}</div>
              <div className="conversation-body">
                <div className="conversation-top-row"><span className="conversation-name">{c.name}</span><span className="conversation-time">{c.time}</span></div>
                <p className="conversation-preview">{c.lastMessage}</p>
              </div>
              {c.unread && <span className="conversation-dot" />}
            </button>
          ))}
        </div>
        <div className="thread-panel">
          {active && (
            <>
              <div className="thread-header"><div className="conversation-avatar">{active.name[0]}</div><span className="thread-name">{active.name}</span></div>
              <div className="thread-messages">
                {active.messages.map((m, i) => (
                  <div key={i} className={`bubble-row ${m.from === "me" ? "me" : "them"}`}>
                    <div className={`bubble ${m.from === "me" ? "bubble-me" : "bubble-them"}`}>{m.text}</div>
                    <span className="bubble-time">{m.time}</span>
                  </div>
                ))}
              </div>
              <div className="thread-input-row">
                <input className="thread-input" placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn-pitch" onClick={send}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
