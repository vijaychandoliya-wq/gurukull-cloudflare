# WhatsApp password delivery

The administrator Roles & account access page can generate a strong random password for a teacher or parent and send it to that person’s registered mobile number. Teachers and parents then sign in with the mobile number and the generated password.

The delivery adapter uses the WhatsApp Business Cloud API and an approved template. Configure these Worker values before using **Send WhatsApp**:

- `WHATSAPP_PHONE_NUMBER_ID` — Cloud API phone-number ID.
- `WHATSAPP_ACCESS_TOKEN` — Worker secret, never commit it or place it in a client bundle.
- `WHATSAPP_PASSWORD_TEMPLATE` — approved template name.
- `WHATSAPP_TEMPLATE_LANGUAGE` — template language, default `en_US`.
- `WHATSAPP_DEFAULT_COUNTRY_CODE` — default `91` for Indian 10-digit school numbers.

The approved template body must contain four placeholders in this order: school name, login mobile, password, and login URL. The API sends no password to logs and the admin response for WhatsApp delivery contains only the mobile identifier and delivery status.

Generated passwords are random and stored as an HMAC-SHA-256 digest bound to the school and user with the existing Worker secret. This path is separate from imported bcrypt hashes, so legacy password verification remains behind the measured CPU gate. Reissuing a password revokes existing member access keys and sessions.

If WhatsApp is not configured, the operation fails closed with `WHATSAPP_NOT_CONFIGURED`; it does not send a message or create a new password.
