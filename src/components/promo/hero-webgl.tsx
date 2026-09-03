import { Canvas, extend, useFrame } from "@react-three/fiber"
import { useAspect, useTexture } from "@react-three/drei"
import { useMemo, useRef, useState, useEffect, Suspense } from "react"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"
import { HeroCanvasBoundary } from "@/components/promo/hero-canvas-boundary"

const TEXTUREMAP = { src: "https://i.postimg.cc/XYwvXN8D/img-4.png" }
const DEPTHMAP = { src: "https://i.postimg.cc/2SHKQh2q/raw-4.webp" }

extend(THREE as unknown as Record<string, unknown>)

const WIDTH = 300
const HEIGHT = 300

const Scene = () => {
  const [rawMap, depthMap] = useTexture([TEXTUREMAP.src, DEPTHMAP.src])
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      uniform sampler2D uTexture;
      uniform sampler2D uDepthMap;
      uniform vec2 uPointer;
      uniform float uProgress;
      uniform float uTime;
      varying vec2 vUv;

      // Simple noise function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 uv = vUv;

        // Depth-based displacement
        float depth = texture2D(uDepthMap, uv).r;
        vec2 displacement = depth * uPointer * 0.01;
        vec2 distortedUv = uv + displacement;

        // Base texture
        vec4 baseColor = texture2D(uTexture, distortedUv);

        // Create scanning effect
        float aspect = ${WIDTH}.0 / ${HEIGHT}.0;
        vec2 tUv = vec2(uv.x * aspect, uv.y);
        vec2 tiling = vec2(120.0);
        vec2 tiledUv = mod(tUv * tiling, 2.0) - 1.0;

        float brightness = noise(tUv * tiling * 0.5);
        float dist = length(tiledUv);
        float dot = smoothstep(0.5, 0.49, dist) * brightness;

        // Flow effect based on progress
        float flow = 1.0 - smoothstep(0.0, 0.02, abs(depth - uProgress));

        // Тёплый «проявочный» скан: киноварь + янтарь
        vec3 warm = mix(vec3(0.88, 0.22, 0.12), vec3(0.96, 0.62, 0.18), 0.5 + 0.5 * sin(uTime * 0.4));
        vec3 mask = warm * dot * flow * 9.0;

        // Combine effects
        vec3 final = baseColor.rgb * vec3(1.0, 0.94, 0.88) + mask;

        gl_FragColor = vec4(final, 1.0);
      }
    `

    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: rawMap },
        uDepthMap: { value: depthMap },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    })
  }, [rawMap, depthMap])

  const [w, h] = useAspect(WIDTH, HEIGHT)

  useFrame(({ clock, pointer }) => {
    if (material.uniforms) {
      material.uniforms.uProgress.value = Math.sin(clock.getElapsedTime() * 0.5) * 0.5 + 0.5
      material.uniforms.uPointer.value = pointer
      material.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  const scaleFactor = 0.3
  return (
    <mesh ref={meshRef} scale={[w * scaleFactor, h * scaleFactor, 1]} material={material}>
      <planeGeometry />
    </mesh>
  )
}

const stats = [
  { value: "1 400+", label: "фотографов работают в Foto-Mix" },
  { value: "6 ч", label: "экономии на организации в неделю" },
  { value: "0", label: "забытых съёмок и потерянных клиентов" },
]

export const Hero3DWebGL = () => {
  const titleWords = ["Съёмки,", "клиенты", "и", "кадры", "—", "в", "одном", "окне"]
  const [visibleWords, setVisibleWords] = useState(0)
  const [subtitleVisible, setSubtitleVisible] = useState(false)

  useEffect(() => {
    if (visibleWords < titleWords.length) {
      const timeout = setTimeout(() => setVisibleWords((v) => v + 1), 90)
      return () => clearTimeout(timeout)
    }
    const timeout = setTimeout(() => setSubtitleVisible(true), 200)
    return () => clearTimeout(timeout)
  }, [visibleWords, titleWords.length])

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <header id="top" className="min-h-screen bg-background relative overflow-hidden grain">
      {/* WebGL-подложка */}
      <div className="absolute inset-0 z-0 opacity-70">
        <HeroCanvasBoundary>
          <Suspense
            fallback={
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_35%,hsl(8_78%_55%/0.35),transparent_60%),radial-gradient(circle_at_70%_65%,hsl(32_90%_58%/0.22),transparent_55%)]" />
            }
          >
            <Canvas
              flat
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              camera={{ position: [0, 0, 1] }}
              style={{ background: "hsl(20 12% 4%)" }}
            >
              <Scene />
            </Canvas>
          </Suspense>
        </HeroCanvasBoundary>
      </div>

      {/* Виньетка и затемнение под текст */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-40 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-40 bg-gradient-to-l from-background to-transparent" />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-16 min-h-screen flex flex-col justify-center">
        <div className="max-w-4xl">
          <div
            className="inline-flex items-center gap-2.5 border border-primary/40 px-3.5 py-1.5 mb-8 fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
              CRM для фотографов и студий
            </span>
          </div>

          <h1 className="font-display text-[2.75rem] leading-[1.04] sm:text-6xl lg:text-8xl font-bold text-foreground">
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {titleWords.map((word, index) => (
                <span
                  key={index}
                  className={`${index < visibleWords ? "fade-in" : "opacity-0"} ${
                    word === "кадры" ? "italic text-primary" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.07}s` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p
            className={`mt-8 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground ${
              subtitleVisible ? "fade-in-subtitle" : "opacity-0"
            }`}
          >
            Foto-Mix ведёт вашу базу клиентов, держит календарь съёмок, сам напоминает вам и заказчику
            о встрече, отдаёт обработанные фото в личной галерее и считает, сколько вы заработали.
          </p>

          <div
            className={`mt-10 flex flex-col sm:flex-row gap-4 ${subtitleVisible ? "fade-in-subtitle" : "opacity-0"}`}
            style={{ animationDelay: "0.15s" }}
          >
            <Button
              asChild
              size="lg"
              className="rounded-none h-14 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 tracking-wide"
            >
              <a href="https://foto-mix.ru/">
                Начать бесплатно
                <Icon name="ArrowRight" size={18} className="ml-2" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollTo("#kak-rabotaet")}
              className="rounded-none h-14 px-8 text-base border-border bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground tracking-wide"
            >
              <Icon name="Play" size={16} className="mr-2" />
              Как это работает
            </Button>
          </div>

          <dl
            className={`mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl ${
              subtitleVisible ? "fade-in-subtitle" : "opacity-0"
            }`}
            style={{ animationDelay: "0.3s" }}
          >
            {stats.map((s) => (
              <div key={s.label} className="border-l border-border pl-4">
                <dt className="font-display text-4xl font-bold text-foreground">{s.value}</dt>
                <dd className="mt-1 text-sm text-muted-foreground leading-snug">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center gap-2 text-muted-foreground">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Листайте</span>
        <Icon name="ChevronDown" size={16} className="animate-bounce" />
      </div>
    </header>
  )
}

export default Hero3DWebGL