'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
          <div className="max-w-xl w-full bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text text-transparent mb-4">
              System Interface Error
            </h2>
            <p className="text-gray-400 mb-6">
              The application encountered an unexpected runtime error. Our fail-safes have prevented a complete crash.
            </p>
            <div className="bg-black/50 rounded-xl p-4 font-mono text-sm text-red-300 overflow-x-auto mb-6">
              {this.state.error?.message || 'Unknown Error'}
            </div>
            <button
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors border border-white/5"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Attempt Recovery
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
