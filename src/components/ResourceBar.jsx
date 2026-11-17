import React from 'react';

export default function ResourceBar({ world }) {
  const { inventory, tick, robot } = world;
  const items = [
    { icon: '🌾', label: 'ข้าวสาลี', value: inventory.wheat },
    { icon: '🪵', label: 'ไม้', value: inventory.wood },
    { icon: '💎', label: 'แร่', value: inventory.ore },
    { icon: '⏱', label: 'จังหวะเวลา', value: tick },
    { icon: '📍', label: 'พิกัด (x, y)', value: `${robot.x}, ${robot.y}` },
  ];
  return (
    <div className="resource-bar">
      {items.map((it) => (
        <div key={it.label} className="resource" title={it.label}>
          <span className="res-icon">{it.icon}</span>
          <span className="res-value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
