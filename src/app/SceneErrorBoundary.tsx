import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="scene-error panel" role="alert">
        <p>The hall's magic fizzled out.</p>
        <button type="button" className="accio" onClick={this.retry}>
          Try again
        </button>
      </div>
    );
  }
}
