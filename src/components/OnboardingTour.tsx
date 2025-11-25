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
}

interface OnboardingTourProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Панель управления',
    description: 'Здесь отображается статистика: количество клиентов и фотографий',
    placement: 'bottom',
    page: 'dashboard'
  },
  {
    target: '[data-tour="clients-nav"]',
    title: 'Раздел "Клиенты"',
    description: 'Управляйте списком ваших клиентов и их фотосессиями',
    placement: 'right',
    page: 'dashboard',
    action: 'click'
  },
  {
    target: '[data-tour="add-client"]',
    title: 'Добавить клиента',
    description: 'Нажмите эту кнопку, чтобы создать карточку нового клиента',
    placement: 'left',
    page: 'clients'
  },
  {
    target: '[data-tour="client-card"]',
    title: 'Карточка клиента',
    description: 'Нажмите на карточку чтобы открыть детали. Свайпайте влево/вправо для быстрых действий',
    placement: 'top',
    page: 'clients'
  },
  {
    target: '[data-tour="photobook-nav"]',
    title: 'Фотобанк',
    description: 'Храните все ваши фотографии в одном месте с удобным поиском',
    placement: 'right',
    page: 'clients',
    action: 'click'
  },
  {
    target: '[data-tour="upload-photos"]',
    title: 'Загрузка фото',
    description: 'Перетащите фото сюда или нажмите для выбора файлов',
    placement: 'bottom',
    page: 'photobook'
  },
  {
    target: '[data-tour="settings-nav"]',
    title: 'Настройки',
    description: 'Управляйте профилем, безопасностью и подсказками интерфейса',
    placement: 'right',
    page: 'photobook',
    action: 'click'
  },
  {
    target: '[data-tour="hints-settings"]',
    title: 'Управление подсказками',
    description: 'Здесь можно отключить обучение или сбросить подсказки',
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
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
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

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${position.top}px`,
    left: `${position.left}px`,
    transform: step.placement === 'bottom' || step.placement === 'top' 
      ? 'translateX(-50%)' 
      : step.placement === 'right'
      ? 'translateY(-50%)'
      : 'translate(-100%, -50%)',
    zIndex: 10001
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        style={{ zIndex: 9999 }}
        onClick={handleSkip}
      />
      
      {targetRect && (
        <div
          className="fixed border-4 border-primary rounded-xl pointer-events-none animate-pulse"
          style={{
            top: `${targetRect.top + window.scrollY - 8}px`,
            left: `${targetRect.left + window.scrollX - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
            zIndex: 10000,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
          }}
        />
      )}

      <div
        style={tooltipStyle}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Lightbulb" size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep 
                    ? 'w-8 bg-primary' 
                    : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSkip}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Пропустить
            </Button>
            <Button
              onClick={handleNext}
              size="sm"
              className="rounded-xl"
            >
              {currentStep === TOUR_STEPS.length - 1 ? (
                <>
                  <Icon name="Check" size={16} className="mr-1" />
                  Завершить
                </>
              ) : (
                <>
                  Продолжить
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
