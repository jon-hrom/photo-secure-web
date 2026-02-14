import ClientSelector from './ClientSelector';
import LinkSettingsForm from './LinkSettingsForm';
import ShareLinkResult from './ShareLinkResult';

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface ShareLinkTabProps {
  clients: Client[];
  selectedClient: Client | null;
  onClientChange: (clientId: string) => void;
  shareUrl: string;
  onCopyLink: () => void;
  onSendViaMax: () => void;
  linkSettings: {
    password: string;
    downloadDisabled: boolean;
    expiresIn: string;
    customDate: string;
    watermarkEnabled: boolean;
    watermarkType: string;
    watermarkText: string;
    watermarkImageUrl: string;
    watermarkFrequency: number;
    watermarkSize: number;
    watermarkOpacity: number;
    watermarkRotation: number;
    screenshotProtection: boolean;
  };
  setLinkSettings: React.Dispatch<React.SetStateAction<typeof linkSettings extends infer T ? T : never>>;
  loading: boolean;
  error: string;
  onGenerateLink: () => void;
  folderName: string;
}

export default function ShareLinkTab({
  clients,
  selectedClient,
  onClientChange,
  shareUrl,
  onCopyLink,
  onSendViaMax,
  linkSettings,
  setLinkSettings,
  loading,
  error,
  onGenerateLink,
  folderName
}: ShareLinkTabProps) {
  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Папка</p>
        <p className="font-medium text-gray-900 dark:text-white break-words">{folderName}</p>
      </div>

      <ClientSelector
        clients={clients}
        selectedClient={selectedClient}
        onClientChange={onClientChange}
      />

      {shareUrl && (
        <ShareLinkResult
          shareUrl={shareUrl}
          selectedClient={selectedClient}
          onCopyLink={onCopyLink}
          onSendViaMax={onSendViaMax}
        />
      )}

      <LinkSettingsForm
        linkSettings={linkSettings}
        setLinkSettings={setLinkSettings}
        loading={loading}
        error={error}
        onGenerateLink={onGenerateLink}
      />
    </>
  );
}
