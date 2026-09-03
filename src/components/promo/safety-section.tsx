import { useState } from "react"
import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

const plans = [
  {
    name: "Начало",
    monthly: 0,
    yearly: 0,
    caption: "Для первых съёмок",
    features: [
      "До 15 клиентов в базе",
      "Календарь съёмок",
      "Напоминания клиенту",
      "1 галерея на сдачу одновременно",
    ],
    cta: "Начать бесплатно",
    featured: false,
  },
  {
    name: "Практика",
    monthly: 890,
    yearly: 690,
    caption: "Для постоянного потока",
    features: [
      "Клиенты и съёмки без ограничений",
      "Напоминания вам и клиенту",
      "Галереи с отбором и водяным знаком",
      "Предоплаты, счета и долги",
      "Статистика по месяцам и форматам",
    ],
    cta: "Попробовать 14 дней",
    featured: true,
  },
  {
    name: "Студия",
    monthly: 2400,
    yearly: 1900,
    caption: "Для команды фотографов",
    features: [
      "Всё из «Практики»",
      "До 8 сотрудников и ретушёров",
      "Общий календарь и распределение съёмок",
      "Отчёты по каждому фотографу",
      "Приоритетная поддержка",
    ],
    cta: "Обсудить студию",
    featured: false,
  },
]

export function SafetySection() {
  const [yearly, setYearly] = useState(true)
  const { ref, visible } = useReveal<HTMLDivElement>()

  const scrollToForm = () => {
    document.querySelector("#zayavka")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section id="tarify" className="py-28 px-5 sm:px-8 bg-background">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <div className="max-w-3xl mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary mb-5">
            Тарифы
          </p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08]">
            Дешевле одной <span className="italic text-primary">отменённой съёмки</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Без комиссии с ваших заказов и без платы за каждого клиента. Отменить можно в любой
            момент, база выгружается одним файлом.
          </p>
        </div>

        <div className="inline-flex items-center border border-border mb-12">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2.5 text-sm transition-colors ${
              !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Помесячно
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2.5 text-sm transition-colors ${
              yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            За год — выгоднее
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const price = yearly ? plan.yearly : plan.monthly
            return (
              <article
                key={plan.name}
                className={`relative flex flex-col p-8 lg:p-10 border transition-all duration-500 ${
                  plan.featured
                    ? "border-primary bg-card lg:-mt-4 lg:mb-4 shadow-2xl"
                    : "border-border bg-card/40 hover:border-foreground/25"
                } ${visible ? "fade-in" : "opacity-0"}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-8 bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground">
                    Выбирают чаще
                  </span>
                )}

                <h3 className="font-display text-3xl font-bold text-card-foreground">{plan.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.caption}</p>

                <div className="mt-7 flex items-end gap-2">
                  <span className="font-display text-5xl font-bold text-card-foreground">
                    {price === 0 ? "0" : price.toLocaleString("ru-RU")}
                  </span>
                  <span className="mb-2 text-sm text-muted-foreground">₽ / мес</span>
                </div>

                <ul className="mt-8 space-y-3.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] text-muted-foreground">
                      <Icon name="Check" size={17} className="mt-0.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={scrollToForm}
                  className={`mt-9 h-12 w-full rounded-none tracking-wide ${
                    plan.featured
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-transparent border border-border text-foreground hover:bg-secondary hover:text-secondary-foreground"
                  }`}
                >
                  {plan.cta}
                </Button>
              </article>
            )
          })}
        </div>

        <p className="mt-10 flex items-center gap-2.5 text-sm text-muted-foreground">
          <Icon name="ShieldCheck" size={16} className="text-primary" />
          Фотографии и данные клиентов хранятся в России, доступ к галереям — только по вашей ссылке.
        </p>
      </div>
    </section>
  )
}
