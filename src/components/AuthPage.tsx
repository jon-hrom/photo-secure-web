import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface AuthPageProps {
  onAuth: (role: 'user' | 'admin') => void;
}

const AuthPage = ({ onAuth }: AuthPageProps) => {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'user' | 'admin'>('user');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Вход выполнен!');
    onAuth(userType);
  };

  const handleSocialLogin = (provider: string) => {
    const providerNames: Record<string, string> = {
      yandex: 'Яндекс ID',
      vk: 'VK ID',
      google: 'Google',
    };

    toast.success(`Вход через ${providerNames[provider]}...`);
    setTimeout(() => onAuth('user'), 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4 bg-[#ffffff]">
            <div className="bg-gradient-to-br from-primary to-secondary p-4 rounded-full">
              <Icon name="Camera" size={48} className="text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Foto-Mix </CardTitle>
          <CardDescription className="text-lg">
            Войдите в систему для продолжения
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={userType} onValueChange={(v) => setUserType(v as 'user' | 'admin')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user" className="rounded-lg">
                <Icon name="User" size={18} className="mr-2" />
                Пользователь
              </TabsTrigger>
              <TabsTrigger value="admin" className="rounded-lg">
                <Icon name="Shield" size={18} className="mr-2" />
                Администратор
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as 'email' | 'phone')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="phone">Телефон</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Электронная почта</Label>
                  <div className="relative">
                    <Icon name="Mail" size={18} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@mail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Номер телефона</Label>
                  <div className="relative">
                    <Icon name="Phone" size={18} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (___) ___-__-__"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Icon name="Lock" size={18} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl h-12 text-lg font-semibold">
              Войти
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Или войти через
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="w-14 h-14 rounded-full hover:scale-110 transition-transform border-2 hover:border-red-500"
                onClick={() => handleSocialLogin('yandex')}
                title="Войти через Яндекс ID"
              >
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm4.5 18h-2.6l-2.6-7.5H10v7.5H7.5V6h4.8c2.1 0 3.5 1.3 3.5 3.1 0 1.5-.8 2.5-2 2.9l2.7 6z" fill="#FF0000"/>
                </svg>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="w-14 h-14 rounded-full hover:scale-110 transition-transform border-2 hover:border-blue-600"
                onClick={() => handleSocialLogin('vk')}
                title="Войти через VK ID"
              >
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.3 13.2c.6.6 1.2 1.2 1.7 1.8.2.3.4.6.6.9.2.4 0 .9-.4.9h-2.4c-.7 0-1.3-.3-1.8-.8-.4-.4-.7-.8-1.1-1.2-.2-.2-.4-.4-.6-.5-.4-.3-.8-.2-1 .2-.2.4-.3.8-.3 1.2 0 .3-.2.5-.5.5h-1.1c-.5 0-1.1-.1-1.6-.3-1.3-.5-2.4-1.3-3.3-2.4-1.7-2-3-4.2-4.1-6.6-.2-.4 0-.6.4-.6h2.4c.3 0 .5.2.6.5.5 1.3 1.2 2.5 2.1 3.6.2.3.5.6.8.8.3.2.6.1.7-.2.1-.2.1-.5.2-.7 0-.8.1-1.6 0-2.4-.1-.5-.3-.8-.8-.9-.3 0-.2-.2-.1-.4.2-.3.4-.5.8-.5h3c.4.1.5.3.6.7v3.4c0 .1.1.9.4 1 .2.1.4 0 .6-.2.8-.8 1.4-1.8 2-2.8.2-.5.5-.9.7-1.4.1-.3.4-.5.7-.5h2.7c.1 0 .2 0 .3.1.4.1.5.4.4.8-.2.7-.7 1.3-1.1 1.9-.5.7-1 1.3-1.5 2-.4.5-.4.8.1 1.2z" fill="#0077FF"/>
                </svg>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="w-14 h-14 rounded-full hover:scale-110 transition-transform border-2 hover:border-blue-500"
                onClick={() => handleSocialLogin('google')}
                title="Войти через Google"
              >
                <svg viewBox="0 0 24 24" className="w-7 h-7">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </Button>
            </div>

            <div className="text-center space-y-2">
              <Button variant="link" className="text-sm text-muted-foreground">
                Забыли пароль?
              </Button>
              <div className="text-sm text-muted-foreground">
                Нет аккаунта?{' '}
                <Button variant="link" className="p-0 h-auto font-semibold text-primary">
                  Зарегистрироваться
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;