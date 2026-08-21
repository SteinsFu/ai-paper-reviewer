import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ErrorState } from "./ErrorState";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render-time crashes below it so a single broken screen doesn't blank
    the whole app. Resetting clears the error and re-mounts the subtree. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // in a real backend build this would report to the error service
    console.error("Margin crashed:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="screen-scroll scroll">
          <ErrorState
            title="This view hit a snag"
            message="An unexpected error interrupted the page. Reloading the view usually clears it."
            onRetry={this.reset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
