import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  sectionName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[FoodLink ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const section = this.props.sectionName || 'this section';
      const title = this.props.fallbackTitle || `Unable to load ${section}`;
      const message =
        this.props.fallbackMessage ||
        'We ran into an unexpected problem while displaying this page. Your saved food donations and account data are safe.';

      return (
        <div className="min-h-[380px] w-full flex items-center justify-center p-6 my-6">
          <div className="max-w-lg w-full bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#1E5C38] rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#EAF3EC] dark:bg-[#134025] flex items-center justify-center text-[#2E7D4F] dark:text-[#34D399]">
              <span className="material-symbols-outlined text-3xl">emergency_home</span>
            </div>

            <h2 className="font-serif text-2xl font-bold text-[#1E2A22] dark:text-[#ECFDF5] mb-2">
              {title}
            </h2>

            <p className="text-sm sm:text-base text-[#4A5D50] dark:text-[#9CA3AF] mb-6 leading-relaxed">
              {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                Try again
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#1E5C38] text-[#1E2A22] dark:text-[#ECFDF5] hover:bg-[#EAF3EC] dark:hover:bg-[#134025] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">home</span>
                Return home
              </button>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mt-6 text-left border-t border-[#D9E2DA] dark:border-[#1E5C38] pt-4">
                <summary className="text-xs text-[#6B7280] dark:text-[#9CA3AF] cursor-pointer hover:underline font-mono">
                  Technical error details
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
