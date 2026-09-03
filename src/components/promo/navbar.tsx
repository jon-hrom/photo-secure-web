import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"

const links = [
  { href: "#vozmozhnosti", label: "Возможности" },
  { href: "#kak-rabotaet", label: "Как это работает" },
  { href: "#tarify", label: "Тарифы" },
  { href: "#voprosy", label: "Вопросы" },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollTo = (href: string) => {
    setIsOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 ${
        scrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-[72px]">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="flex items-center gap-2.5 group"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/60">
              <span className="h-2.5 w-2.5 rounded-full bg-primary transition-transform duration-500 group-hover:scale-125" />
            </span>
            <span className="font-display text-2xl font-bold tracking-[0.22em] text-foreground uppercase">
              Foto-Mix
            </span>
          </a>

          <div className="hidden md:flex items-center gap-9">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(link.href)
                }}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-0 after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://foto-mix.ru"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Войти
            </a>
            <Button
              asChild
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 px-6 tracking-wide"
            >
              <a href="https://foto-mix.ru">Попробовать бесплатно</a>
            </Button>
          </div>

          <button
            aria-label="Меню"
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-foreground hover:text-primary transition-colors"
          >
            <Icon name={isOpen ? "X" : "Menu"} size={24} />
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden animate-fade-in">
            <div className="py-4 space-y-1 border-t border-border">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo(link.href)
                  }}
                  className="block px-2 py-3 text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://foto-mix.ru"
                className="block px-2 py-3 text-foreground hover:text-primary transition-colors"
              >
                Войти
              </a>
              <div className="pt-3">
                <Button
                  asChild
                  className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <a href="https://foto-mix.ru">Попробовать бесплатно</a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}