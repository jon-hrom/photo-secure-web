import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

const PORTRAIT =
  "https://cdn.poehali.dev/projects/62fb557a-910c-4e83-9377-00e200b50f21/files/4a75b311-d920-4833-a8b5-372cd6b88bf6.jpg"

const points = [
  {
    icon: "Clock",
    title: "Шесть часов в неделю обратно",
    text: "Столько уходило на переписки, сверку дат и поиск нужного файла. Теперь это делает Foto-Mix.",
  },
  {
    icon: "ShieldCheck",
    title: "Ни одной потерянной съёмки",
    text: "Все договорённости в карточке заказа, а не в трёх мессенджерах и блокноте на кухне.",
  },
  {
    icon: "Sparkles",
    title: "Больше времени на кадр",
    text: "Организация уходит на второй план, и остаётся то, ради чего вы взяли камеру.",
  },
]

export function AboutSection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="o-nas" className="py-20 sm:py-28 px-5 sm:px-8 bg-card border-y border-border">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 sm:gap-14 lg:gap-20 items-center" ref={ref}>
        <div className={`relative ${visible ? "fade-in" : "opacity-0"}`}>
          <div className="frame-corners">
            <img
              src={PORTRAIT}
              alt="Фотограф обрабатывает кадры за рабочим столом"
              className="w-full aspect-[4/5] object-cover"
              loading="lazy"
            />
          </div>
          <div className="absolute -bottom-8 -right-2 sm:right-6 bg-background border border-border p-6 max-w-[15rem] shadow-2xl">
            <p className="font-display text-5xl font-bold text-primary leading-none">92%</p>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">
              фотографов в Foto-Mix перестают вести съёмки в заметках уже в первый месяц
            </p>
          </div>
        </div>

        <div className={visible ? "fade-in" : "opacity-0"} style={{ animationDelay: "0.15s" }}>
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Зачем это нужно
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-card-foreground leading-[1.08]">
            Вы фотограф, <span className="italic text-primary">а не администратор</span>
          </h2>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Съёмок становится больше, и вместе с ними растёт хвост из переписок, дат, предоплат и
            вечного «а вы точно завтра приедете?». Foto-Mix забирает эту часть работы на себя.
          </p>

          <div className="mt-10 space-y-8">
            {points.map((p) => (
              <div key={p.title} className="flex gap-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/40 text-primary">
                  <Icon name={p.icon} size={20} />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-card-foreground">{p.title}</h3>
                  <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">
                    {p.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
