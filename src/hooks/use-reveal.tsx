import { useEffect, useRef, useState } from "react"

/**
 * Показывает элемент, когда он впервые попадает во вьюпорт.
 * Возвращает ref для контейнера и флаг видимости.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold, rootMargin: "0px 0px -60px 0px" },
    )

    observer.observe(node)

    // Страховка: контент не должен остаться невидимым ни при каких условиях
    const failsafe = window.setTimeout(() => setVisible(true), 2500)

    return () => {
      observer.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [threshold])

  return { ref, visible }
}

export default useReveal