/**
 * Gurukul Edge FCM HTTP v1 Dispatch Client
 * Phase 06: B00 - B06
 * Zero-Cost Push Service on Cloudflare Workers Free using Native WebCrypto
 */

export interface GoogleServiceAccountKey {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FcmNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmDispatchResult {
  token: string;
  status: 'sent' | 'unregistered' | 'failed';
  messageId?: string;
  error?: string;
}

/**
 * Sanitizes push notification payload to enforce Phase 06 B03:
 * Never include sensitive student PII, exam marks, or fee amounts on lock screen.
 */
export function sanitizeLockScreenPayload(
  rawTitle: string,
  rawBody: string,
  data?: Record<string, string>
): { title: string; body: string; data: Record<string, string> } {
  // Accept only navigation hints; arbitrary content never reaches the lock screen.
  const safeData: Record<string,string> = {};
  if (data?.screen && ['HOME','attendance','notices','homework','exams','fees'].includes(data.screen)) safeData.screen=data.screen;
  if (data?.event_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.event_id)) safeData.event_id=data.event_id;
  return {
    title: 'School update',
    body: 'Open Gurukull to view your update.',
    data: safeData,
  };
}

/**
 * Parses PKCS#8 PEM string and imports as WebCrypto RS256 Private Key
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates an assertion JWT and exchanges it for a Google OAuth2 access token
 */
export async function getGoogleAccessToken(
  serviceAccount: GoogleServiceAccountKey
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    iat: now,
    exp: now + 3600,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encClaim = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encHeader}.${encClaim}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const sigBase64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(sigBuffer)));
  const signedJwt = `${unsignedToken}.${sigBase64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GOOGLE_OAUTH_FAILED_${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  if(typeof tokenData.access_token!=='string'||!tokenData.access_token)throw new Error('GOOGLE_OAUTH_INVALID_RESPONSE');
  return tokenData.access_token;
}

/**
 * Sends FCM HTTP v1 notification to a specific device token
 */
export async function sendFcmNotification(
  serviceAccount: GoogleServiceAccountKey,
  accessToken: string,
  deviceToken: string,
  payload: FcmNotificationPayload
): Promise<FcmDispatchResult> {
  const sanitized = sanitizeLockScreenPayload(payload.title, payload.body, payload.data);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

  const messageBody = {
    message: {
      token: deviceToken,
      notification: {
        title: sanitized.title,
        body: sanitized.body,
      },
      data: sanitized.data,
      android: {
        priority: 'high',
        notification: {
          channel_id: 'gurukul_announcements',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageBody),
  });

  if (response.ok) {
    const resData = (await response.json()) as { name?: string };
    if(typeof resData.name!=='string'||!resData.name)throw new Error('PROVIDER_ACCEPTANCE_UNKNOWN');
    return {
      token: deviceToken,
      status: 'sent',
      messageId: resData.name,
    };
  }

  const errorData = (await response.json()) as any;
  const errorCode = errorData?.error?.details?.find((detail: {errorCode?:string})=>detail.errorCode==='UNREGISTERED')?.errorCode || errorData?.error?.details?.find((detail:{errorCode?:string})=>typeof detail.errorCode==='string')?.errorCode || errorData?.error?.status;

  if (errorCode === 'UNREGISTERED') {
    return {
      token: deviceToken,
      status: 'unregistered',
      error: 'Device token is no longer valid or app was uninstalled.',
    };
  }

  return {
    token: deviceToken,
    status: 'failed',
    error: `FCM_${response.status}_${typeof errorCode==='string'?errorCode:'UNKNOWN'}`,
  };
}
