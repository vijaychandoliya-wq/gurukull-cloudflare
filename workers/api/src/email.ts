import type {Env} from './context.js';

export type CredentialsEmailInput = {
  recipient: string;
  schoolName: string;
  schoolCode: string;
  fullName: string;
  role: string;
  identifier: string;
  password: string;
  loginUrl: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character] || character));

export async function sendCredentialsEmail(env: Env, input: CredentialsEmailInput) {
  if (!env.EMAIL) return {status: 'not_configured' as const};
  const name = escapeHtml(input.fullName);
  const school = escapeHtml(input.schoolName);
  const role = escapeHtml(input.role);
  const identifier = escapeHtml(input.identifier);
  const password = escapeHtml(input.password);
  const loginUrl = escapeHtml(input.loginUrl);
  const text = `Welcome to ${input.schoolName}.\n\nYour ${input.role} account for school ${input.schoolCode} is ready.\nLogin: ${input.loginUrl}\nUser ID: ${input.identifier}\nPassword: ${input.password}\n\nPlease change this password after signing in.`;
  const result = await env.EMAIL.send({
    to: input.recipient,
    from: env.EMAIL_FROM || 'welcome@gurukull.in',
    subject: `${input.schoolName}: your ${input.role} login details`,
    text,
    html: `<h1>Welcome to ${school}</h1><p>Hello ${name},</p><p>Your ${role} account is ready.</p><p><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a><br><strong>User ID:</strong> ${identifier}<br><strong>Password:</strong> ${password}</p><p>Please change this password after signing in.</p>`,
  });
  return {status: 'sent' as const, messageId: result.messageId};
}
