import React from 'react';

interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', gap: '1rem',
          padding: '2rem', textAlign: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>
            error
          </span>
          <h2 style={{ fontWeight: 800, fontSize: '1.25rem', opacity: 0.7 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.8125rem', opacity: 0.4, maxWidth: '360px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="primary-button"
            style={{ marginTop: '0.5rem' }}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
          >
            Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
