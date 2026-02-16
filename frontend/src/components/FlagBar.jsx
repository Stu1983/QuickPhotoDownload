import React from 'react';

export const FLAG_COLOURS = [
  { id: 'red',    hex: '#EF4444', label: 'Red' },
  { id: 'blue',   hex: '#3B82F6', label: 'Blue' },
  { id: 'green',  hex: '#22C55E', label: 'Green' },
  { id: 'yellow', hex: '#EAB308', label: 'Yellow' },
  { id: 'orange', hex: '#F97316', label: 'Orange' },
  { id: 'purple', hex: '#A855F7', label: 'Purple' },
  { id: 'pink',   hex: '#EC4899', label: 'Pink' },
  { id: 'cyan',   hex: '#06B6D4', label: 'Cyan' },
  { id: 'lime',   hex: '#84CC16', label: 'Lime' },
  { id: 'white',  hex: '#F5F5F5', label: 'White' },
];

const styles = {
  bar: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    padding: '12px',
    flexWrap: 'wrap',
  },
  button: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    borderColor: '#fff',
    transform: 'scale(1.15)',
    boxShadow: '0 0 8px rgba(255,255,255,0.3)',
  },
};

export default function FlagBar({ activeFlags = [], onToggle }) {
  return (
    <div style={styles.bar}>
      {FLAG_COLOURS.map(fc => {
        const isActive = activeFlags.includes(fc.id);
        return (
          <button
            key={fc.id}
            title={fc.label}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(fc.id);
            }}
            style={{
              ...styles.button,
              background: fc.hex,
              ...(isActive ? styles.active : {}),
              opacity: isActive ? 1 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
}
