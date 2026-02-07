import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import funcUrls from '../../backend/func2url.json';

interface VKAuthButtonProps {
  onSuccess: (userId: number, email?: string) => void;
  disabled?: boolean;
}

const VKAuthButton = ({ onSuccess, disabled }: VKAuthButtonProps) => {
  const playSuccessSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  };

  const handleVKLogin = async () => {
    playSuccessSound();
    
    try {
      const vkAuthUrl = funcUrls['vk-auth'];
      if (!vkAuthUrl) {
        toast.error('VK авторизация недоступна');
        return;
      }

      window.location.href = `${vkAuthUrl}?action=start&device_id=web`;
    } catch (error) {
      console.error('VK Auth error:', error);
      toast.error('Ошибка входа через VK');
    }
  };

  return (
    <Button
      onClick={handleVKLogin}
      disabled={disabled}
      variant="outline"
      className="w-full rounded-xl bg-[#0077FF] hover:bg-[#0066DD] text-white border-none hover:shadow-lg hover:scale-105 transition-all duration-300 group"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2 transition-transform duration-300 group-hover:scale-110">
        <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.625-3.504-1.686-1.565-1.765-1.602-.313-3.486 1.801-2.339 4.157-5.336 2.073-5.336h-3.981c-.772 0-.828.435-1.103 1.083-.995 2.347-2.886 5.387-3.604 4.922-.751-.485-.407-2.406-.35-5.261.015-.754.011-1.271-1.141-1.539-.629-.145-1.241-.205-1.809-.205-2.273 0-3.841.953-2.95 1.119 1.571.293 1.42 3.692 1.054 5.16-.638 2.556-3.036-2.024-4.035-4.305-.241-.548-.315-.974-1.175-.974h-3.255c-.492 0-.787.16-.787.516 0 .602 2.96 6.72 5.786 9.77 2.756 2.975 5.48 2.708 7.376 2.708z"/>
      </svg>
      Войти через VK
    </Button>
  );
};

export default VKAuthButton;