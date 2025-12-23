import Icon from '@/components/ui/icon';

interface NotificationsSectionProps {
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  smsNotifications: boolean;
  setSmsNotifications: (value: boolean) => void;
}

const NotificationsSection = ({
  emailNotifications,
  setEmailNotifications,
  smsNotifications,
  setSmsNotifications
}: NotificationsSectionProps) => {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Уведомления</h2>
      <div className="space-y-3">
        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <Icon name="Mail" size={20} className="text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Email уведомления</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Получать уведомления на почту</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
          />
        </label>

        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <Icon name="MessageSquare" size={20} className="text-gray-600 dark:text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">SMS уведомления</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Получать уведомления по SMS</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={smsNotifications}
            onChange={(e) => setSmsNotifications(e.target.checked)}
            className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>
    </section>
  );
};

export default NotificationsSection;
