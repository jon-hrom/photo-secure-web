INSERT INTO retouch_presets (name, pipeline_json, is_default)
VALUES (
  'skin_spots_strong',
  '[{"op":"advanced_spots","strength":1.0,"thr":6},{"op":"lama_inpaint","dilate":24,"blur":1.2,"use_exclude":false,"strength":1.0}]'::jsonb,
  FALSE
)
ON CONFLICT (name) DO UPDATE SET
  pipeline_json = EXCLUDED.pipeline_json,
  updated_at = NOW();