import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { ReactNode } from 'react';

interface LoginCardProps {
  isRegistering: boolean;
  children: ReactNode;
}

const LoginCard = ({ isRegistering, children }: LoginCardProps) => {
  return (
    <Card 
      className="w-full max-w-md shadow-2xl relative z-10 overflow-hidden"
      style={{
        backgroundImage: `url(https://cdn.poehali.dev/files/b5e1f5a0-ccfd-4d76-a06a-5112979ef8eb.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-0" />
      <div className="relative z-10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="Lock" size={32} className="text-primary" />
          </div>
          <CardTitle className="text-2xl">Foto-Mix</CardTitle>
          <CardDescription className="text-base">Умная платформа для фотографов</CardDescription>
          <div className="mt-3 text-sm text-muted-foreground">
            {isRegistering ? 'Создайте новый аккаунт' : 'Вход в систему'}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
        </CardContent>
      </div>
    </Card>
  );
};

export default LoginCard;
