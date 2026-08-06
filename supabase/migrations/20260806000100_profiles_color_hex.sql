-- ============================================================================
--  20260806000100_profiles_color_hex.sql
--  Vlastní barva zaměstnance (RGB paletka v kartě). Má přednost před
--  color_index; když je NULL, platí dosavadní barva z palety (color_index).
-- ============================================================================

alter table profiles add column if not exists color_hex text
  check (color_hex is null or color_hex ~ '^#[0-9a-f]{6}$');
