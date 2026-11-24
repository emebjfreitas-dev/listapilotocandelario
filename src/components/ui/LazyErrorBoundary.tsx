import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface LazyErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string | number | boolean | null;
  mode?: 'screen' | 'modal';
  onDismiss?: () => void;
}

interface LazyErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class LazyErrorBoundary extends React.Component<
  LazyErrorBoundaryProps,
  LazyErrorBoundaryState
> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): LazyErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível carregar este módulo no momento.';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidUpdate(prevProps: LazyErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isModal = this.props.mode === 'modal';

    const card = (
      <div
        role="alert"
        className="w-full max-w-md mx-auto bg-white text-slate-950 rounded-3xl p-6 sm:p-7 shadow-[0_18px_48px_-12px_rgba(4,9,20,0.45)] flex flex-col items-center text-center gap-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#b45309] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-950">
            Falha ao carregar este módulo
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            A conexão oscilou ou o aplicativo foi atualizado em segundo plano. Tente carregar novamente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full pt-1">
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#0f3370] hover:bg-[#1649a8] text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Tentar novamente</span>
          </button>

          <button
            type="button"
            onClick={this.handleReload}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#eef3f9] hover:bg-[#dfe8f4] text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Atualizar página</span>
          </button>
        </div>

        {isModal && this.props.onDismiss && (
          <button
            type="button"
            onClick={this.props.onDismiss}
            className="text-xs font-semibold text-slate-700 hover:text-slate-950 px-3 py-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            Fechar janela
          </button>
        )}
      </div>
    );

    if (isModal) {
      return (
        <div className="fixed inset-0 z-50 bg-[#040914]/75 backdrop-blur-xs flex items-center justify-center p-4">
          {card}
        </div>
      );
    }

    return <div className="w-full py-10 px-4 flex items-center justify-center">{card}</div>;
  }
}
