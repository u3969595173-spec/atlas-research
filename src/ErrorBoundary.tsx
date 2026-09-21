import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' }

  static getDerivedStateFromError() {
    return { failed: true, message: '' }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.setState({ message: error.message })
  }

  render() {
    if (this.state.failed) {
      return <main className="app-error"><h1>No se pudo abrir este análisis</h1><p>Vuelve a cargar la página. Si continúa, el dato del partido requiere revisión.</p>{this.state.message && <code>{this.state.message}</code>}<button onClick={() => window.location.reload()}>Recargar aplicación</button></main>
    }
    return this.props.children
  }
}