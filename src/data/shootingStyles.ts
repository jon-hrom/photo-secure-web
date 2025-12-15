import { ShootingStyle } from '@/components/clients/ClientsTypes';

export const DEFAULT_SHOOTING_STYLES: ShootingStyle[] = [
  { id: '1', name: 'Свадебная съёмка', order: 1 },
  { id: '2', name: 'Семейная съёмка', order: 2 },
  { id: '3', name: 'Индивидуальный портрет / фотосессия', order: 3 },
  { id: '4', name: 'Love Story (парная съёмка)', order: 4 },
  { id: '5', name: 'Съёмка в садике (детский сад)', order: 5 },
  { id: '6', name: 'Съёмка в школе (классы, линейки, выпускные)', order: 6 },
  { id: '7', name: 'Детская фотосессия (малыши, дети постарше)', order: 7 },
  { id: '8', name: 'Новорожденные (Newborn-съёмка)', order: 8 },
  { id: '9', name: 'Беременность (pregnancy / беременные фотосессии)', order: 9 },
  { id: '10', name: 'Выпускной (садик, школа, вуз)', order: 10 },
  { id: '11', name: 'Крестины / крещение / таинства в церкви', order: 11 },
  { id: '12', name: 'Репортажная съёмка мероприятий (дни рождения, праздники, корпоративы)', order: 12 },
  { id: '13', name: 'Корпоративная съёмка (ивенты, тимбилдинги)', order: 13 },
  { id: '14', name: 'Деловой портрет / бизнес-портрет (для резюме, LinkedIn, сайта)', order: 14 },
  { id: '15', name: 'Контент-съёмка для блогеров / экспертов (личный бренд)', order: 15 },
  { id: '16', name: 'Студийная портретная съёмка', order: 16 },
  { id: '17', name: 'Уличная портретная съёмка (street portrait)', order: 17 },
  { id: '18', name: 'Love Story на улице / в парке / в городе', order: 18 },
  { id: '19', name: 'Индивидуальная творческая съёмка (креатив, образы, стилизации)', order: 19 },
  { id: '20', name: 'Fashion / модельные тесты (для портфолио моделей)', order: 20 },
  { id: '21', name: 'Beauty-съёмка (акцент на макияж и детали лица)', order: 21 },
  { id: '22', name: 'Boudoir / ню в рамках дозволенного и этичного', order: 22 },
  { id: '23', name: 'Фотосъёмка животных (pet photography)', order: 23 },
  { id: '24', name: 'Съёмка крестин, дней рождений детей', order: 24 },
  { id: '25', name: 'Фотосессии на праздники (Новый год, 8 марта, 14 февраля, Пасха и т.п.)', order: 25 },
  { id: '26', name: 'Фотосъёмка для сайтов и рекламы (каталоги, баннеры)', order: 26 },
  { id: '27', name: 'Предметная съёмка (товары, украшения, еда)', order: 27 },
  { id: '28', name: 'Food-съёмка (рестораны, кафе, доставки)', order: 28 },
  { id: '29', name: 'Интерьерная съёмка (квартиры, дома, отели, студии)', order: 29 },
  { id: '30', name: 'Архитектурная съёмка (здания, экстерьеры)', order: 30 },
  { id: '31', name: 'Авто- и мотосъёмка (люди и техника)', order: 31 },
  { id: '32', name: 'Съёмка спорта и соревнований', order: 32 },
  { id: '33', name: 'Концерты, фестивали, шоу', order: 33 },
  { id: '34', name: 'Фотопрогулка (индивидуальная/парная/семейная)', order: 34 },
  { id: '35', name: 'Фотосессия в стиле «день из жизни» (life-style, репортаж повседневности)', order: 35 },
];

const STORAGE_KEY = 'shooting-styles';

export const getShootingStyles = (): ShootingStyle[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_SHOOTING_STYLES;
    }
  }
  return DEFAULT_SHOOTING_STYLES;
};

export const saveShootingStyles = (styles: ShootingStyle[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
};

export const addShootingStyle = (name: string): ShootingStyle => {
  const styles = getShootingStyles();
  const maxOrder = Math.max(...styles.map(s => s.order), 0);
  const newStyle: ShootingStyle = {
    id: Date.now().toString(),
    name,
    order: maxOrder + 1,
  };
  saveShootingStyles([...styles, newStyle]);
  return newStyle;
};

export const reorderShootingStyle = (styleId: string, direction: 'up' | 'down'): void => {
  const styles = getShootingStyles();
  const index = styles.findIndex(s => s.id === styleId);
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= styles.length) return;

  [styles[index].order, styles[targetIndex].order] = [styles[targetIndex].order, styles[index].order];
  
  styles.sort((a, b) => a.order - b.order);
  saveShootingStyles(styles);
};
