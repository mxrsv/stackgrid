import { Component, type ComponentChildren } from "preact";

type Props = { children: ComponentChildren };
type State = { error: Error | null };

/**
 * Root-level render-error boundary. Without this, any uncaught error thrown
 * during render/effects anywhere in the tree white-screens the whole app
 * with zero recovery UI and — in a packaged Tauri build with no devtools
 * open — zero visible diagnostics either. This is the last line of defense;
 * it does not replace local error handling (PersistErrorBar, in-pane error
 * lines, etc.), it only guarantees render crashes never escape unseen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown): void {
    console.error("[error-boundary] Uncaught render error:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <div class="crash-boundary">
        <div class="crash-boundary__card">
          <p class="crash-boundary__eyebrow">Stackgrid gặp lỗi</p>
          <h1>Đã có lỗi không mong muốn xảy ra</h1>
          <p class="crash-boundary__detail">{error.message}</p>
          <button
            class="btn-reset"
            onClick={() => this.setState({ error: null })}
          >
            Thử tải lại giao diện
          </button>
        </div>
      </div>
    );
  }
}
