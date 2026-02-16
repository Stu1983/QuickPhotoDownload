import React, { useState, useEffect } from 'react';

const styles = {
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minWidth: '180px',
  },
};

export default function DayFilter({ value, onChange }) {
  const [days, setDays] = useState([]);

  useEffect(() => {
    fetch('/api/days')
      .then(r => r.json())
      .then(setDays)
      .catch(() => {});
  }, []);

  return (
    <select style={styles.select} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">All Days</option>
      {days.map(d => (
        <option key={d.date} value={d.date}>
          {d.label} ({d.count})
        </option>
      ))}
    </select>
  );
}
