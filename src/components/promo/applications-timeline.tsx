import { Timeline } from "@/components/ui/timeline"
import Icon from "@/components/ui/icon"

const steps = [
  {
    title: "Заявка",
    lead: "Клиент написал — Foto-Mix сразу заводит карточку. Больше не нужно вспоминать, кому вы обещали субботнее утро.",
    points: [
      "Форма записи на сайте и в соцсетях ведёт прямо в базу",
      "Автоответ с форматами съёмок и ценами",
      "Виден источник: рекомендация, Instagram, поиск",
    ],
  },
  {
    title: "Съёмка",
    lead: "Дата закреплена, предоплата отмечена, напоминания уйдут сами. Вам остаётся приехать и снимать.",
    points: [
      "Слот в календаре с адресом и длительностью",
      "Чек-лист техники под конкретный формат",
      "Напоминание клиенту за сутки и за два часа",
    ],
  },
  {
    title: "Обработка",
    lead: "Кадры загружены, клиент отметил любимые, очередь ретуши собралась сама и держит вас в графике.",
    points: [
      "Личная галерея для отбора без мессенджеров",
      "Срок сдачи на виду, дедлайн не подкрадывается",
      "Отметки: что снято, что отобрано, что готово",
    ],
  },
  {
    title: "Сдача и возврат",
    lead: "Галерея отдана, остаток оплачен, а через полгода Foto-Mix напомнит написать клиенту снова.",
    points: [
      "Скачивание оригиналов по личной ссылке",
      "Закрытие счёта и запрос отзыва",
      "Напоминание о повторной съёмке через выбранный срок",
    ],
  },
]

export function ApplicationsTimeline() {
  const data = steps.map((step) => ({
    title: step.title,
    content: (
      <div>
        <p className="text-foreground text-base md:text-lg font-normal mb-7 leading-relaxed max-w-xl">
          {step.lead}
        </p>
        <div className="space-y-4">
          {step.points.map((p) => (
            <div key={p} className="flex items-start gap-3 text-muted-foreground text-[15px]">
              <Icon name="CornerDownRight" size={16} className="mt-1 shrink-0 text-primary" />
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  }))

  return (
    <section id="put-klienta" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-3xl mb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary mb-5">
            Путь съёмки
          </p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08]">
            От первого сообщения до <span className="italic text-primary">отданных кадров</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Foto-Mix ведёт каждую съёмку по одному и тому же понятному маршруту — вы всегда знаете, на
            каком этапе находится любой заказ.
          </p>
        </div>

        <Timeline data={data} />
      </div>
    </section>
  )
}
