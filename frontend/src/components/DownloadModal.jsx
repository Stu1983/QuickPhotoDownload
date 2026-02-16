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
    minWidth: '320px',
    maxWidth: '90vw',
    border: '1px solid var(--border)',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '16px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    marginBottom: '6px',
  },
  optionSelected: {
    background: 'var(--bg-hover)',
  },
  radio: {
    width: '18px',
    height: '18px',
  },
  label: {
    flex: 1,
  },
  desc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
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

const SIZE_OPTIONS = [
  { value: 'share', label: 'Share Size', desc: '2048px, 80% quality — best for sharing' },
  { value: 'high', label: 'High Quality', desc: '4096px, 90% quality — for printing' },
  { value: 'original', label: 'Original', desc: 'Untouched camera JPEG' },
];

export default function DownloadModal({ onClose, onDownload, count }) {
  const [size, setSize] = useState('share');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload(size);
    setDownloading(false);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.title}>Download {count} photo{count !== 1 ? 's' : ''}</div>

        {SIZE_OPTIONS.map(opt => (
          <div
            key={opt.value}
            style={{
              ...styles.option,
              ...(size === opt.value ? styles.optionSelected : {}),
            }}
            onClick={() => setSize(opt.value)}
          >
            <input
              type="radio"
              checked={size === opt.value}
              onChange={() => setSize(opt.value)}
              style={styles.radio}
            />
            <div style={styles.label}>
              <div>{opt.label}</div>
              <div style={styles.desc}>{opt.desc}</div>
            </div>
          </div>
        ))}

        <div style={styles.buttons}>
          <button style={styles.btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Preparing...' : 'Download ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
}
