import React, { useState, useEffect } from 'react';
import FolderRenameInput from './FolderRenameInput';
import MergeDialog from './MergeDialog';

const styles = {
  container: {
    padding: '16px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  mergeBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    background: 'var(--accent)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  folder: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'var(--bg-card)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  folderDate: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  count: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    padding: '4px 10px',
    background: 'var(--bg-primary)',
    borderRadius: '12px',
  },
};

export default function FolderList() {
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showMerge, setShowMerge] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const fetchFolders = () => {
    fetch('/api/folders')
      .then(r => r.json())
      .then(setFolders)
      .catch(() => {});
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRename = async (folderId, displayName) => {
    await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    setEditingId(null);
    fetchFolders();
  };

  const handleMerge = async (targetId, newName) => {
    const sourceIds = [...selected].filter(id => id !== targetId);
    await fetch('/api/folders/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_folder_ids: sourceIds,
        target_folder_id: targetId,
        new_name: newName || null,
      }),
    });
    setSelected(new Set());
    setShowMerge(false);
    fetchFolders();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Folders ({folders.length})</div>
        {selected.size >= 2 && (
          <button style={styles.mergeBtn} onClick={() => setShowMerge(true)}>
            Merge Selected ({selected.size})
          </button>
        )}
      </div>

      <div style={styles.list}>
        {folders.map(folder => (
          <div key={folder.id} style={styles.folder}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={selected.has(folder.id)}
              onChange={() => toggleSelect(folder.id)}
            />
            <div style={styles.folderInfo}>
              {editingId === folder.id ? (
                <FolderRenameInput
                  currentName={folder.display_name || ''}
                  onSave={(name) => handleRename(folder.id, name)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  style={styles.folderName}
                  onClick={() => setEditingId(folder.id)}
                  title="Click to rename"
                >
                  {folder.folder_name}
                </div>
              )}
              <div style={styles.folderDate}>
                Date prefix: {folder.date_prefix}
              </div>
            </div>
            <div style={styles.count}>{folder.photo_count} photos</div>
          </div>
        ))}
      </div>

      {showMerge && (
        <MergeDialog
          folders={folders.filter(f => selected.has(f.id))}
          onMerge={handleMerge}
          onClose={() => setShowMerge(false)}
        />
      )}
    </div>
  );
}
