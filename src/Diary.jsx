import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export default function Diary() {
  const [entries, setEntries] = useState([]);
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/diary');
      setEntries(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function addEntry(event) {
    event.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/api/diary', { method: 'POST', body: JSON.stringify({ body: body.trim(), shared }) });
      setBody(''); setShared(false);
      await refresh();
      setNotice('Reflection saved successfully.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function changeSharing(entry) {
    setBusyId(entry.id); setError(''); setNotice('');
    try {
      await api(`/api/diary/${encodeURIComponent(entry.id)}/share`, {
        method: 'PUT', body: JSON.stringify({ shared: !entry.shared }),
      });
      setEntries(old => old.map(item => item.id === entry.id ? { ...item, shared: !entry.shared } : item));
      setNotice(!entry.shared ? 'This reflection is now shared with educators.' : 'This reflection is now private.');
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  }

  return <section className="diary-page">
    <div className="diary-hero"><span className="diary-eyebrow">YOUR LEARNING JOURNEY</span><h1>Reflection Diary</h1><p>Record what you learned, celebrate progress, and choose what to share with educators. Entries are private unless you decide otherwise.</p></div>
    <div className="diary-panel">
      <h2>Write a reflection</h2>
      <form onSubmit={addEntry}>
        <label htmlFor="reflection-body">What did you learn or achieve today?</label>
        <textarea id="reflection-body" rows={6} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} placeholder="What went well? What challenged you? What will you try next?" required />
        <div className="diary-form-footer"><label className="diary-share"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Share this entry with educators</label><span>{body.length}/5000</span></div>
        <button className="diary-primary" disabled={saving || !body.trim()} type="submit">{saving ? 'Saving…' : 'Save reflection'}</button>
      </form>
    </div>
    {error && <div className="diary-error" role="alert">{error}</div>}
    {notice && <div className="diary-notice" role="status">{notice}</div>}
    <div className="diary-entries-heading"><h2>My reflections</h2><span>{entries.length} entries</span></div>
    {loading ? <p>Loading your reflections…</p> : entries.length === 0 ? <div className="diary-panel diary-empty">No reflections yet. Your first entry will appear here.</div> : <div className="diary-entries">{entries.map(entry => <article className="diary-panel diary-entry" key={entry.id}>
      <div className="diary-entry-top"><time>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : `Entry #${entry.id}`}</time><span className={entry.shared ? 'diary-shared' : 'diary-private'}>{entry.shared ? 'Shared with educators' : 'Private'}</span></div>
      <p className="diary-entry-body">{entry.body}</p>
      <button className="diary-secondary" disabled={busyId === entry.id} onClick={() => changeSharing(entry)}>{busyId === entry.id ? 'Updating…' : entry.shared ? 'Make private' : 'Share with educators'}</button>
    </article>)}</div>}
  </section>;
}
