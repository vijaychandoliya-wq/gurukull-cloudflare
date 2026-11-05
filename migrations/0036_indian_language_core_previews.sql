-- Expand the requested language selection for existing schools without changing
-- their default language, user preference, school identity or business records.
UPDATE school_locale_settings
SET enabled_locales_json='["en","as","bn","brx","doi","gu","hi","kn","ks-Arab","kok-Deva","mai","ml","mni-Mtei","mr","ne","or","pa-Guru","sa","sat-Olck","sd-Arab","ta","te","ur"]',
    version=version+1, updated_at=unixepoch();
