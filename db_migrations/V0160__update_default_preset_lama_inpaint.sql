UPDATE retouch_presets
SET pipeline_json = '[
  {"op": "highlights", "strength": 0.08},
  {"op": "shadows", "strength": 0.06},
  {"op": "deshine", "strength": 0.30, "mask": {"max_det_side": 2500}},
  {"op": "blackheads", "strength": 0.45, "ksize": 11, "thr_q": 95, "thr_min": 10, "max_area": 500, "dilate_spots": 1, "mask_only": true},
  {"op": "lama_inpaint", "strength": 1.0, "dilate": 2},
  {"op": "skin_fs", "strength": 0.55, "tone_sigma_s": 220, "tone_sigma_r": 0.11, "texture_radius": 6.0, "texture_amount": 0.25, "mask": {"max_det_side": 2500}},
  {"op": "skin_smooth", "strength": 0.12, "mask": {"max_det_side": 2500}},
  {"op": "face_enhance", "strength": 0.18},
  {"op": "sharpen", "strength": 0.18}
]'::jsonb,
    updated_at = now()
WHERE name = 'default';

UPDATE retouch_presets
SET pipeline_json = '[
  {"op": "skin_smooth", "mask": {"max_det_side": 2500}, "strength": 0.33},
  {"op": "face_enhance", "strength": 0.67},
  {"op": "deshine", "knee": 0.95, "mask": {"max_det_side": 2500}, "strength": 0.8},
  {"op": "blackheads", "strength": 0.9, "ksize": 11, "thr_q": 95, "thr_min": 10, "max_area": 500, "dilate_spots": 1, "mask_only": true},
  {"op": "lama_inpaint", "strength": 1.0, "dilate": 2},
  {"op": "skin_fs", "mask": {"max_det_side": 2500}, "strength": 0.89, "texture_amount": 0.67, "texture_radius": 16},
  {"op": "highlights", "strength": 0.88},
  {"op": "shadows", "strength": 0.5},
  {"op": "sharpen", "strength": 0.15}
]'::jsonb,
    updated_at = now()
WHERE name = 'preview';