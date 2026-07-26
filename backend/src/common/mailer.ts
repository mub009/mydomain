import nodemailer from "nodemailer";
import { NotificationChannel } from "@prisma/client";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/config/database";

// Real SMTP when configured; otherwise a JSON transport that just logs the
// message, so development works without a mail server.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // When set, an in-app notification is recorded for this user as well.
  userId?: string;
}

// Fire-and-forget: email problems must never fail the API request that
// triggered them. Every send is also logged.
export function sendMail(mail: Mail): void {
  transport
    .sendMail({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html })
    .then(() => {
      logger.info({ to: mail.to, subject: mail.subject, smtp: !!env.SMTP_HOST }, "email sent");
    })
    .catch((err) => {
      logger.error({ err, to: mail.to, subject: mail.subject }, "email send failed");
    });

  if (mail.userId) {
    prisma.notification
      .create({
        data: { userId: mail.userId, channel: NotificationChannel.EMAIL, title: mail.subject, body: mail.text },
      })
      .catch(() => undefined);
  }
}

interface WelcomeEmailInput {
  userId: string;
  to: string;
  firstName: string;
  businessName: string;
  // Only present when a brand-new account was created for them.
  password?: string;
}

// Welcome mail for a business team whose listing was just registered by a
// dealer/admin — includes their login when a new account was created.
export function sendBusinessWelcomeEmail(input: WelcomeEmailInput): void {
  const loginUrl = `${env.CLIENT_ORIGIN}/login`;
  const credentialLines = input.password
    ? `Your login details:\n  Username (email): ${input.to}\n  Password: ${input.password}\n\nPlease sign in and change your password after your first login.`
    : `Sign in with your existing account (${input.to}) to manage it.`;

  const text = `Hi ${input.firstName},

Welcome to the Markkito family! 🎉

Your business "${input.businessName}" is now live on Markkito, where local customers can discover you, send enquiries, and book your services.

${credentialLines}

Sign in here: ${loginUrl}

From your dashboard you can complete your profile — add photos, opening hours, and services — reply to reviews, and follow up on leads and bookings.

We're excited to grow together!

— The Markkito Team`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(90deg,#047857,#10b981);border-radius:12px 12px 0 0;padding:28px 32px">
      <h1 style="color:#ffffff;margin:0;font-size:22px">Welcome to the Markkito family! 🎉</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px 32px">
      <p>Hi ${input.firstName},</p>
      <p>Your business <strong>“${input.businessName}”</strong> is now live on Markkito, where local customers can discover you, send enquiries, and book your services.</p>
      ${
        input.password
          ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:16px 0">
               <p style="margin:0 0 8px;font-weight:bold;color:#065f46">Your login details</p>
               <p style="margin:0;font-family:monospace">Username: ${input.to}<br/>Password: ${input.password}</p>
               <p style="margin:8px 0 0;font-size:12px;color:#047857">Please change your password after your first login.</p>
             </div>`
          : `<p>Sign in with your existing account (<strong>${input.to}</strong>) to manage it.</p>`
      }
      <p style="text-align:center;margin:24px 0">
        <a href="${loginUrl}" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Sign in to your dashboard</a>
      </p>
      <p>From your dashboard you can complete your profile — add photos, opening hours, and services — reply to reviews, and follow up on leads and bookings.</p>
      <p>We're excited to grow together!<br/>— The Markkito Team</p>
    </div>
  </div>`;

  sendMail({
    userId: input.userId,
    to: input.to,
    subject: `Welcome to Markkito — “${input.businessName}” is live!`,
    text,
    html,
  });
}
