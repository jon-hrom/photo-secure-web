import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Icon name="Info" size={32} className="text-blue-600" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Добро пожаловать!
          </h2>

          <div className="space-y-3 text-sm sm:text-base text-gray-700">
            <p className="leading-relaxed">
              При первом входе нажмите на <span className="inline-flex items-center"><Icon name="Star" size={16} className="text-yellow-500 mx-1" /></span> 
              на фото, которое вам понравилось, для авторизации и добавления в избранное.
            </p>
            <p className="leading-relaxed">
              При следующих входах нужно будет вводить те же данные, которые указывали при первом разе.
            </p>
          </div>

          <Button 
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors touch-manipulation mt-4"
          >
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}
