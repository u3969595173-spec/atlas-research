import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The UI below keeps a cloud-data failure from becoming a blank page.
  }

  render() {
    if (this.state.failed) {
      return <main className="app-error"><h1>No se pudo abrir este análisis</h1><p>Vuelve a cargar la página. Si continúa, el dato del partido requiere revisión.</p><button onClick={() => window.location.reload()}>Recargar aplicación</button></main>
    }
    return this.props.children
  }
}