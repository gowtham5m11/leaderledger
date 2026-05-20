import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error && 
        (this.state.error.name === 'ChunkLoadError' ||
         /loading\s+chunk/i.test(this.state.error.message || '') ||
         /failed\s+to\s+fetch\s+dynamically/i.test(this.state.error.message || ''));

      return (
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--on-surface)'
          }}
        >
          <div 
            className="glass-panel" 
            style={{
              maxWidth: '480px',
              padding: '3rem',
              borderRadius: '2rem',
              border: '1px solid var(--outline-variant)',
              boxShadow: 'var(--shadow-3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem'
            }}
          >
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--error-container, #ffebee)',
                color: 'var(--error, #ba1a1a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
                {isChunkError ? 'wifi_off' : 'warning'}
              </span>
            </div>

            <h2 className="headline-sm" style={{ fontWeight: 700 }}>
              {isChunkError ? 'Network Connection Error' : 'Something went wrong'}
            </h2>

            <p className="body-md text-on-surface-variant" style={{ margin: 0, opacity: 0.85, lineHeight: 1.6 }}>
              {isChunkError 
                ? 'We had trouble loading a part of the application. This can happen due to a temporary network disruption or an ad-blocker blocking a module.'
                : 'An unexpected error occurred while loading this page. Please try refreshing or returning to the home map.'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%' }}>
              <button
                type="button"
                className="news-cta-btn"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
                Reload Page
              </button>
              
              {!isChunkError && (
                <button
                  type="button"
                  className="news-filter-clear"
                  onClick={this.handleGoHome}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    borderColor: 'var(--outline)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
                  Go to Map
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
