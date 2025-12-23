import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import MobileNavigation from '@/components/layout/MobileNavigation';
import SecuritySettings from '@/components/settings/SecuritySettings';
import MultiEmailCard from '@/components/settings/MultiEmailCard';
import NewYearSettings from '@/components/settings/NewYearSettings';
import ProfileSection from '@/components/settings/ProfileSection';
import ThemeSection from '@/components/settings/ThemeSection';
import NotificationsSection from '@/components/settings/NotificationsSection';
import ContactInfoCard from '@/components/settings/ContactInfoCard';
import EmailVerificationDialog from '@/components/EmailVerificationDialog';
import PhoneVerificationDialog from '@/components/PhoneVerificationDialog';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useThemeManager } from '@/hooks/useThemeManager';
import { useContactManager } from '@/hooks/useContactManager';
import { useNewYearManager } from '@/hooks/useNewYearManager';

const Settings = () => {
  const {
    settings,
    setSettings,
    loading,
    saving,
    bio,
    setBio,
    location,
    setLocation,
    interests,
    setInterests,
    emailNotifications,
    setEmailNotifications,
    smsNotifications,
    setSmsNotifications,
    getUserId,
    loadSettings,
    saveSettings
  } = useSettingsData();

  const { theme, handleThemeChange } = useThemeManager();

  const {
    showEmailVerification,
    setShowEmailVerification,
    showPhoneVerification,
    setShowPhoneVerification,
    editedEmail,
    setEditedEmail,
    isEditingEmail,
    setIsEditingEmail,
    editedPhone,
    setEditedPhone,
    isEditingPhone,
    setIsEditingPhone,
    isSavingEmail,
    isSavingPhone,
    phoneVerified,
    setPhoneVerified,
    editedDisplayName,
    setEditedDisplayName,
    isEditingDisplayName,
    setIsEditingDisplayName,
    isSavingDisplayName,
    initializeContactData,
    handleUpdateContact
  } = useContactManager(settings, setSettings, getUserId);

  const {
    newYearSettings,
    newYearModeAvailable,
    initializeNewYearSettings,
    handleNewYearSettingsChange,
    saveNewYearSettings
  } = useNewYearManager(getUserId);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const maxBlocks = document.querySelectorAll('[data-max-connection-card], .max-connection-card');
      maxBlocks.forEach(block => {
        if (block && (block.textContent?.includes('MAX') || block.textContent?.includes('Мессенджер'))) {
          (block as HTMLElement).style.display = 'none';
        }
      });
      
      const allSections = document.querySelectorAll('section');
      allSections.forEach(section => {
        const heading = section.querySelector('h2');
        if (heading?.textContent?.includes('MAX')) {
          (section as HTMLElement).style.display = 'none';
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    console.log('[SETTINGS] Component mounted');
    const initialize = async () => {
      const loadedSettings = await loadSettings();
      if (loadedSettings) {
        initializeContactData(loadedSettings);
        initializeNewYearSettings(loadedSettings);
      }
    };
    initialize();
  }, []);

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
        </div>
        <MobileNavigation />
      </>
    );
  }

  return (
    <>
      {showEmailVerification && (
        <EmailVerificationDialog
          open={showEmailVerification}
          onClose={() => setShowEmailVerification(false)}
          onVerified={async () => {
            setShowEmailVerification(false);
            await loadSettings();
          }}
          userId={settings?.id.toString() || ''}
          userEmail={settings?.email || ''}
          isVerified={!!settings?.email_verified_at}
        />
      )}

      {showPhoneVerification && (
        <PhoneVerificationDialog
          open={showPhoneVerification}
          onClose={() => setShowPhoneVerification(false)}
          onVerified={() => {
            setPhoneVerified(true);
            setShowPhoneVerification(false);
            loadSettings();
          }}
          userId={settings?.id.toString() || ''}
          userPhone={settings?.phone || ''}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 pb-32 md:pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Настройки</h1>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
            {settings && (
              <ContactInfoCard
                settings={{
                  email: settings.email,
                  phone: settings.phone || '',
                  two_factor_email: settings.two_factor_email,
                  email_verified_at: settings.email_verified_at,
                  source: (settings.source as 'email' | 'vk' | 'google' | 'yandex') || 'email',
                  display_name: settings.display_name || undefined
                }}
                editedEmail={editedEmail}
                isEditingEmail={isEditingEmail}
                setEditedEmail={setEditedEmail}
                setIsEditingEmail={setIsEditingEmail}
                isSavingEmail={isSavingEmail}
                editedPhone={editedPhone}
                isEditingPhone={isEditingPhone}
                setEditedPhone={setEditedPhone}
                setIsEditingPhone={setIsEditingPhone}
                setPhoneVerified={setPhoneVerified}
                isSavingPhone={isSavingPhone}
                phoneVerified={phoneVerified}
                handleUpdateContact={handleUpdateContact}
                loadSettings={loadSettings}
                setShowEmailVerification={setShowEmailVerification}
                setShowPhoneVerification={setShowPhoneVerification}
                editedDisplayName={editedDisplayName}
                isEditingDisplayName={isEditingDisplayName}
                setEditedDisplayName={setEditedDisplayName}
                setIsEditingDisplayName={setIsEditingDisplayName}
                isSavingDisplayName={isSavingDisplayName}
              />
            )}

            <ProfileSection
              bio={bio}
              setBio={setBio}
              location={location}
              setLocation={setLocation}
              interests={interests}
              setInterests={setInterests}
            />

            <ThemeSection
              theme={theme}
              onThemeChange={handleThemeChange}
            />

            <NotificationsSection
              emailNotifications={emailNotifications}
              setEmailNotifications={setEmailNotifications}
              smsNotifications={smsNotifications}
              setSmsNotifications={setSmsNotifications}
            />

            {settings && (
              <MultiEmailCard
                userId={settings.id.toString()}
                primaryEmail={settings.email}
                onEmailsChanged={loadSettings}
              />
            )}

            {settings && (
              <SecuritySettings
                userId={settings.id.toString()}
                hasPassword={settings.has_password === 'true' || settings.has_password === '1'}
                userSource={settings.source as 'email' | 'vk' | 'google' | 'yandex' | null}
              />
            )}

            {newYearModeAvailable && (
              <NewYearSettings
                settings={newYearSettings}
                onSettingsChange={handleNewYearSettingsChange}
                onSave={saveNewYearSettings}
              />
            )}

            <div className="pt-4">
              <Button 
                onClick={saveSettings} 
                disabled={saving}
                className="w-full md:w-auto"
              >
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <MobileNavigation />
    </>
  );
};

export default Settings;
