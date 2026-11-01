# WhatsApp credential delivery

WhatsApp credential delivery is currently unavailable in the application. A
request to generate and send a password over WhatsApp is rejected before any
credential or session is changed. The administrator can still generate a
password for private handoff, or use the email option when it is configured.

The legacy Cloud API adapter remains in source for review, but is not invoked
by the account-management endpoint. Its presence or environment variables do
not mean that school WhatsApp messaging is configured or working. A future
implementation should use a short-lived, single-use activation or reset link,
with tenant-specific school-owned sender configuration and tested recovery.
