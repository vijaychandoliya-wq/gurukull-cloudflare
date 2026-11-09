# Table PDF export — 9 November 2026

Adds a shared Export PDF control to the current portal's Ant Design tables and the native timetable grid. Existing exam score sheets retain their dedicated full report print layout. It does not fetch additional records or change school data, permissions or existing CSV downloads.

The control opens the browser print dialog; choose Save as PDF. It is not a direct generated-PDF download service. Export scope is explicitly the currently rendered/loaded page, not all pages of a server-paginated directory. Active columns, group headers, row-spanned values and current sort order are retained; selection and labelled action columns are excluded. Native browser fonts support the text available on the device without sending school records to another service.

The separate print document uses A4 portrait for up to six columns, A4 landscape for seven to twelve and A3 landscape above twelve. Headers repeat, content wraps, numeric values align right, cells have borders and padding, and portal navigation/theme/scroll containers are excluded. It shows school name when available, page heading, loaded-row count and export time.

Validation: 310 tests in 52 files passed with coverage, including seven new tests for data/scope, grouped headers/row spans, empty-state rejection, print document safety/orientation/cleanup, pagination scope, disabled empty export and export failure. Worker data is not fabricated or persisted by the tests. Portal TypeScript/build, theme and built-asset checks pass. Actual browser PDF rendering and physical print acceptance remain unverified because local browser control is disabled. No claim is made that every paper size or long-record layout has passed visual inspection.

This branch is independent of the blocked fee-counter draft. No production deployment was performed for PDF exports. A full-directory PDF across every page is a separate backend export task; this control labels its loaded-row scope instead of silently claiming a complete export.
