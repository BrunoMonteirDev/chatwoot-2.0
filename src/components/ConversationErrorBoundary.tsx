import React, { type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  isDarkMode: boolean;
};

type State = { hasError: boolean };

// A malformed attachment or an unsupported browser media event must never
// unmount the whole application. Keep the conversation list usable so the
// agent can select another conversation or retry only this panel.
export class ConversationErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro ao renderizar a conversa.', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`h-full flex items-center justify-center p-8 text-center ${this.props.isDarkMode ? 'bg-[#0b141a] text-[#8696a0]' : 'bg-[#f0f2f5] text-[#667781]'}`}>
          <div>
            <p className="text-sm">Não foi possível exibir esta conversa.</p>
            <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-3 text-sm text-[#00a884] hover:underline">
              Tentar abrir novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
