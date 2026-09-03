import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

const testimonials = [
  {
    name: "Ольга Терентьева",
    role: "Семейный фотограф, Казань",
    avatar: "/professional-woman-scientist.png",
    content:
      "Раньше держала съёмки в заметках и трёх чатах. Теперь клиент сам получает напоминание с адресом, а я вижу неделю целиком. За сезон ни одной путаницы с датами.",
  },
  {
    name: "Дмитрий Лавров",
    role: "Свадебный фотограф, Санкт-Петербург",
    avatar: "/cybersecurity-expert-man.jpg",
    content:
      "Галереи на отбор закрыли самую больную часть: пары отмечают кадры сами, ретушь собирается в очередь. Сдача альбома ускорилась почти вдвое.",
  },
  {
    name: "Ирина Гладкова",
    role: "Предметная съёмка, студия «Тёплый свет»",
    avatar: "/asian-woman-tech-developer.jpg",
    content:
      "Мы вчетвером в одном календаре, и наконец видно, кто чем занят. А статистика показала, что половину выручки приносит один формат — стали брать его чаще.",
  },
]

export function TestimonialsSection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="otzyvy" className="py-28 px-5 sm:px-8 bg-card border-y border-border">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <div className="max-w-3xl mb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary mb-5">
            Отзывы
          </p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-card-foreground leading-[1.08]">
            Говорят те, кто <span className="italic text-primary">снимает каждую неделю</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <figure
              key={t.name}
              className={`flex flex-col justify-between border border-border bg-background p-8 transition-colors duration-500 hover:border-primary/50 ${
                visible ? "fade-in" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              <div>
                <Icon name="Quote" size={22} className="text-primary/60" />
                <blockquote className="mt-5 font-display text-xl leading-relaxed text-foreground">
                  {t.content}
                </blockquote>
              </div>

              <figcaption className="mt-8 flex items-center gap-4 pt-6 border-t border-border">
                <Avatar className="h-11 w-11 rounded-none">
                  <AvatarImage src={t.avatar} alt={t.name} className="object-cover" />
                  <AvatarFallback className="rounded-none bg-secondary text-secondary-foreground">
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-[13px] text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
