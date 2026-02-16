import React from 'react';
import { FLAG_COLOURS } from './FlagBar';

const styles = {
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minWidth: '140px',
  },
};

export default function FlagFilter({ value, onChange }) {
  return (
    <select style={styles.select} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">All Flags</option>
      {FLAG_COLOURS.map(fc => (
        <option key={fc.id} value={fc.id}>
          {fc.label}
        </option>
      ))}
    </select>
  );
}
