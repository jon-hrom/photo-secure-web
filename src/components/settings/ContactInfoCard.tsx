import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber as formatPhone } from '@/utils/phoneFormat';
import LocationSelector from './LocationSelector';
import TelegramVerificationCard from './TelegramVerificationCard';
import { useState } from 'react';
import { getUserTimezoneLabel } from '@/utils/regionTimezone';

interface UserSettings {
  email: string;
  phone: string;
  two_factor_email: boolean;
  email_verified_at: string | null;
  source?: 'email' | 'vk' | 'google' | 'yandex';
  display_name?: string;
  country?: string;
  region?: string;
  city?: string;
}

interface ContactInfoCardProps {
  settings: UserSettings;
  editedEmail: string;
  isEditingEmail: boolean;
  setEditedEmail: (value: string) => void;
  setIsEditingEmail: (value: boolean) => void;
  isSavingEmail: boolean;
  editedPhone: string;
  isEditingPhone: boolean;
  setEditedPhone: (value: string) => void;
  setIsEditingPhone: (value: boolean) => void;
  setPhoneVerified: (value: boolean) => void;
  isSavingPhone: boolean;
  phoneVerified: boolean;
  handleUpdateContact: (field: 'email' | 'phone' | 'display_name' | 'country' | 'region' | 'city', value: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  setShowEmailVerification: (value: boolean) => void;
  setShowPhoneVerification: (value: boolean) => void;
  editedDisplayName: string;
  isEditingDisplayName: boolean;
  setEditedDisplayName: (value: string) => void;
  setIsEditingDisplayName: (value: boolean) => void;
  isSavingDisplayName: boolean;
}

const ContactInfoCard = ({
  settings,
  editedEmail,
  isEditingEmail,
  setEditedEmail,
  setIsEditingEmail,
  isSavingEmail,
  editedPhone,
  isEditingPhone,
  setEditedPhone,
  setIsEditingPhone,
  setPhoneVerified,
  isSavingPhone,
  phoneVerified,
  handleUpdateContact,
  loadSettings,
  setShowEmailVerification,
  setShowPhoneVerification,
  editedDisplayName,
  isEditingDisplayName,
  setEditedDisplayName,
  setIsEditingDisplayName,
  isSavingDisplayName,
}: ContactInfoCardProps) => {


  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl text-gray-900 dark:text-white">
          <Icon name="User" size={20} className="md:w-6 md:h-6" />
          Контактная информация
        </CardTitle>
        <CardDescription className="text-xs md:text-sm text-muted-foreground dark:text-gray-300">Управление вашими контактными данными</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-sm md:text-base text-gray-900 dark:text-gray-100">ФИО или Ник (отображается в переписке)</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="displayName"
              type="text"
              value={isEditingDisplayName ? editedDisplayName : settings.display_name || ''}
              onChange={(e) => {
                setEditedDisplayName(e.target.value);
                setIsEditingDisplayName(true);
              }}
              placeholder="Введите ваше имя"
              className="rounded-xl text-sm md:text-base"
            />
            {isEditingDisplayName && (
              <Button
                onClick={async () => {
                  await handleUpdateContact('display_name', editedDisplayName);
                  setIsEditingDisplayName(false);
                  await loadSettings();
                }}
                className="rounded-xl w-full sm:w-auto"
                disabled={!editedDisplayName.trim() || isSavingDisplayName}
              >
                {isSavingDisplayName ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <Icon name="Save" size={18} />
                )}
              </Button>
            )}
          </div>
          {settings.display_name && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-green-600 bg-green-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-green-200">
              <Icon name="CheckCircle2" size={14} className="md:w-4 md:h-4" />
              <span className="font-medium">Имя сохранено: {settings.display_name}</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm md:text-base text-gray-900 dark:text-gray-100">Email</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="email"
              type="email"
              value={isEditingEmail ? editedEmail : settings.email}
              onChange={(e) => {
                setEditedEmail(e.target.value);
                setIsEditingEmail(true);
              }}
              placeholder={settings.source !== 'email' ? 'Введите ваш email' : ''}
              className="rounded-xl text-sm md:text-base"
              readOnly={settings.source === 'email' && !!settings.email}
            />
            {(isEditingEmail || (settings.source === 'vk' && !settings.email)) && (
              <Button
                onClick={async () => {
                  await handleUpdateContact('email', editedEmail);
                  setIsEditingEmail(false);
                  await loadSettings();
                }}
                className="rounded-xl w-full sm:w-auto"
                disabled={!editedEmail.trim() || !editedEmail.includes('@') || isSavingEmail}
              >
                {isSavingEmail ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <Icon name="Save" size={18} />
                )}
              </Button>
            )}
          </div>
          {settings.email_verified_at || settings.source === 'google' ? (
            <div className="flex items-center gap-2 text-xs md:text-sm text-green-600 bg-green-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 duration-500">
              <Icon name="CheckCircle2" size={14} className="md:w-4 md:h-4" />
              <span className="font-medium">Почта подтверждена</span>
            </div>
          ) : settings.email && settings.email.trim() ? (
            <div className="flex items-center gap-2 text-xs md:text-sm text-amber-700 bg-amber-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
              <Icon name="AlertCircle" size={14} className="md:w-4 md:h-4" />
              <span className="font-medium">Email не подтверждён</span>
              {settings.source !== 'google' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowEmailVerification(true)}
                  className="p-0 h-auto font-semibold underline text-amber-700 hover:text-amber-900 ml-auto"
                >
                  Подтвердить
                </Button>
              )}
              {settings.source === 'google' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="p-0 h-auto font-semibold underline text-amber-700 hover:text-amber-900 ml-auto"
                >
                  Обновить
                </Button>
              )}
            </div>
          ) : settings.source === 'vk' && editedEmail && editedEmail.trim() && editedEmail.includes('@') ? (
            <div className="flex items-center gap-2 text-xs md:text-sm text-blue-700 bg-blue-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
              <Icon name="Info" size={14} className="md:w-4 md:h-4" />
              <span className="font-medium text-xs md:text-sm">Сначала сохраните email</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label className="text-sm md:text-base text-gray-900 dark:text-gray-100">Местоположение</Label>
          <LocationSelector
            country={settings.country || 'Россия'}
            region={settings.region || ''}
            city={settings.city || ''}
            onLocationChange={async (country, region, city) => {
              if (country && country !== settings.country) {
                await handleUpdateContact('country', country);
              }
              if (region && region !== settings.region) {
                await handleUpdateContact('region', region);
              }
              if (city && city !== settings.city) {
                await handleUpdateContact('city', city);
              }
              await loadSettings();
            }}
            autoOpen={false}
          />
          {settings.region && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg mt-2">
              <Icon name="Globe" size={14} />
              <span>Часовой пояс: <span className="font-medium text-foreground">{getUserTimezoneLabel()}</span></span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="phone" className="text-sm md:text-base text-gray-900 dark:text-gray-100">Телефон</Label>
            <div className="flex items-center gap-1.5 text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full shadow-sm">
              <div className="w-3 h-3 rounded-sm bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-[8px]"></span>
              </div>
              <span className="font-semibold">для MAX</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="phone"
              type="tel"
              placeholder="+7 (999) 123-45-67"
              value={isEditingPhone ? editedPhone : (settings.phone ? formatPhone(settings.phone) : '')}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                setEditedPhone(formatted);
                setIsEditingPhone(true);
                setPhoneVerified(false);
              }}
              className="rounded-xl text-sm md:text-base"
              maxLength={18}
              readOnly={!isEditingPhone && !!settings.phone}
            />
            {isEditingPhone ? (
              <Button
                onClick={async () => {
                  await handleUpdateContact('phone', editedPhone);
                  setIsEditingPhone(false);
                }}
                className="rounded-xl w-full sm:w-auto"
                disabled={!editedPhone.trim() || isSavingPhone}
              >
                {isSavingPhone ? (
                  <Icon name="Loader2" size={18} className="animate-spin" />
                ) : (
                  <Icon name="Save" size={18} />
                )}
              </Button>
            ) : settings.phone ? (
              <Button
                onClick={() => setIsEditingPhone(true)}
                variant="outline"
                className="rounded-xl w-full sm:w-auto"
              >
                <Icon name="Pencil" size={18} />
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  await handleUpdateContact('phone', editedPhone);
                  setIsEditingPhone(false);
                }}
                className="rounded-xl w-full sm:w-auto"
                disabled={!editedPhone.trim()}
              >
                <Icon name="Save" size={18} />
              </Button>
            )}
          </div>

          {phoneVerified ? (
            <div className="flex items-center gap-2 text-xs md:text-sm text-green-600 bg-green-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 duration-500">
              <Icon name="CheckCircle2" size={14} className="md:w-4 md:h-4" />
              <span className="font-medium">Телефон подтвержден</span>
            </div>
          ) : settings.phone && !isEditingPhone ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs md:text-sm text-amber-600 bg-amber-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <Icon name="AlertCircle" size={14} className="md:w-4 md:h-4" />
                <span className="font-medium">Телефон не подтвержден</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPhoneVerification(true)}
                className="h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
              >
                <Icon name="Check" size={14} className="mr-1" />
                Подтвердить
              </Button>
            </div>
          ) : null}
          <div className="flex items-start gap-2 text-xs bg-gradient-to-br from-blue-50 to-purple-50 px-3 py-2 rounded-lg border border-blue-200">
            <div className="w-5 h-5 mt-0.5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-[10px]">M</span>
            </div>
            <p className="text-blue-800">Ваш подтвержденный номер телефона используется для уведомлений</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactInfoCard;