UPDATE t_p28211681_photo_secure_web.retouch_presets 
SET pipeline_json = '[{"op":"highlights","strength":0.08},{"op":"shadows","strength":0.06},{"op":"deshine","mask":{"max_det_side":2500},"strength":0.3},{"op":"skin_fs","mask":{"max_det_side":2500},"strength":0.55,"tone_sigma_r":0.11,"tone_sigma_s":220,"texture_amount":0.25,"texture_radius":6.0},{"op":"skin_smooth","mask":{"max_det_side":2500},"strength":0.12},{"op":"face_enhance","strength":0.18},{"op":"sharpen","strength":0.18}]'
WHERE name = 'default';

UPDATE t_p28211681_photo_secure_web.retouch_presets 
SET pipeline_json = '[{"op":"skin_smooth","mask":{"max_det_side":2500},"strength":0.33},{"op":"face_enhance","strength":0.67},{"op":"deshine","knee":0.95,"mask":{"max_det_side":2500},"strength":0.8},{"op":"skin_fs","mask":{"max_det_side":2500},"strength":0.89,"texture_amount":0.67,"texture_radius":16},{"op":"highlights","strength":0.88},{"op":"shadows","strength":0.5},{"op":"sharpen","strength":0.15}]'
WHERE name = 'preview';