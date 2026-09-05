import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"
import { HeroCanvasBoundary } from "@/components/promo/hero-canvas-boundary"

// 3D грузится отдельным файлом и только там, где она реально нужна:
// на телефонах и слабых машинах её вообще не скачиваем
const HeroScene = lazy(() => import("@/components/promo/hero-scene"))

const STATIC_BACKDROP =
  "h-full w-full bg-[radial-gradient(circle_at_30%_35%,hsl(8_78%_55%/0.35),transparent_60%),radial-gradient(circle_at_70%_65%,hsl(32_90%_58%/0.22),transparent_55%)]"

const stats = [
  { value: "1 400+", label: "фотографов работают в Foto-Mix" },
  { value: "6 ч", label: "экономии на организации в неделю" },
  { value: "0", label: "забытых съёмок и потерянных клиентов" },
]

/** Тяжёлую графику показываем только на просторных экранах с нормальным железом */
function canRunHeavyScene(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  if (window.matchMedia("(pointer: coarse)").matches) return false
  if (window.innerWidth < 1024) return false

  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 8) return false
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false

  return true
}

export const Hero3DWebGL = () => {
  const titleWords = ["Съёмки,", "клиенты", "и", "кадры", "—", "в", "одном", "окне"]
  const [visibleWords, setVisibleWords] = useState(0)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [showScene, setShowScene] = useState(false)
  const [sceneActive, setSceneActive] = useState(true)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (visibleWords < titleWords.length) {
      const timeout = setTimeout(() => setVisibleWords((v) => v + 1), 90)
      return () => clearTimeout(timeout)
    }
    const timeout = setTimeout(() => setSubtitleVisible(true), 200)
    return () => clearTimeout(timeout)
  }, [visibleWords, titleWords.length])

  useEffect(() => {
    setShowScene(canRunHeavyScene())
  }, [])

  // Ушли ниже первого экрана или свернули вкладку — анимация замирает,
  // чтобы не жечь процессор и батарею впустую
  useEffect(() => {
    if (!showScene) return
    const node = headerRef.current
    if (!node || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => setSceneActive(entry.isIntersecting && !document.hidden),
      { threshold: 0.05 },
    )
    observer.observe(node)

    const onVisibility = () => setSceneActive(!document.hidden)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [showScene])

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <header
      ref={headerRef}
      id="top"
      className="min-h-[100svh] bg-background relative overflow-hidden grain"
    >
      {/* Фон первого экрана */}
      <div className="absolute inset-0 z-0 opacity-70">
        {showScene ? (
          <HeroCanvasBoundary fallback={<div className={STATIC_BACKDROP} />}>
            <Suspense fallback={<div className={STATIC_BACKDROP} />}>
              <HeroScene active={sceneActive} />
            </Suspense>
          </HeroCanvasBoundary>
        ) : (
          <div className={STATIC_BACKDROP} />
        )}
      </div>

      {/* Виньетка и затемнение под текст */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-background to-transparent" />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-5 sm:px-8 pt-28 sm:pt-32 pb-20 min-h-[100svh] flex flex-col justify-center">
        <div className="max-w-4xl">
          <div
            className="inline-flex items-center gap-2.5 border border-primary/40 px-3 py-1.5 mb-7 sm:mb-8 fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.24em] text-primary">
              Рабочее место фотографа
            </span>
          </div>

          <h1 className="font-display text-[1.75rem] leading-[1.12] sm:text-6xl lg:text-8xl font-bold text-foreground">
            <span className="flex flex-wrap gap-x-2.5 sm:gap-x-4 gap-y-0.5 sm:gap-y-1">
              {titleWords.map((word, index) => (
                <span
                  key={index}
                  className={`${index < visibleWords ? "fade-in" : "opacity-0"} ${
                    word === "кадры" ? "italic text-primary" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.07}s` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p
            className={`mt-6 sm:mt-8 max-w-2xl text-base sm:text-xl leading-relaxed text-muted-foreground ${
              subtitleVisible ? "fade-in-subtitle" : "opacity-0"
            }`}
          >
            Foto-Mix ведёт вашу базу клиентов, держит календарь съёмок, сам напоминает вам и заказчику
            о встрече, отдаёт обработанные фото в личной галерее и считает, сколько вы заработали.
          </p>

          <div
            className={`mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 ${
              subtitleVisible ? "fade-in-subtitle" : "opacity-0"
            }`}
            style={{ animationDelay: "0.15s" }}
          >
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto rounded-none h-14 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 tracking-wide"
            >
              <a href="https://foto-mix.ru/">
                Начать бесплатно
                <Icon name="ArrowRight" size={18} className="ml-2" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollTo("#kak-rabotaet")}
              className="w-full sm:w-auto rounded-none h-14 px-8 text-base border-border bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground tracking-wide"
            >
              <Icon name="Play" size={16} className="mr-2" />
              Как это работает
            </Button>
          </div>

          <dl
            className={`mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl ${
              subtitleVisible ? "fade-in-subtitle" : "opacity-0"
            }`}
            style={{ animationDelay: "0.3s" }}
          >
            {stats.map((s) => (
              <div key={s.label} className="border-l border-border pl-4">
                <dt className="font-display text-3xl sm:text-4xl font-bold text-foreground">
                  {s.value}
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground leading-snug">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center gap-2 text-muted-foreground">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Листайте</span>
        <Icon name="ChevronDown" size={16} className="animate-bounce" />
      </div>
    </header>
  )
}

export default Hero3DWebGL
