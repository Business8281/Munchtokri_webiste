"use client";

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Something went wrong</h2>
                    <p style={{ color: '#475569', marginBottom: '1.5rem', maxWidth: '400px' }}>
                        We&apos;re sorry for the trouble. Please refresh the page or contact support if the problem persists.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.625rem 1.5rem',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                        }}
                    >
                        Refresh Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <details style={{ marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', maxWidth: '600px' }}>
                            <summary style={{ cursor: 'pointer' }}>Error details (dev only)</summary>
                            <pre style={{ marginTop: '0.5rem', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                                {this.state.errorMessage}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
