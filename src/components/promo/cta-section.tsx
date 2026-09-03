import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"

const FILMSTRIP =
  "https://cdn.poehali.dev/projects/62fb557a-910c-4e83-9377-00e200b50f21/files/7b3c9d4d-be7c-4122-b917-4addf3cff2b2.jpg"

const SIGNUP_URL = "https://foto-mix.ru/"

const steps = [
  {
    icon: "UserPlus",
    title: "Заведите аккаунт",
    text: "Регистрация занимает минуту: почта или вход через ВКонтакте, Яндекс и Telegram.",
  },
  {
    icon: "CalendarPlus",
    title: "Добавьте ближайшую съёмку",
    text: "Дата, клиент, адрес. Напоминания вам и заказчику включатся сами.",
  },
  {
    icon: "Images",
    title: "Отдайте фото красиво",
    text: "Загрузите кадры — клиент получит личную галерею со скачиванием в один клик.",
  },
]

export function CTASection() {
  return (
    <section
      id="zayavka"
      className="relative overflow-hidden bg-secondary text-secondary-foreground grain"
    >
      <img
        src={FILMSTRIP}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-25"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/95 to-secondary/70" />

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 sm:gap-14 lg:gap-20 items-center">
        <div>
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Первая съёмка в Foto-Mix
          </p>
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.06]">
            Заведите ближайшую съёмку — <span className="italic text-primary">остальное покажем</span>
          </h2>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-secondary-foreground/70 leading-relaxed max-w-lg">
            Регистрация бесплатная и занимает минуту. Поможем перенести базу клиентов и настроить
            напоминания под ваш формат съёмок.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              "Настройка вместе с вами за один созвон",
              "Перенос клиентов из таблицы и заметок",
              "Отменить можно в один клик, база выгружается",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-secondary-foreground/85">
                <Icon name="Check" size={18} className="text-primary shrink-0" />
                <span className="text-[15px]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-secondary-foreground/15 bg-background p-8 sm:p-10">
          <h3 className="font-display text-3xl font-bold text-foreground">Начать за три шага</h3>

          <ol className="mt-8 space-y-7">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-border text-primary">
                  <Icon name={step.icon} size={20} />
                </span>
                <div>
                  <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground/60">
                    0{index + 1}
                  </p>
                  <h4 className="mt-1 font-display text-xl font-bold text-foreground">
                    {step.title}
                  </h4>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Button
            asChild
            className="mt-9 w-full h-14 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-base tracking-wide"
          >
            <a href={SIGNUP_URL}>
              Зарегистрироваться бесплатно
              <Icon name="ArrowRight" size={18} className="ml-2" />
            </a>
          </Button>

          <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed text-center">
            Без привязки карты. Уже есть аккаунт?{" "}
            <a href={SIGNUP_URL} className="text-primary hover:underline">
              Войти
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

export default CTASection
