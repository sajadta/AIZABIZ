// Automated Upstox SMS OTP / TOTP login routes.
import express from "express";
import { registerSmsOtpRoutes } from "./otpAuth/smsOtp";
import { registerTotpLoginRoutes } from "./otpAuth/totpLogin";

export function registerOtpRoutes(app: express.Application) {
  registerSmsOtpRoutes(app);
  registerTotpLoginRoutes(app);
}
