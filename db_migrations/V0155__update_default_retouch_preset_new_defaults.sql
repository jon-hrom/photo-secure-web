UPDATE retouch_presets 
SET pipeline_json = '[
  {"op": "highlights", "strength": 0.08},
  {"op": "shadows", "strength": 0.06},
  {"op": "deshine", "strength": 0.30, "mask": {"max_det_side": 2500}},
  {"op": "blackheads", "strength": 0.45, "ksize": 11, "thr_q": 95, "thr_min": 10, "max_area": 500, "inpaint_radius": 3, "dilate_spots": 1},
  {"op": "skin_fs", "strength": 0.55, "tone_sigma_s": 220, "tone_sigma_r": 0.11, "texture_radius": 6.0, "texture_amount": 0.25, "mask": {"max_det_side": 2500}},
  {"op": "skin_smooth", "strength": 0.12, "mask": {"max_det_side": 2500}},
  {"op": "face_enhance", "strength": 0.18},
  {"op": "sharpen", "strength": 0.18}
]'::jsonb,
    updated_at = NOW()
WHERE id = 1 AND name = 'default';
