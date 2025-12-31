import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MobileUpload = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      navigate('/');
      return;
    }
    
    navigate('/photo-bank');
  }, [navigate]);

  return null;
};

export default MobileUpload;
