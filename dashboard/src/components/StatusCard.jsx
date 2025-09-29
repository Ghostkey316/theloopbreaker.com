import React from 'react';

export default function StatusCard({ title, value, description }) {
  return (
    <article className="card">
      <header>
        <h3>{title}</h3>
        <span className="value">{value}</span>
      </header>
      <p>{description}</p>
    </article>
  );
}
