-- ============================================================================
--  20260724002000_profiles_citlive_sloupce.sql
--  Ochrana citlivých osobních údajů na úrovni databáze: e-mail a interní
--  poznámka o zaměstnanci nesmí být čitelné běžným přihlášeným uživatelem
--  (RLS je řádková, ne sloupcová – proto odebíráme SELECT na tyto sloupce
--  rolím anon/authenticated). service_role (auth flow „Jsem tu poprvé",
--  správa hesel) a adminské čtení přes service-role klienta nejsou dotčeny.
--  Vratné: `grant select (email, poznamka) on profiles to authenticated;`
-- ============================================================================

revoke select (email, poznamka) on profiles from anon, authenticated;
