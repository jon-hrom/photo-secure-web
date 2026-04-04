INSERT INTO retouch_presets (name, pipeline_json, is_default, created_at, updated_at)
VALUES (
  'debug_test',
  '[{"op":"advanced_spots","strength":1.0},{"op":"lama_inpaint","strength":0.9,"dilate":0}]'::jsonb,
  false,
  NOW(),
  NOW()
);