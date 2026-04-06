import { NextResponse } from 'next/server';

/**
 * Global Error Handler:
 * Standardizes diagnostic output across all service layers (Storage, AI, DB).
 * Prevents "generic crashes" by providing safe, actionable JSON responses.
 */
export const handleServiceError = (service: string, error: any, customMsg?: string) => {
  const message = error.message || 'Unknown Service Error';
  console.error(`[CRITICAL] Service Breakdown [${service}]: ${message}`, {
    stack: error.stack,
    details: error
  });

  return {
    success: false,
    service,
    error: customMsg || `Intelligence Lab: ${service} is currently degraded.`,
    details: message,
    timestamp: new Date().toISOString()
  };
};

export const createErrorResponse = (service: string, error: any, status = 500) => {
  const payload = handleServiceError(service, error);
  return NextResponse.json(payload, { status });
};
