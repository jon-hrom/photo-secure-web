import { useState } from "react"
import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

type Tab = {
  id: string
  label: string
  icon: string
  headline: string
  text: string
  bullets: string[]
  panel: { caption: string; rows: { primary: string; secondary: string; badge: string }[] }
}

const tabs: Tab[] = [
  {
    id: "klienty",
    label: "Клиенты",
    icon: "Users",
    headline: "Клиент не теряется между мессенджерами",
    text: "Каждый заказчик — одна карточка. Видно, о чём договорились, что снимали в прошлый раз и когда пора написать снова.",
    bullets: [
      "История съёмок и любимые кадры клиента",
      "Заметки: свет, ракурсы, чего просили избегать",
      "Метка «пора написать» для повторных съёмок",
    ],
    panel: {
      caption: "База клиентов",
      rows: [
        { primary: "Мария Ковалёва", secondary: "Семейная · 3 съёмки", badge: "Постоянная" },
        { primary: "Артём Соловьёв", secondary: "Портфолио · 1 съёмка", badge: "Новый" },
        { primary: "Ирина Гладкова", secondary: "Предметная · 12 съёмок", badge: "Договор" },
      ],
    },
  },
  {
    id: "raspisanie",
    label: "Расписание",
    icon: "CalendarDays",
    headline: "Съёмочная неделя видна целиком",
    text: "Слоты, выезды, окна на обработку. Foto-Mix не даст поставить две съёмки на одно время и учтёт дорогу между локациями.",
    bullets: [
      "Проверка накладок и запаса на дорогу",
      "Блоки под обработку прямо в календаре",
      "Синхронизация с личным календарём телефона",
    ],
    panel: {
      caption: "Ближайшие дни",
      rows: [
        { primary: "Пт, 10:00 — Лофт «Депо»", secondary: "Лавстори · 2 часа", badge: "Оплачено" },
        { primary: "Сб, 14:30 — Парк Горького", secondary: "Семейная · 1,5 часа", badge: "Предоплата" },
        { primary: "Вс, 12:00 — Съёмный зал", secondary: "Предметка · 40 кадров", badge: "Счёт" },
      ],
    },
  },
  {
    id: "uvedomleniya",
    label: "Напоминания",
    icon: "BellRing",
    headline: "Напоминает и вам, и клиенту",
    text: "Автоматические сообщения приходят обеим сторонам: заказчику — адрес и время, вам — чек-лист техники и деталей съёмки.",
    bullets: [
      "За сутки и за два часа до съёмки",
      "Шаблоны сообщений под каждый формат",
      "Тихий режим: ничего не уходит ночью",
    ],
    panel: {
      caption: "Отправлено сегодня",
      rows: [
        { primary: "Мария К. — напоминание", secondary: "Завтра 10:00, лофт «Депо»", badge: "Доставлено" },
        { primary: "Вам — чек-лист", secondary: "Второй свет, 85 мм, запасные карты", badge: "Прочитано" },
        { primary: "Артём С. — галерея готова", secondary: "48 кадров, ссылка на месяц", badge: "Открыто" },
      ],
    },
  },
  {
    id: "obrabotka",
    label: "Обработка",
    icon: "Images",
    headline: "От отбора до отданной галереи",
    text: "Клиент отмечает кадры в личной галерее, отмеченные автоматически попадают к вам в очередь ретуши. Готовое — скачивается в оригинале.",
    bullets: [
      "Личная ссылка-галерея с вашим именем",
      "Очередь ретуши по отмеченным кадрам",
      "Водяной знак до оплаты, оригиналы после",
    ],
    panel: {
      caption: "Очередь обработки",
      rows: [
        { primary: "Лавстори · Мария К.", secondary: "12 из 20 кадров готовы", badge: "В работе" },
        { primary: "Предметка · «Тёплый свет»", secondary: "40 кадров, отбор клиента", badge: "Ждёт" },
        { primary: "Портфолио · Артём С.", secondary: "Галерея отдана 2 дня назад", badge: "Сдано" },
      ],
    },
  },
]

export function TechnologySection() {
  const [active, setActive] = useState(tabs[0].id)
  const { ref, visible } = useReveal<HTMLDivElement>()
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <section id="kak-rabotaet" className="relative py-20 sm:py-28 px-5 sm:px-8 bg-card border-y border-border">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <div className="max-w-3xl mb-14">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Как это работает
          </p>
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-card-foreground leading-[1.08]">
            Четыре экрана, в которых <span className="italic text-primary">живёт ваша работа</span>
          </h2>
        </div>

        <div
          className={`flex flex-wrap gap-2 mb-10 ${visible ? "fade-in" : "opacity-0"}`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm border transition-all duration-300 ${
                active === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-card-foreground hover:border-card-foreground/40"
              }`}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div key={current.id} className="animate-fade-in">
            <h3 className="font-display text-3xl sm:text-4xl font-bold text-card-foreground leading-tight">
              {current.headline}
            </h3>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{current.text}</p>
            <ul className="mt-8 space-y-4">
              {current.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-card-foreground">
                  <Icon name="Check" size={18} className="mt-1 shrink-0 text-primary" />
                  <span className="text-[15px] leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div key={`${current.id}-panel`} className="animate-scale-in">
            <div className="frame-corners border border-border bg-background p-6 sm:p-8">
              <div className="flex items-center justify-between pb-5 border-b border-border">
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {current.panel.caption}
                </span>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  <span className="h-2 w-2 rounded-full bg-accent/70" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                </div>
              </div>

              <ul className="divide-y divide-border">
                {current.panel.rows.map((row, i) => (
                  <li
                    key={row.primary}
                    className="flex items-center justify-between gap-4 py-5 fade-in"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-foreground truncate">
                        {row.primary}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground truncate">
                        {row.secondary}
                      </p>
                    </div>
                    <span className="shrink-0 border border-primary/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                      {row.badge}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
