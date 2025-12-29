import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { russianRegions, Region } from '@/data/regions';

interface LocationSelectorProps {
  country: string;
  region: string;
  city: string;
  onLocationChange: (country: string, region: string, city: string) => void;
  autoOpen?: boolean;
}

const LocationSelector = ({
  country,
  region,
  city,
  onLocationChange,
  autoOpen = false
}: LocationSelectorProps) => {
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [searchRegion, setSearchRegion] = useState('');
  const [searchCity, setSearchCity] = useState('');
  
  console.log('[LOCATION_SELECTOR] Props:', { country, region, city });

  useEffect(() => {
    if (autoOpen && !region) {
      setTimeout(() => {
        setShowRegionModal(true);
      }, 500);
    }
  }, [autoOpen, region]);

  const selectedRegionData = russianRegions.find(r => r.name === region);
  const filteredRegions = russianRegions.filter(r =>
    r.name.toLowerCase().includes(searchRegion.toLowerCase())
  );
  const filteredCities = selectedRegionData
    ? selectedRegionData.cities.filter(c =>
        c.toLowerCase().includes(searchCity.toLowerCase())
      )
    : [];

  const handleRegionSelect = (regionName: string) => {
    onLocationChange(country, regionName, '');
    setShowRegionModal(false);
    setSearchRegion('');
  };

  const handleCitySelect = (cityName: string) => {
    onLocationChange(country, region, cityName);
    setShowCityModal(false);
    setSearchCity('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm md:text-base text-gray-900 dark:text-gray-100">
          Страна
        </Label>
        <Input
          value={country}
          readOnly
          className="rounded-xl text-sm md:text-base bg-gray-50 dark:bg-gray-900"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm md:text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
          Область / Регион
          <span className="text-red-500">*</span>
        </Label>
        <Button
          variant="outline"
          onClick={() => setShowRegionModal(true)}
          className="w-full justify-between rounded-xl text-sm md:text-base h-10"
        >
          <span className={region ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
            {region || 'Выберите область'}
          </span>
          <Icon name="ChevronRight" size={18} />
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm md:text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
          Город
          <span className="text-red-500">*</span>
        </Label>
        <Button
          variant="outline"
          onClick={() => setShowCityModal(true)}
          disabled={!region}
          className="w-full justify-between rounded-xl text-sm md:text-base h-10"
        >
          <span className={city ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
            {city || 'Выберите город'}
          </span>
          <Icon name="ChevronRight" size={18} />
        </Button>
        {!region && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Сначала выберите область
          </p>
        )}
      </div>

      <Dialog open={showRegionModal} onOpenChange={setShowRegionModal}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите область</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Поиск области..."
              value={searchRegion}
              onChange={(e) => setSearchRegion(e.target.value)}
              className="rounded-xl"
            />
            <div className="overflow-y-auto flex-1 space-y-1 pr-2">
              {filteredRegions.map((r) => (
                <Button
                  key={r.name}
                  variant="ghost"
                  onClick={() => handleRegionSelect(r.name)}
                  className="w-full justify-start text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {r.name}
                </Button>
              ))}
              {filteredRegions.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Область не найдена
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCityModal} onOpenChange={setShowCityModal}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите город</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Поиск города..."
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="rounded-xl"
            />
            <div className="overflow-y-auto flex-1 space-y-1 pr-2">
              {filteredCities.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  onClick={() => handleCitySelect(c)}
                  className="w-full justify-start text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {c}
                </Button>
              ))}
              {filteredCities.length === 0 && selectedRegionData && (
                <p className="text-center text-gray-500 py-8">
                  Город не найден
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationSelector;