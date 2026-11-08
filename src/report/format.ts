import type { Price } from '../game/score.js';

export const formatNumber = (value: number, digits = 0): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const formatTdc = (value: number): string => `${formatNumber(value)} TDC`;

export const signed = (value: number): string => `${value > 0 ? '+' : ''}${formatNumber(value)}`;

export const formatPrice = (value: Price): string =>
  `≈ ${formatNumber(value.manDays, 1)} man-days · ${formatNumber(value.amount)} ${value.currency}`;
