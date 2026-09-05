import Icon from "@/components/ui/icon"
import { useReveal } from "@/hooks/use-reveal"

const features = [
  {
    title: "База клиентов",
    description:
      "Карточка на каждого заказчика: контакты, день рождения, вся история съёмок и заметки о том, как человек любит сниматься. Ничего не теряется между чатами.",
    icon: "Users",
    tag: "01",
  },
  {
    title: "Календарь съёмок",
    description:
      "Съёмки, выезды и встречи на одной сетке — списком, таблицей или календарём. Новую съёмку можно завести голосом: продиктуйте по дороге, карточка заполнится сама.",
    icon: "CalendarDays",
    tag: "02",
  },
  {
    title: "Напоминания обеим сторонам",
    description:
      "За сутки, за пять часов и за час до съёмки сообщение уходит и клиенту, и вам. Почта, Telegram, WhatsApp и push в браузере — выбираете, что удобнее.",
    icon: "BellRing",
    tag: "03",
  },
  {
    title: "Фотобанк без ограничений",
    description:
      "Папки и подпапки, загрузка файлами, с камеры телефона, по ссылке или прямо с Яндекс.Диска. Снимки с айфона в HEIC открываются сами, а сортировка по дате и камере — в один клик.",
    icon: "FolderTree",
    tag: "04",
  },
  {
    title: "Галерея для клиента",
    description:
      "Личная ссылка с паролем и вашим логотипом. Клиент отмечает избранное, качает архивом или к себе на Яндекс.Диск, пишет вам прямо в галерее. Вы видите, сколько раз её открыли.",
    icon: "Images",
    tag: "05",
  },
  {
    title: "Обработка и ретушь",
    description:
      "Очередь задач с прогрессом в плавающей панели: работайте дальше, пока идёт обработка. Ретушь одного кадра или всей папки разом, удаление логотипов, восстановление старых снимков.",
    icon: "Wand2",
    tag: "06",
  },
  {
    title: "Фотокниги",
    description:
      "Готовые макеты 20×20, 21×30 и 30×30. Отправляете клиенту ссылку — он сам раскладывает кадры по страницам, а вам остаётся только отправить книгу в печать.",
    icon: "BookOpen",
    tag: "07",
  },
  {
    title: "Портфолио и отзывы",
    description:
      "Публичный сайт на вашем адресе: категории съёмок, галереи работ, контакты и отзывы с оценками. Клиенту приходит напоминание оставить отзыв — репутация копится сама.",
    icon: "Star",
    tag: "08",
  },
  {
    title: "Деньги и статистика",
    description:
      "Предоплаты, остатки и долги перед глазами. Видно, сколько съёмок за месяц, какие форматы приносят больше и сколько клиентов возвращается второй раз.",
    icon: "ChartNoAxesColumn",
    tag: "09",
  },
]

export function FeaturesSection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="vozmozhnosti" className="relative py-20 sm:py-28 px-5 sm:px-8 bg-background">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <div className="max-w-3xl mb-12 sm:mb-16">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Возможности
          </p>
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08]">
            Всё, что вы держали в заметках,{" "}
            <span className="italic text-primary">чатах и голове</span>
          </h2>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Foto-Mix собирает работу фотографа в один рабочий стол — от первого сообщения клиента до
            отданной галереи, напечатанной фотокниги и закрытого счёта.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`group relative border-b border-r border-border p-7 sm:p-8 lg:p-10 transition-colors duration-500 hover:bg-card ${
                visible ? "fade-in" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 0.06}s` }}
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

export default FeaturesSection
