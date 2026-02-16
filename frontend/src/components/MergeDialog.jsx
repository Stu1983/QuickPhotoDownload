import React, { useState } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '360px',
    maxWidth: '90vw',
    border: '1px solid var(--border)',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '16px',
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    marginBottom: '16px',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '8px',
  },
  btn: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  btnPrimary: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#fff',
  },
};

export default function MergeDialog({ folders, onMerge, onClose }) {
  const [targetId, setTargetId] = useState(folders[0]?.id || 0);
  const [newName, setNewName] = useState('');

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.title}>Merge {folders.length} Folders</div>

        <label style={styles.label}>Merge into:</label>
        <select
          style={styles.select}
          value={targetId}
          onChange={e => setTargetId(Number(e.target.value))}
        >
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.folder_name}</option>
          ))}
        </select>

        <label style={styles.label}>New folder name (optional):</label>
        <input
          style={styles.input}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="e.g. 270216 - 010316 Half Term"
        />

        <div style={styles.buttons}>
          <button style={styles.btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={() => onMerge(targetId, newName)}
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}
