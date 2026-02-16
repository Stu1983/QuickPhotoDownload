import React, { useState, useRef, useEffect } from 'react';

const styles = {
  container: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--accent)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    flex: 1,
    outline: 'none',
  },
  btn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)',
    color: '#fff',
  },
  cancelBtn: {
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
};

export default function FolderRenameInput({ currentName, onSave, onCancel }) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSave(name);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div style={styles.container}>
      <input
        ref={inputRef}
        style={styles.input}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Event name (e.g. Kids Birthday)"
      />
      <button style={{ ...styles.btn, ...styles.saveBtn }} onClick={() => onSave(name)}>Save</button>
      <button style={{ ...styles.btn, ...styles.cancelBtn }} onClick={onCancel}>Cancel</button>
    </div>
  );
}
