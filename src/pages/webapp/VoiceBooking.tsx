import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import MobileNavigation from '@/components/layout/MobileNavigation';
import VoiceBookingAssistant from '@/components/voice-booking/VoiceBookingAssistant';

const VoiceBooking = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30 dark:via-purple-900/10 dark:to-blue-900/10 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
          <Icon name="ArrowLeft" size={16} className="mr-1" />
          В кабинет
        </Button>
      </div>
      <VoiceBookingAssistant />
      <MobileNavigation />
    </div>
  );
};

export default VoiceBooking;
