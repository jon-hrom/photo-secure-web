import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'navigate';
  page?: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

interface OnboardingTourProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Главная страница',
    description: 'Здесь вы видите статистику: клиенты, проекты, встречи и баланс',
    placement: 'bottom',
    page: 'dashboard'
  },
  {
    target: '[data-tour="clients-nav"]',
    title: 'Раздел «Клиенты»',
    description: 'Управляйте базой клиентов, добавляйте записи и отслеживайте проекты',
    placement: 'right',
    page: 'dashboard',
    action: 'click'
  },
  {
    target: '[data-tour="add-client"]',
    title: 'Добавить клиента',
    description: 'Создайте карточку клиента с контактами, адресом и соц. сетями',
    placement: 'bottom',
    page: 'clients'
  },
  {
    target: '[data-tour="client-card"]',
    title: 'Карточка клиента',
    description: 'Нажмите для деталей. На телефоне свайпайте влево/вправо для действий',
    placement: 'top',
    page: 'clients'
  },
  {
    target: '.mobile-nav-photobank',
    title: 'Мой фото банк',
    description: 'Загружайте фото, создавайте папки и управляйте всеми файлами в одном месте',
    placement: 'top',
    page: 'clients',
    action: 'navigate',
    mobileOnly: true
  },
  {
    target: '[data-tour="photobook-nav"]',
    title: 'Фотокниги',
    description: 'Создавайте дизайны фотокниг с автоматической раскладкой и 3D-превью',
    placement: 'right',
    page: 'clients',
    action: 'click'
  },
  {
    target: '[data-tour="upload-photos"]',
    title: 'Создание фотокниги',
    description: 'Загрузите фото, выберите шаблон и метод заполнения (авто или вручную)',
    placement: 'bottom',
    page: 'photobook'
  },
  {
    target: '.mobile-nav-settings',
    title: 'Настройки',
    description: 'Управление профилем, безопасностью и подсказками',
    placement: 'top',
    page: 'photobook',
    action: 'navigate',
    mobileOnly: true
  },
  {
    target: '[data-tour="settings-nav"]',
    title: 'Настройки',
    description: 'Управление профилем, двухфакторной аутентификацией и подсказками',
    placement: 'left',
    page: 'photobook',
    action: 'click',
    desktopOnly: true
  },
  {
    target: '[data-tour="hints-settings"]',
    title: 'Управление обучением',
    description: 'Отключите подсказки или перезапустите обучение в любой момент',
    placement: 'top',
    page: 'settings'
  }
];

