# Indian language core preview

Work in progress, 5 November 2026. Do not describe this as full-portal translation.

The dashboard/navigation correction is deployed as 0fe8a745e0f7f822b9b863086560cf52e3ba2b95. Health checks confirmed that SHA on app, api, admin, Rajesh, MGGS and SMVDIC domains. Required CI, security and exact-commit SonarQube checks passed before deployment (run 41977159615). Live browser observation of Rajesh remains blocked by a saved browser permission.

The next change also restores saved account preferences after sign-in and prevents a delayed preference response or Profile refresh from replacing an explicit device language choice. These behaviours have DOM tests.

The next change prepares all 22 scheduled Indian languages plus English for core interface selection. Additional languages are labelled Preview. Scope is login/profile language messages, dashboard, shared navigation and common academic catalogue labels. Module-specific prose, validation responses, dates in third-party components, platform onboarding and mobile apps are not fully translated by this release.

Translation generation runs locally from checked-in interface copy. No school records, names, addresses, login details, uploaded files or database exports are inputs. No runtime translation API or model is added to Workers or the browser. Existing English/Hindi/Tamil/Urdu dashboard, navigation and login translations take precedence over generated drafts.

Tooling: isolated local Python environment, PyTorch 2.6.0, Transformers 4.51.3, IndicTransToolkit 1.1.1. Source model: AI4Bharat IndicTrans2, public derivative naklitechie/indictrans2-en-indic-dist-200M, revision a814dab1ae6e4ee4c7d785b7e1dcb0ac8e36bcd6. Local model code inspected before execution. Model and environment stay under ignored .private; do not commit them. Generated drafts have placeholder and script checks plus contextual action-button terminology. Native-language approval remains pending; additional languages must retain their Preview label. Structural checks cannot certify linguistic correctness.

Release checks must include complete pack coverage for all scheduled language tags; placeholder retention; visible dashboard language switching and RTL; preservation of unsaved forms and user-entered values; backend/selector parity; production build, tests, coverage and SonarQube. Never enable the extra selector entries with an empty/incomplete core catalogue.

Migration 0036 expands existing schools' enabled locale lists and increments configuration versions, preserving the default locale and user preferences. It changes no school business records. Before applying remotely, verify the account/database and capture a recovery bookmark. Deploy matching API and portal together. An older API falls back to its previous four-language defaults on rollback; school records remain unchanged.

Remaining: native-language approval; complete text extraction and translation for individual modules and API errors; mobile app parity; browser acceptance after access is enabled. No completed status is asserted for these items.

All 22 generated packs contain 149 core phrases (3,278 entries). Structural checks passed for all 22, including the expected script in each dashboard heading. Fonts for Meetei Mayek and Ol Chiki are bundled locally under their OFL licences. The static core catalogue adds about 52 kB gzip to the tested portal bundle, not a model download.
