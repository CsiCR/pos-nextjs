import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatPrice = (value: number | undefined | null, useDecimals: boolean = true) => {
  if (value === undefined || value === null) return "$0";
  if (!useDecimals) {
    return "$" + Math.round(value).toLocaleString("es-AR");
  }
  return "$" + value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatStock = (value: number | string | undefined | null, options?: { decimals?: number } | number | boolean) => {
  if (value === undefined || value === null) return "0";
  let num = Number(value);
  if (isNaN(num)) return "0";

  let decimals = 3; // Default max precision

  if (typeof options === 'number') {
    decimals = options;
  } else if (typeof options === 'object' && options !== null && 'decimals' in options) {
    decimals = (options as any).decimals;
  } else if (typeof options === 'boolean') {
    decimals = options ? 3 : 0;
  }

  return num.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function roundCurrency(amount: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export const formatDateTime = (date: Date | string | number) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    // second: "2-digit", // Usually minutes is enough for UI, but let's keep it clean. User asked for 24h.
    hour12: false
  });
};

export const formatTime = (date: Date | string | number) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};