import { useEffect } from "react"
import { Hero3DWebGL as Hero3D } from "@/components/promo/hero-webgl"
import { FeaturesSection } from "@/components/promo/features-section"
import { TechnologySection } from "@/components/promo/technology-section"
import { ApplicationsTimeline } from "@/components/promo/applications-timeline"
import { AboutSection } from "@/components/promo/about-section"
import { SafetySection } from "@/components/promo/safety-section"
import { TestimonialsSection } from "@/components/promo/testimonials-section"
import { FAQSection } from "@/components/promo/faq-section"
import { CTASection } from "@/components/promo/cta-section"
import { Navbar } from "@/components/promo/navbar"
import { Footer } from "@/components/promo/footer"
import "@/styles/promo.css"

export default function PromoLanding() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = "Foto-Mix — рабочее место фотографа"

    const meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute("content") || ""
    meta?.setAttribute(
      "content",
      "Foto-Mix ведёт базу клиентов, календарь съёмок, напоминания и отдачу готовых фото в личной галерее. Регистрация бесплатно.",
    )

    return () => {
      document.title = prevTitle
      meta?.setAttribute("content", prevDesc)
    }
  }, [])

  return (
    <div className="promo-landing dark min-h-screen">
      <Navbar />
      <main>
        <Hero3D />
        <FeaturesSection />
        <TechnologySection />
        <ApplicationsTimeline />
        <AboutSection />
        <SafetySection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
