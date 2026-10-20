-- 0023_mggs_school_reservation.sql
-- Empty tenant reservation for the explicitly requested code/hostname.
-- No administrator, roster, academic, finance, or demo records are created.
INSERT OR IGNORE INTO schools (id, code, slug, name, status, timezone, currency, created_at, updated_at)
VALUES (
  'school_mggs_res_001',
  '117',
  'mggs',
  'MGGS',
  'configuration_needed',
  'Asia/Kolkata',
  'INR',
  unixepoch(),
  unixepoch()
);

INSERT OR IGNORE INTO domains (id, school_id, hostname, is_primary, status, created_at)
VALUES (
  'dom_mggs_subdomain_001',
  'school_mggs_res_001',
  'mggs.gurukull.in',
  1,
  'active',
  unixepoch()
);
