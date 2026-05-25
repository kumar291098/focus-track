import { Component, type ErrorInfo, type ReactNode } from "react";
import LoadingScreen from "./LoadingScreen";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FocusTrack renderer crashed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <LoadingScreen
          title="FocusTrack needs a quick restart"
          message={this.state.error.message}
          tone="error"
        />
      );
    }

    return this.props.children;
  }
}
