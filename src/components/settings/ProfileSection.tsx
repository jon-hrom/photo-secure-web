interface ProfileSectionProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  phoneVerified: boolean;
  bio: string;
  setBio: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  interests: string;
  setInterests: (value: string) => void;
}

const ProfileSection = ({
  displayName,
  setDisplayName,
  fullName,
  setFullName,
  phone,
  setPhone,
  phoneVerified,
  bio,
  setBio,
  location,
  setLocation,
  interests,
  setInterests
}: ProfileSectionProps) => {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Профиль</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Отображаемое имя</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="Как вас называть?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Полное имя</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="Имя Фамилия"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Телефон</label>
          <input 
            type="tel" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="+7 (___) ___-__-__"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneVerified && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Подтверждён</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">О себе</label>
          <textarea 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            rows={3}
            placeholder="Расскажите о себе..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Местоположение</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="Город, страна"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Интересы</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            placeholder="Фотография, путешествия, дизайн..."
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
      </div>
    </section>
  );
};

export default ProfileSection;
