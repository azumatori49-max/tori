import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 詳細なスタックを画面にも出す
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen overflow-y-auto bg-bg p-4 text-text">
        <div className="mx-auto w-full max-w-app space-y-3">
          <h1 className="text-base font-black text-ng">アプリの初期化でエラーが発生しました</h1>
          <p className="text-xs text-text-muted">
            この内容をスクリーンショットして開発者にお知らせください。
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-[11px] leading-relaxed text-ng">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack ?? '(no stack)'}
          </pre>
          {this.state.info?.componentStack && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-[10px] leading-relaxed text-text-muted">
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white"
          >
            再読み込み
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.clear();
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            className="w-full rounded-xl border border-border bg-surface py-3 text-xs font-bold text-text-muted"
          >
            保存データを消してリロード
          </button>
        </div>
      </div>
    );
  }
}
