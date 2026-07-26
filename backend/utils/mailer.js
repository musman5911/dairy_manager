const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Email is not configured — set EMAIL_USER and EMAIL_PASS (see README for setup).');
  }

  // Defaults to Gmail SMTP. Override EMAIL_HOST/EMAIL_PORT to use a different provider.
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST || 'smtp.gmail.com',
    port: Number(EMAIL_PORT) || 465,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const { EMAIL_USER } = process.env;
  return t.sendMail({
    from: `"Usman Dairy Farm" <${EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendMail };
