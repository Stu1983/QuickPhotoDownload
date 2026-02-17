import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  title: {
    fontWeight: 700,
    fontSize: '1.1rem',
    marginRight: '8px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    flex: 1,
  },
  navLink: {
    padding: '6px 14px',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'background 0.15s',
  },
  navLinkActive: {
    background: 'var(--accent)',
    color: '#fff',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    borderRadius: '10px',
    background: '#ef4444',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    marginLeft: '4px',
    padding: '0 5px',
  },
  scanBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};

export default function Toolbar() {
  const location = useLocation();
  const [flagCount, setFlagCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch('/api/flags/summary')
      .then(r => r.json())
      .then(data => {
        const total = data.reduce((sum, f) => sum + f.count, 0);
        setFlagCount(total);
      })
      .catch(() => {});
  }, [location]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/scan', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setScanning(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header style={styles.toolbar}>
      <Link to="/" style={styles.title}>Photo Browser</Link>
      <nav style={styles.nav}>
        <Link
          to="/"
          style={{ ...styles.navLink, ...(isActive('/') ? styles.navLinkActive : {}) }}
        >
          Browse
        </Link>
        <Link
          to="/flagged"
          style={{ ...styles.navLink, ...(isActive('/flagged') ? styles.navLinkActive : {}) }}
        >
          Flagged
          {flagCount > 0 && <span style={styles.badge}>{flagCount}</span>}
        </Link>
        <Link
          to="/folders"
          style={{ ...styles.navLink, ...(isActive('/folders') ? styles.navLinkActive : {}) }}
        >
          Folders
        </Link>
      </nav>
      <button style={styles.scanBtn} onClick={handleScan} disabled={scanning}>
        {scanning ? 'Scanning...' : 'Rescan'}
      </button>
    </header>
  );
}
