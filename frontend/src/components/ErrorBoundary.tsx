import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

// We assume the agent might be initialized globally or we instance it here if strictly needed,
// but usually the interaction is via window.newrelic if injected, or using the helper.
// The @newrelic/browser-agent package allows direct import.

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        // Send to New Relic if available
        // We can use the global newrelic object if the snippet was loaded, or check our instance logic.
        // Since we installed the npm package, we can technically import it, but the Agent instance is better.
        // For simplicity, we assume window.newrelic might be available OR we rely on automatic capture 
        // if the agent was initialized effectively.
        // Explicit noticeError:
        if (typeof window !== 'undefined' && window.newrelic) {
            window.newrelic.noticeError(error, {
                componentStack: errorInfo.componentStack
            });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h2>
                    <p className="text-gray-600">We have been notified and are working on the fix.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
