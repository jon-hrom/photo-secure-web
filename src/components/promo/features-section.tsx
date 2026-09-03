import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

const features = [
  {
    title: "База клиентов",
    description:
      "Карточка на каждого заказчика: контакты, все прошлые съёмки, договорённости по свету и позам, предпочтения по обработке и история платежей.",
    icon: "Users",
    tag: "01",
  },
  {
    title: "Календарь съёмок",
    description:
      "Съёмки, выезды и слоты в студии на одной сетке. Foto-Mix сам подсветит накладки и подскажет, влезает ли дорога между двумя адресами.",
    icon: "CalendarDays",
    tag: "02",
  },
  {
    title: "Напоминания обеим сторонам",
    description:
      "За сутки и за два часа клиент получает сообщение с адресом и временем, а вы — список того, что нужно взять с собой. Никто не забывает.",
    icon: "BellRing",
    tag: "03",
  },
  {
    title: "Сдача обработки",
    description:
      "Загружаете отобранные кадры — клиент видит личную галерею, отмечает избранное и скачивает оригиналы. Ретушь по отмеченным падает вам в задачи.",
    icon: "Images",
    tag: "04",
  },
  {
    title: "Деньги и предоплаты",
    description:
      "Предоплата, остаток, допы за дополнительные кадры. Видно, кто ещё не заплатил, и сколько студия заработала за месяц и за сезон.",
    icon: "Wallet",
    tag: "05",
  },
  {
    title: "Статистика студии",
    description:
      "Сколько съёмок в месяц, какие форматы приносят больше, откуда приходят клиенты и сколько из них возвращаются на второй раз.",
    icon: "ChartNoAxesColumn",
    tag: "06",
  },
]

export function FeaturesSection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="vozmozhnosti" className="relative py-20 sm:py-28 px-5 sm:px-8 bg-background">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <div className="max-w-3xl mb-16">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Возможности
          </p>
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08]">
            Всё, что вы держали в заметках,{" "}
            <span className="italic text-primary">чатах и голове</span>
          </h2>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Foto-Mix собирает рутину фотографа в один рабочий стол — от первого сообщения клиента до
            отданной галереи и закрытого счёта.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`group relative border-b border-r border-border p-8 lg:p-10 transition-colors duration-500 hover:bg-card ${
                visible ? "fade-in" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <span className="absolute top-6 right-7 font-mono text-[11px] tracking-[0.2em] text-muted-foreground/50">
                {feature.tag}
              </span>

              <span className="flex h-12 w-12 items-center justify-center border border-border text-primary transition-all duration-500 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon name={feature.icon} size={22} />
              </span>

              <h3 className="mt-7 font-display text-2xl font-bold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
