-- Weather and calamity issue buttons (DTR page 2) for organizations that already exist. New organizations get them from DEFAULT_STAMP_TYPES.
INSERT INTO "TimeStampType" ("id", "organizationId", "key", "name", "icon", "tone", "kind", "paid", "requiresNote", "page", "sortOrder", "locked", "updatedAt")
SELECT gen_random_uuid()::text, o."id", v.key, v.name, v.icon, v.tone, 'PAUSE'::"StampKind", true, v.note, 'ISSUE'::"StampPage", v.sort, false, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  ('HEAVY_RAIN', 'Heavy Rain / Flood', '🌧️', 'blue', false, 61),
  ('EXTREME_HEAT', 'Extreme Heat', '🌡️', 'amber', false, 62),
  ('TYPHOON', 'Typhoon / Storm Signal', '🌀', 'indigo', false, 63),
  ('EARTHQUAKE', 'Earthquake', '🫨', 'red', false, 64),
  ('POWER_OUTAGE', 'Power Outage', '⚡', 'slate', false, 65),
  ('CALAMITY', 'Other Calamity', '🆘', 'red', true, 66)
) AS v(key, name, icon, tone, note, sort)
ON CONFLICT ("organizationId", "key") DO NOTHING;
