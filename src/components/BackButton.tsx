import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/') {
    return null;
  }

  return (
    <Button
      onClick={() => navigate(-1)}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-110 border-2 border-white/20"
      size="icon"
    >
      <Icon name="ArrowLeft" size={24} />
    </Button>
  );
};

export default BackButton;