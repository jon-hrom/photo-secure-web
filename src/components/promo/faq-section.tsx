import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useReveal } from "@/hooks/use-reveal"

const faqs = [
  {
    question: "Нужно ли переносить старую базу вручную?",
    answer:
      "Нет. Клиентов можно загрузить таблицей из Excel или Google Таблиц — Foto-Mix сам разложит имена, телефоны и даты прошлых съёмок по карточкам. Если базы не было, начнёте с чистого листа: карточка заводится за полминуты.",
  },
  {
    question: "Как именно приходят напоминания клиенту?",
    answer:
      "Сообщением в мессенджер или на почту — вы выбираете канал и шаблон текста. По умолчанию клиент получает напоминание за сутки и за два часа до съёмки: время, адрес, что взять с собой. Вы в этот же момент получаете свой чек-лист.",
  },
  {
    question: "Где хранятся фотографии и кто их видит?",
    answer:
      "Файлы лежат на серверах в России. Галерея открывается только по личной ссылке, которую вы отправляете клиенту, и её можно закрыть в любой момент. До оплаты кадры показываются с водяным знаком, после — скачиваются в оригинале.",
  },
  {
    question: "А если мне помогает ретушёр или ассистент?",
    answer:
      "Можно дать помощнику доступ в ваш аккаунт и настроить, что именно он видит: например, только очередь ретуши, без денег и контактов клиентов. Календарь и база остаются вашими.",
  },
  {
    question: "Что будет с данными, если я перестану платить?",
    answer:
      "База и съёмки остаются доступными для просмотра и выгрузки. Клиентов, съёмки и суммы можно скачать одним файлом в любой момент — мы не запираем ваши данные внутри сервиса.",
  },
  {
    question: "Есть ли мобильная версия?",
    answer:
      "Foto-Mix открывается в браузере телефона и работает как приложение: календарь, карточка клиента и загрузка кадров доступны прямо со съёмки. Отдельно ставить ничего не нужно.",
  },
]

export function FAQSection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="voprosy" className="py-20 sm:py-28 px-5 sm:px-8 bg-background">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-20" ref={ref}>
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-primary mb-5">
            Вопросы
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-foreground leading-[1.08]">
            Отвечаем <span className="italic text-primary">до того, как спросите</span>
          </h2>
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Если чего-то не хватает — напишите, разберёмся вместе и подскажем, как перенести вашу
            текущую работу в Foto-Mix.
          </p>
        </div>

        <div className={visible ? "fade-in" : "opacity-0"}>
          <Accordion type="single" collapsible className="w-full border-t border-border">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-border">
                <AccordionTrigger className="text-left font-display text-xl sm:text-2xl font-bold text-foreground hover:text-primary hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-7 pr-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
