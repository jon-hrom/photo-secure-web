UPDATE retouch_presets 
SET pipeline_json = '[
  {"op": "exposure", "amount": 0.55},
  {"op": "temperature", "amount": 0.62},
  {"op": "tint", "amount": 0.52},
  {"op": "shadows", "amount": 0.35},
  {"op": "highlights", "amount": 0.25, "knee": 0.70},
  {"op": "contrast2", "amount": 0.55},
  {"op": "saturation", "amount": 0.52},
  {"op": "skin_fs", "strength": 0.70, "texture_radius": 6.0, "texture_amount": 0.33, "mask": {"max_det_side": 2500}},
  {"op": "deshine", "strength": 0.65, "knee": 0.68, "mask": {"max_det_side": 2500}}
]'::jsonb,
    updated_at = NOW()
WHERE id = 1 AND name = 'default';