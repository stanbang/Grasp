import { Component, type ReactNode } from 'react';

export class ExplorerBoundary extends Component<{ children: ReactNode; onReturn: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="board-empty" role="alert">
      <h2>3D could not start</h2>
      <p>The canvas is still available in 2D.</p>
      <button type="button" onClick={this.props.onReturn}>Open 2D canvas</button>
    </div>;
  }
}
