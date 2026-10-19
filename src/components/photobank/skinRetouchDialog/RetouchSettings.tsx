import { Dispatch, SetStateAction } from 'react';
import PlasticPanel from '@/components/tools/skinRetouch/PlasticPanel';
import { usePlasticParams } from '@/components/tools/skinRetouch/plastic';
import EyeSharpenSelector from '@/components/tools/skinRetouch/EyeSharpenSelector';
import ChinToggle from '@/components/tools/skinRetouch/ChinToggle';
import { PRESETS, PresetKey, EyeSharpenKey } from '@/components/tools/skinRetouch/utils';

type PlasticState = ReturnType<typeof usePlasticParams>;

interface RetouchSettingsProps {
  busy: boolean;
  preset: PresetKey;
  setPreset: Dispatch<SetStateAction<PresetKey>>;
  activePreset: (typeof PRESETS)[number] | undefined;
  eyeSharpen: EyeSharpenKey;
  setEyeSharpen: Dispatch<SetStateAction<EyeSharpenKey>>;
  removeChin: boolean;
  setRemoveChin: Dispatch<SetStateAction<boolean>>;
  plastic: PlasticState['params'];
  setPlastic: PlasticState['setParams'];
}

const RetouchSettings = ({
  busy,
  preset,
  setPreset,
  activePreset,
  eyeSharpen,
  setEyeSharpen,
  removeChin,
  setRemoveChin,
  plastic,
  setPlastic,
}: RetouchSettingsProps) => (
  <>
  <div>
    <p className="text-xs font-medium mb-2">Сила ретуши</p>
    <div className="grid grid-cols-3 gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          disabled={busy}
          onClick={() => setPreset(p.key)}
          className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-60 ${
            preset === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
    {activePreset && <p className="text-[11px] text-muted-foreground mt-1.5">{activePreset.hint}</p>}
  </div>

  <EyeSharpenSelector value={eyeSharpen} onChange={setEyeSharpen} disabled={busy} />
  <ChinToggle value={removeChin} onChange={setRemoveChin} disabled={busy} />
  <PlasticPanel
    value={plastic}
    onChange={setPlastic}
    disabled={busy}
    hint="Бесплатно. Применяется к каждому фото перед сохранением. Черты лица не меняются."
  />
  </>
);

export default RetouchSettings;
