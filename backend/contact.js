'use strict';

const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');

const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_TIMESTAMP_LENGTH = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sesClient = new SESv2Client({});

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function jsonResponse(statusCode, body, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  const allowedOrigins = getAllowedOrigins();

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}

function getMethod(event) {
  return event?.requestContext?.http?.method || event?.httpMethod || '';
}

function parseBody(event) {
  if (!event || typeof event.body !== 'string') {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  return JSON.parse(rawBody);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'El cuerpo debe ser un objeto JSON.';
  }

  const { email, message, submittedAt } = payload;

  if (typeof email !== 'string' || !email.trim()) {
    return 'El email es obligatorio.';
  }
  if (typeof message !== 'string' || !message.trim()) {
    return 'El mensaje es obligatorio.';
  }
  if (typeof submittedAt !== 'string' || !submittedAt.trim()) {
    return 'La fecha de envío es obligatoria.';
  }

  const normalizedEmail = email.trim();
  const normalizedMessage = message.trim();
  const normalizedTimestamp = submittedAt.trim();

  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
    return 'El email no es válido.';
  }
  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
    return 'El mensaje excede el tamaño permitido.';
  }
  if (
    normalizedTimestamp.length > MAX_TIMESTAMP_LENGTH
    || Number.isNaN(Date.parse(normalizedTimestamp))
  ) {
    return 'La fecha de envío no es válida.';
  }

  return null;
}

function createEmailCommand({ email, message, submittedAt }) {
  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!fromEmail || !adminEmail) {
    throw new Error('Missing required email configuration.');
  }

  return new SendEmailCommand({
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: [adminEmail]
    },
    ReplyToAddresses: [email],
    Content: {
      Simple: {
        Subject: {
          Data: 'Nueva consulta desde online24/7',
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: [
              `Email: ${email}`,
              `Fecha de envío: ${submittedAt}`,
              '',
              'Mensaje:',
              message
            ].join('\n'),
            Charset: 'UTF-8'
          }
        }
      }
    }
  });
}

async function handleContact(event, { sendEmail = (command) => sesClient.send(command) } = {}) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const method = getMethod(event).toUpperCase();

  if (method === 'OPTIONS') {
    const allowedOrigins = getAllowedOrigins();

    if (origin && !allowedOrigins.includes(origin)) {
      return jsonResponse(403, { error: 'Origen no permitido.' }, origin);
    }

    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || allowedOrigins[0] || '',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        Vary: 'Origin'
      },
      body: ''
    };
  }

  const allowedOrigins = getAllowedOrigins();

  if (origin && !allowedOrigins.includes(origin)) {
    return jsonResponse(403, { error: 'Origen no permitido.' }, origin);
  }

  if (method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' }, origin);
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return jsonResponse(400, { error: 'El cuerpo debe ser JSON válido.' }, origin);
  }

  // A filled honeypot is treated as accepted without sending or exposing validation details.
  if (typeof payload.website === 'string' && payload.website.trim()) {
    return jsonResponse(202, { message: 'Consulta recibida.' }, origin);
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return jsonResponse(400, { error: validationError }, origin);
  }

  try {
    await sendEmail(createEmailCommand({
      email: payload.email.trim(),
      message: payload.message.trim(),
      submittedAt: payload.submittedAt.trim()
    }));
  } catch (error) {
    console.error('Contact email delivery failed:', error?.name || 'UnknownError');
    return jsonResponse(
      500,
      { error: 'No pudimos enviar tu consulta ahora. Intentá de nuevo más tarde.' },
      origin
    );
  }

  return jsonResponse(202, { message: 'Consulta recibida.' }, origin);
}

exports.handler = handleContact;
exports._private = {
  createEmailCommand,
  handleContact,
  parseBody,
  validatePayload
};
