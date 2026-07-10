import fetch from 'node-fetch';

let cachedToken = '';
let tokenExpiry = 0;

export async function getAccessToken(): Promise<string> {
  if (tokenExpiry > Date.now()) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal client ID or secret is not set.');
  }

  const baseUrl = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  try {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch access token: ${data.error_description || 'Unknown error'}`);
    }

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // token expiry minus 60 seconds buffer
    
    return cachedToken;
  } catch (error) {
    console.error('Error fetching PayPal access token:', error);
    throw error;
  }
}

export async function getBalance(): Promise<Array<{currency: string, value: string}>> {
  try {
    const accessToken = await getAccessToken();
    const baseUrl = process.env.PAYPAL_SANDBOX === 'true'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const response = await fetch(`${baseUrl}/v1/reporting/balances`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${data.message || 'Unknown error'}`);
    }

    return data.available_balance || [{ currency: 'USD', value: '0.00' }];
  } catch (error) {
    console.error('Error fetching PayPal balance:', error);
    return [{ currency: 'USD', value: '0.00' }];
  }
}

export async function verifyWebhook(body: string, headers: Record<string,string>): Promise<boolean> {
  if (process.env.PAYPAL_SANDBOX === 'true') {
    return true;
  }

  try {
    const accessToken = await getAccessToken();
    const baseUrl = process.env.PAYPAL_SANDBOX === 'true'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transmission_id: headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url: headers['paypal-cert-url'],
        auth_algo: headers['paypal-auth-algo'],
        transmission_sig: headers['paypal-transmission-sig'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID, // The PayPal webhook ID should be stored in environment variables
        webhook_event: JSON.parse(body)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to verify webhook: ${data.message || 'Unknown error'}`);
    }

    return data.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Error verifying PayPal webhook:', error);
    return false;
  }
}