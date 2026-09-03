import React from "react"

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Если WebGL недоступен или текстуры не загрузились,
 * герой не должен ронять всю страницу — показываем тёплую заливку.
 */
export class HeroCanvasBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch() {
    // тихо деградируем до статичного фона
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_35%,hsl(8_78%_55%/0.35),transparent_60%),radial-gradient(circle_at_70%_65%,hsl(32_90%_58%/0.22),transparent_55%)]" />
        )
      )
    }
    return this.props.children
  }
}

export default HeroCanvasBoundary
