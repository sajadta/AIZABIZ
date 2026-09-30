import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3 my-auto max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {this.props.fallbackTitle || 'ഘടകം ലോഡ് ചെയ്യുന്നതിൽ പിശക് സംഭവിച്ചു (Display Error)'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              വിവരങ്ങൾ റെൻഡർ ചെയ്യുമ്പോൾ ഒരു തടസ്സം നേരിട്ടു. താഴെയുള്ള ബട്ടൺ ക്ലിക്ക് ചെയ്ത് വീണ്ടും ശ്രമിക്കുക.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 mx-auto active:scale-95 touch-manipulation"
          >
            <RefreshCw className="w-4 h-4" />
            <span>വീണ്ടും ശ്രമിക്കുക (Retry)</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
