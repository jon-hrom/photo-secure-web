import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { TourStep } from './tourSteps';

interface TourTooltipProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  position: { top: number; left: number };
  targetRect: DOMRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const TourTooltip = ({ 
  step, 
  currentStep, 
  totalSteps, 
  position, 
  targetRect, 
  onNext, 
  onBack, 
  onSkip 
}: TourTooltipProps) => {
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
    <div
      style={tooltipStyle}
      className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      {step.sectionTitle && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <p className="text-xs md:text-sm font-semibold text-primary">{step.sectionTitle}</p>
        </div>
      )}
      <div className="flex items-start gap-2 md:gap-3 mb-3 md:mb-4">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Lightbulb" size={18} className="text-primary md:w-5 md:h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base md:text-lg mb-1">{step.title}</h3>
          <p className="text-xs md:text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-shrink-0">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentStep 
                  ? 'w-5 md:w-6 bg-primary' 
                  : index < currentStep
                  ? 'w-1.5 bg-primary/50'
                  : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button
            onClick={onSkip}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs px-2 h-8"
          >
            <span className="hidden sm:inline">Пропустить</span>
            <span className="sm:hidden">
              <Icon name="X" size={14} />
            </span>
          </Button>
          
          {currentStep > 0 && (
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="text-xs px-2 h-8"
            >
              <Icon name="ArrowLeft" size={14} className="mr-0 md:mr-1" />
              <span className="hidden md:inline">Назад</span>
            </Button>
          )}
          
          <Button
            onClick={onNext}
            size="sm"
            className="rounded-xl text-xs px-3 h-8"
          >
            {currentStep === totalSteps - 1 ? (
              <>
                <Icon name="Check" size={14} className="mr-1" />
                <span className="hidden sm:inline">Завершить</span>
                <span className="sm:hidden">OK</span>
              </>
            ) : (
              <>
                <span>Продолжить</span>
                <Icon name="ArrowRight" size={14} className="ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TourTooltip;