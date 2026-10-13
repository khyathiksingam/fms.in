const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const OTP_EMAIL_SUBJECT = 'VNRVJIET Student Email Verification OTP';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeProviderMessage(value, apiKey) {
  if (typeof value !== 'string') return '';
  let message = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (apiKey) message = message.split(apiKey).join('[redacted]');
  return message.slice(0, 300);
}

function getOtpEmailHtml(studentName, otp) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,sans-serif;color:#1e293b">
    <main style="max-width:520px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:16px">
      <h1 style="margin:0 0 20px;text-align:center;color:#16265c">VNRVJIET</h1>
      <p>Hello ${escapeHtml(studentName)},</p>
      <p>Your VNRVJIET verification code is:</p>
      <p style="margin:24px 0;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#16265c">${escapeHtml(otp)}</p>
      <p>Your VNRVJIET verification code is: ${escapeHtml(otp)}</p>
      <p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p>
    </main>
  </body>
</html>`;
}

async function sendStudentVerificationOtp({ to, studentName, otp }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM;
  const senderName = process.env.EMAIL_FROM_NAME;
  if (!apiKey || !senderEmail || !senderName) {
    throw new Error('Brevo email delivery is not configured. Contact the administrator.');
  }

  let response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: studentName }],
        subject: OTP_EMAIL_SUBJECT,
        textContent: `Hello ${studentName},\n\nYour VNRVJIET verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not create this account, you can ignore this email.`,
        htmlContent: getOtpEmailHtml(studentName, otp)
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new Error('Unable to reach Brevo email service. Please try again.');
  }

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    const providerMessage = safeProviderMessage(result.message, apiKey);
    throw new Error(providerMessage
      ? `Brevo could not send the verification email: ${providerMessage}`
      : `Brevo could not send the verification email (HTTP ${response.status}).`);
  }

  if (typeof result.messageId !== 'string' || !result.messageId.trim()) {
    throw new Error('Brevo did not confirm email delivery. Please try again.');
  }

  return { success: true, messageId: result.messageId };
}

module.exports = {
  sendStudentVerificationOtp
};
