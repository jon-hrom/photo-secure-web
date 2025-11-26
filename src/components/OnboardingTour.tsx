import { useState, useEffect } from 'react';
import { TOUR_STEPS } from './onboarding/tourSteps';
import TourOverlay from './onboarding/TourOverlay';
import TourTooltip from './onboarding/TourTooltip';

interface OnboardingTourProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const OnboardingTour = ({ currentPage, onPageChange }: OnboardingTourProps) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const tourCompleted = localStorage.getItem('onboardingTourCompleted');
    const tourDisabled = localStorage.getItem('onboardingTourDisabled');
    
    // Временно отключаем автозапуск для отладки
    // if (!tourCompleted && !tourDisabled) {
    //   setTimeout(() => setIsActive(true), 500);
    // }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const isMobile = window.innerWidth < 768;
    
    if (step.mobileOnly && !isMobile) {
      const timer = setTimeout(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    
    if (step.desktopOnly && isMobile) {
      const timer = setTimeout(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
        }
      }, 0);
      return () => clearTimeout(timer);
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

  const playSound = (type: 'next' | 'complete' | 'skip' | 'back') => {
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
    } else if (type === 'back') {
      oscillator.frequency.setValueAtTime(700, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(550, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
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

  const handleBack = () => {
    if (currentStep > 0) {
      playSound('back');
      const prevStep = TOUR_STEPS[currentStep - 1];
      
      if (prevStep.page && prevStep.page !== currentPage) {
        onPageChange(prevStep.page);
      }
      
      setCurrentStep(currentStep - 1);
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

  return (
    <>
      <TourOverlay targetRect={targetRect} onSkip={handleSkip} />
      <TourTooltip 
        step={step}
        currentStep={currentStep}
        totalSteps={TOUR_STEPS.length}
        position={position}
        targetRect={targetRect}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
      />
    </>
  );
};

export default OnboardingTour;