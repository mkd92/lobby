import React from 'react';

interface PageSkeletonProps {
  variant?: 'table' | 'cards';
  rows?: number;
  cols?: number[];  // relative widths for each column in a table row
  hasMetrics?: boolean;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  variant = 'table',
  rows = 8,
  cols = [3, 4, 3, 2, 2],
  hasMetrics = false,
}) => {
  return (
    <div className="skeleton-page">
      {/* Page header */}
      <div className="skeleton-header">
        <div>
          <div className="skeleton-block" style={{ height: '2rem', width: '200px', marginBottom: '0.625rem' }} />
          <div className="skeleton-block" style={{ height: '1rem', width: '140px' }} />
        </div>
        <div className="skeleton-block" style={{ height: '2.75rem', width: '140px', borderRadius: '1rem' }} />
      </div>

      {/* Optional metrics row */}
      {hasMetrics && (
        <div className="skeleton-metrics">
          {[120, 90, 110, 80].map((w, i) => (
            <div key={i} className="skeleton-metric-card">
              <div className="skeleton-block" style={{ height: '0.75rem', width: `${w * 0.5}px` }} />
              <div className="skeleton-block" style={{ height: '2rem', width: `${w}px` }} />
            </div>
          ))}
        </div>
      )}

      {variant === 'table' && (
        <div className="skeleton-table-wrap">
          {/* Toolbar */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '1rem' }}>
            <div className="skeleton-block" style={{ height: '2.5rem', flex: 1, borderRadius: '1rem' }} />
            <div className="skeleton-block" style={{ height: '2.5rem', width: '120px', borderRadius: '1rem' }} />
          </div>

          {/* Table header */}
          <div className="skeleton-table-header" style={{ gridTemplateColumns: cols.map(c => `${c}fr`).join(' ') }}>
            {cols.map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: '0.625rem', width: '60%' }} />
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="skeleton-row" style={{ gridTemplateColumns: cols.map(c => `${c}fr`).join(' ') }}>
              {cols.map((_c, i) => (
                <div
                  key={i}
                  className="skeleton-block"
                  style={{
                    height: i === 0 ? '1rem' : '0.75rem',
                    width: `${50 + ((r * 7 + i * 13) % 35)}%`,
                    animationDelay: `${(r * cols.length + i) * 0.03}s`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {variant === 'cards' && (
        <div className="skeleton-cards-grid">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="skeleton-block" style={{ width: '3rem', height: '3rem', borderRadius: '1rem', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block" style={{ height: '1rem', width: '70%', marginBottom: '0.5rem' }} />
                  <div className="skeleton-block" style={{ height: '0.75rem', width: '50%' }} />
                </div>
              </div>
              <div className="skeleton-block" style={{ height: '0.75rem', width: '90%', animationDelay: `${i * 0.04}s` }} />
              <div className="skeleton-block" style={{ height: '0.75rem', width: '65%', animationDelay: `${i * 0.04 + 0.02}s` }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <div className="skeleton-block" style={{ height: '1.75rem', width: '80px', borderRadius: '2rem' }} />
                <div className="skeleton-block" style={{ height: '1.75rem', width: '60px', borderRadius: '2rem' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
