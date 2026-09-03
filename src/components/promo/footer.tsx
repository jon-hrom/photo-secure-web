import Icon from "@/components/ui/icon"

const columns = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "#vozmozhnosti" },
      { label: "Как это работает", href: "#kak-rabotaet" },
      { label: "Путь съёмки", href: "#put-klienta" },
      { label: "Тарифы", href: "#tarify" },
      { label: "Вход в систему", href: "https://foto-mix.ru", external: true },
    ],
  },
  {
    title: "Помощь",
    links: [
      { label: "Частые вопросы", href: "#voprosy" },
      { label: "Отзывы фотографов", href: "#otzyvy" },
      { label: "Перенос базы клиентов", href: "#zayavka" },
      { label: "Связаться с нами", href: "#zayavka" },
    ],
  },
]

const socials = [
  { icon: "Send", label: "Telegram" },
  { icon: "Mail", label: "Почта" },
  { icon: "Instagram", label: "Instagram" },
]

export function Footer() {
  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/60">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <span className="font-display text-2xl font-bold tracking-[0.22em] text-foreground uppercase">
                Foto-Mix
              </span>
            </div>
            <p className="mt-5 max-w-sm text-[15px] text-muted-foreground leading-relaxed">
              Рабочее место фотографа: клиенты, съёмки, напоминания, сдача обработки и статистика
              студии в одном окне.
            </p>
            <div className="mt-7 flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#zayavka"
                  aria-label={s.label}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo("#zayavka")
                  }}
                  className="flex h-10 w-10 items-center justify-center border border-border text-muted-foreground transition-colors duration-300 hover:border-primary hover:text-primary"
                >
                  <Icon name={s.icon} size={18} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground mb-5">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        if ("external" in link && link.external) return
                        e.preventDefault()
                        scrollTo(link.href)
                      }}
                      className="text-[15px] text-foreground/80 hover:text-primary transition-colors duration-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-mono text-[12px] text-muted-foreground">
            © 2026 Foto-Mix. Сделано фотографами для фотографов.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { label: "Конфиденциальность", href: "https://foto-mix.ru/privacy-policy" },
              { label: "Условия", href: "https://foto-mix.ru/offer" },
              { label: "Обработка данных", href: "https://foto-mix.ru/personal-data" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="font-mono text-[12px] text-muted-foreground hover:text-primary transition-colors duration-300"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}