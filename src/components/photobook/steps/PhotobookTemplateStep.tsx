import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import type { PhotobookTemplate } from '../PhotobookCreator';

interface PhotobookTemplateStepProps {
  onSelect: (template: PhotobookTemplate | null) => void;
  onBack: () => void;
}

interface TemplateCategory {
  id: string;
  name: string;
  group: 'theme' | 'holiday' | 'other';
}

const CATEGORIES: TemplateCategory[] = [
  { id: 'wedding', name: 'Свадьба', group: 'theme' },
  { id: 'children', name: 'Дети', group: 'theme' },
  { id: 'family', name: 'Семья', group: 'theme' },
  { id: 'love', name: 'Love story', group: 'theme' },
  { id: 'travel', name: 'Путешествия', group: 'theme' },
  { id: 'newyear', name: 'Новый год', group: 'holiday' },
  { id: 'graduation', name: 'Выпускной', group: 'holiday' },
  { id: 'birthday', name: 'День рождения', group: 'holiday' },
  { id: 'holidays', name: 'Праздники', group: 'other' },
  { id: 'universal', name: 'Универсальные', group: 'other' },
  { id: 'home', name: 'Домашние любимцы', group: 'other' },
  { id: 'instagram', name: 'Инстабук', group: 'other' },
  { id: 'portfolio', name: 'Портфолио', group: 'other' },
  { id: 'creative', name: 'Для творчества', group: 'other' },
  { id: 'baptism', name: 'Крещение', group: 'other' },
];

const MOCK_TEMPLATES: PhotobookTemplate[] = [
  {
    id: 'custom',
    name: 'Мой дизайн',
    category: 'custom',
    thumbnail: '',
    spreads: 10
  },
  {
    id: 'bday1',
    name: 'B-DAY',
    category: 'birthday',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 12
  },
  {
    id: 'majorka',
    name: 'Majorka 2025',
    category: 'travel',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 15
  },
  {
    id: 'baby',
    name: 'В ожидании малыша',
    category: 'children',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 10
  },
  {
    id: 'paris',
    name: 'Paris 2025',
    category: 'travel',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 14
  },
  {
    id: 'eurotrip',
    name: 'Европейские каникулы',
    category: 'travel',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 16
  },
  {
    id: 'childgarden',
    name: 'Детский сад',
    category: 'children',
    thumbnail: 'https://cdn.poehali.dev/files/707eb06a-2d89-496c-b49e-0c55946e7128.jpg',
    spreads: 12
  },
];

const PhotobookTemplateStep = ({ onSelect, onBack }: PhotobookTemplateStepProps) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => setSelectedCategories([]);

  const filteredTemplates = selectedCategories.length === 0
    ? MOCK_TEMPLATES
    : MOCK_TEMPLATES.filter(t => selectedCategories.includes(t.category));

  const themeCategories = CATEGORIES.filter(c => c.group === 'theme');
  const holidayCategories = CATEGORIES.filter(c => c.group === 'holiday');
  const otherCategories = CATEGORIES.filter(c => c.group === 'other');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-2xl font-bold">Выбор шаблона</h2>
        <div className="w-10" />
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Тематика</h3>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-xs"
                  onClick={clearFilters}
                >
                  (выбрать все)
                </Button>
              </div>
              {themeCategories.map(category => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <label 
                    htmlFor={category.id}
                    className="text-sm cursor-pointer"
                  >
                    {category.name}
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Праздники</h3>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-xs"
                  onClick={clearFilters}
                >
                  (выбрать все)
                </Button>
              </div>
              {holidayCategories.map(category => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <label 
                    htmlFor={category.id}
                    className="text-sm cursor-pointer"
                  >
                    {category.name}
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Без категории</h3>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-xs"
                  onClick={clearFilters}
                >
                  (выбрать все)
                </Button>
              </div>
              {otherCategories.map(category => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <label 
                    htmlFor={category.id}
                    className="text-sm cursor-pointer"
                  >
                    {category.name}
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  template.id === 'custom' ? 'border-2 border-dashed' : ''
                } ${hoveredTemplate === template.id ? 'ring-2 ring-yellow-400' : ''}`}
                onClick={() => onSelect(template)}
                onMouseEnter={() => setHoveredTemplate(template.id)}
                onMouseLeave={() => setHoveredTemplate(null)}
              >
                {template.id === 'custom' ? (
                  <div className="aspect-[3/4] flex flex-col items-center justify-center p-6 text-center">
                    <Icon name="Plus" size={48} className="text-gray-400 mb-4" />
                    <h3 className="text-xl font-bold">Мой дизайн</h3>
                  </div>
                ) : (
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <img 
                      src={template.thumbnail} 
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white text-sm font-semibold">{template.name}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotobookTemplateStep;
