UPDATE retouch_presets 
SET pipeline_json = '[
  {
    "op": "advanced_spots",
    "strength": 1.0,
    "exclude": {"exclude_nose": true, "exclude_eyes": true},
    "mask": {"max_det_side": 3000, "dilate_px": 4, "blur_sigma": 1.5, "skin_erode_px": 8}
  },
  {
    "op": "lama_inpaint",
    "dilate": 0,
    "blur": 1.5,
    "strength": 0.85,
    "use_exclude": true
  }
]'::jsonb,
updated_at = NOW()
WHERE name = 'debug_test';