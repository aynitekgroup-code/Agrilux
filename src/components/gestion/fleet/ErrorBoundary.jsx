import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Agrilux] Error de render en el reporte:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold">No se pudo mostrar este reporte</p>
            <p className="mt-1 text-xs leading-relaxed text-red-700">
              {this.props.mensaje || 'Ocurrió un error al dibujar la tabla. El resto de la página sigue disponible.'}
            </p>
            {this.state.error?.message ? (
              <p className="mt-1 break-words text-[11px] text-red-600/80">{this.state.error.message}</p>
            ) : null}
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <RotateCw size={12} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