const OnboardingTour = ({ currentPage, onPageChange }: OnboardingTourProps) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const tourCompleted = localStorage.getItem('onboardingTourCompleted');
    const tourDisabled = localStorage.getItem('onboardingTourDisabled');
    
    if (!tourCompleted && !tourDisabled) {
      setTimeout(() => setIsActive(true), 500);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const isMobile = window.innerWidth < 768;
    
    if (step.mobileOnly && !isMobile) {
      handleNext();
      return;
    }
    
    if (step.desktopOnly && isMobile) {
      handleNext();
      return;
    }

    if (step.page && step.page !== currentPage) {
      return;
    }

    const updatePosition = () => {
      const targetElement = document.querySelector(step.target);
      if (!targetElement) {
        console.log('[TOUR] Element not found:', step.target);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      let top = 0;
      let left = 0;

      switch (step.placement) {
        case 'bottom':
          top = rect.bottom + window.scrollY + 20;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case 'top':
          top = rect.top + window.scrollY - 20;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case 'right':
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.right + window.scrollX + 20;
          break;
        case 'left':
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.left + window.scrollX - 20;
          break;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, currentStep, currentPage]);

  const playSound = (type: 'next' | 'complete' | 'skip') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    if (type === 'next') {
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'complete') {
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else if (type === 'skip') {
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    }
  };

  const handleNext = () => {
    const step = TOUR_STEPS[currentStep];
    
    if (step.action === 'click') {
      const targetElement = document.querySelector(step.target) as HTMLElement;
      if (targetElement) {
        targetElement.click();
      }
    }
    
    if (step.page && currentStep < TOUR_STEPS.length - 1) {
      const nextStep = TOUR_STEPS[currentStep + 1];
      if (nextStep.page && nextStep.page !== step.page) {
        onPageChange(nextStep.page);
      }
    }

    if (currentStep < TOUR_STEPS.length - 1) {
      playSound('next');
      setCurrentStep(currentStep + 1);
    } else {
      playSound('complete');
      completeTour();
    }
  };

  const handleSkip = () => {
    playSound('skip');
    setIsActive(false);
    localStorage.setItem('onboardingTourCompleted', 'true');
  };

  const completeTour = () => {
    setIsActive(false);
    localStorage.setItem('onboardingTourCompleted', 'true');
  };

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  if (step.page && step.page !== currentPage) {
    return null;
  }

  const isMobile = window.innerWidth < 768;
  
  const getTooltipPosition = () => {
    if (!targetRect) return position;
    
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 32, 350) : 384;
    const tooltipHeight = 200;
    const spacing = 16;
    
    let top = position.top;
    let left = position.left;
    
    if (isMobile) {
      top = targetRect.bottom + window.scrollY + spacing;
      left = window.innerWidth / 2;
      
      if (top + tooltipHeight > window.innerHeight + window.scrollY) {
        top = targetRect.top + window.scrollY - tooltipHeight - spacing;
      }
      
      return { top, left };
    }
    
    if (step.placement === 'right') {
      if (left + tooltipWidth > window.innerWidth) {
        left = targetRect.left + window.scrollX - tooltipWidth - spacing;
      }
    }
    
    if (step.placement === 'bottom' || step.placement === 'top') {
      const halfWidth = tooltipWidth / 2;
      if (left - halfWidth < spacing) {
        left = halfWidth + spacing;
      } else if (left + halfWidth > window.innerWidth - spacing) {
        left = window.innerWidth - halfWidth - spacing;
      }
    }
    
    return { top, left };
  };

  const tooltipPos = getTooltipPosition();
  
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${tooltipPos.top}px`,
    left: `${tooltipPos.left}px`,
    transform: isMobile 
      ? 'translateX(-50%)'
      : step.placement === 'bottom' || step.placement === 'top' 
      ? 'translateX(-50%)' 
      : step.placement === 'right'
      ? 'translateY(-50%)'
      : 'translate(-100%, -50%)',
    zIndex: 10001,
    maxWidth: isMobile ? 'calc(100vw - 32px)' : '24rem',
    width: isMobile ? 'calc(100vw - 32px)' : 'auto'
  };

  return (
    <>
      <div 
        className="fixed inset-0"
        style={{ 
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(2px)'
        }}
        onClick={handleSkip}
      />
      
      {targetRect && (
        <>

          
          <div
            className="fixed border-4 border-primary rounded-xl pointer-events-none animate-pulse"
            style={{
              top: `${targetRect.top + window.scrollY - 8}px`,
              left: `${targetRect.left + window.scrollX - 8}px`,
              width: `${targetRect.width + 16}px`,
              height: `${targetRect.height + 16}px`,
              zIndex: 10000
            }}
          />
        </>
      )}

      <div
        style={tooltipStyle}
        className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Lightbulb" size={18} className="text-primary md:w-5 md:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base md:text-lg mb-1">{step.title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground">{step.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep 
                    ? 'w-6 md:w-8 bg-primary' 
                    : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-1 md:gap-2">
            <Button
              onClick={handleSkip}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs md:text-sm px-2 md:px-3"
            >
              <span className="hidden sm:inline">Пропустить</span>
              <span className="sm:hidden">
                <Icon name="X" size={16} />
              </span>
            </Button>
            <Button
              onClick={handleNext}
              size="sm"
              className="rounded-xl text-xs md:text-sm px-2 md:px-4"
            >
              {currentStep === TOUR_STEPS.length - 1 ? (
                <>
                  <Icon name="Check" size={16} className="mr-1" />
                  <span className="hidden sm:inline">Завершить</span>
                  <span className="sm:hidden">OK</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Продолжить</span>
                  <span className="sm:hidden">Далее</span>
                  <Icon name="ArrowRight" size={16} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;