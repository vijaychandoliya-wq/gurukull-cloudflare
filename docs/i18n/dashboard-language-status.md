# Dashboard language correction

Prepared 4 November 2026. Status: implemented locally; production release pending.

The live portal stores a locale but the dashboard and shared navigation contained English literals. This change connects dashboard messages, actions, empty states, fallback errors and the shared navigation to English, Hindi, Tamil and Urdu dictionaries. Ant Design receives the selected component locale. Changing language rerenders existing dashboard data; school names, addresses, codes and stored records are preserved. Currency formatting uses the selected locale.

Verification: production portal build and DOM tests for switching all four enabled languages, RTL restoration, preference persistence, unchanged school values, no extra dashboard request, and switching after a failed request. Test records are in memory only. Browser acceptance and native-language review remain pending.

This is not completion of the 22-language project. Other module body text, forms, backend error messages, platform onboarding, mobile apps and the remaining language packs require separate implementation and verification. The additional languages are not marked available by this change.
