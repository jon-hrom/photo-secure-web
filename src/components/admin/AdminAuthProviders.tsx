import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface AuthProvidersProps {
  authProviders: {
    yandex: boolean;
    vk: boolean;
    google: boolean;
  };
  onToggleProvider: (provider: string) => void;
}

const AdminAuthProviders = ({ authProviders, onToggleProvider }: AuthProvidersProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const providers = [
    {
      key: 'yandex',
      name: 'Яндекс ID',
      description: 'Вход через Яндекс аккаунт',
      icon: 'Shield',
      color: 'text-red-500',
    },
    {
      key: 'vk',
      name: 'VK ID',
      description: 'Вход через ВКонтакте',
      icon: 'Users',
      color: 'text-blue-600',
    },
    {
      key: 'google',
      name: 'Google',
      description: 'Вход через Google аккаунт',
      icon: 'Globe',
      color: 'text-blue-500',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Key" className="text-primary" />
                Способы входа
              </CardTitle>
              <CardDescription>
                Управляйте доступными способами входа на сайт
              </CardDescription>
            </div>
            <Icon 
              name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
              className="text-muted-foreground" 
            />
          </div>
        </CardHeader>
        {isExpanded && <CardContent className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.key}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full bg-accent/20 ${provider.color}`}>
                  <Icon name={provider.icon as any} size={24} />
                </div>
                <div>
                  <Label htmlFor={provider.key} className="text-base font-semibold cursor-pointer">
                    {provider.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                </div>
              </div>
              <Switch
                id={provider.key}
                checked={authProviders[provider.key as keyof typeof authProviders]}
                onCheckedChange={() => onToggleProvider(provider.key)}
              />
            </div>
          ))}
        </CardContent>}
      </Card>

      {isExpanded && <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Icon name="Info" className="text-blue-500 mt-0.5" size={20} />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-1">Как это работает?</p>
              <p>
                Когда вы выключаете способ входа, соответствующая кнопка автоматически исчезает со страницы входа. 
                Оставшиеся активные кнопки равномерно распределяются в блоке "Или войти через".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>}
    </div>
  );
};

export default AdminAuthProviders;