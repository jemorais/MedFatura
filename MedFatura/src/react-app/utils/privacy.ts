/**
 * Utility functions for privacy and data masking (LGPD compliance)
 */

/**
 * Masks CPF/CRM for privacy compliance
 * CPF: 123.456.789-01 becomes ***.***.***-01
 * CRM: 12345-SP becomes ***45-SP
 * Generic: Shows first 2 and last 2 characters
 */
export function maskCpfCrm(cpfCrm: string): string {
  if (!cpfCrm) return '';
  
  // Remove spaces and normalize
  const normalized = cpfCrm.trim();
  
  // CPF pattern (XXX.XXX.XXX-XX)
  if (normalized.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
    return `***.***.***-${normalized.slice(-2)}`;
  }
  
  // CPF pattern without dots (XXXXXXXXXXX)
  if (normalized.match(/^\d{11}$/)) {
    return `*********${normalized.slice(-2)}`;
  }
  
  // CRM pattern (XXXXX-XX)
  if (normalized.match(/^\d+-[A-Z]{2}$/)) {
    const parts = normalized.split('-');
    const number = parts[0];
    const state = parts[1];
    if (number.length <= 2) {
      return `**${number}-${state}`;
    }
    return `${'*'.repeat(number.length - 2)}${number.slice(-2)}-${state}`;
  }
  
  // Generic masking: show first 2 and last 2 characters
  if (normalized.length <= 4) {
    return '*'.repeat(normalized.length);
  }
  
  const firstTwo = normalized.slice(0, 2);
  const lastTwo = normalized.slice(-2);
  const middleStars = '*'.repeat(Math.max(0, normalized.length - 4));
  
  return `${firstTwo}${middleStars}${lastTwo}`;
}

/**
 * Masks email addresses for privacy
 * example@domain.com becomes ex***@domain.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  
  if (localPart.length <= 2) {
    return `**@${domain}`;
  }
  
  const maskedLocal = localPart.slice(0, 2) + '*'.repeat(Math.max(0, localPart.length - 2));
  return `${maskedLocal}@${domain}`;
}

/**
 * Formats document type label for display
 */
export function getDocumentTypeLabel(cpfCrm: string): string {
  if (!cpfCrm) return 'Documento';
  
  // CPF patterns
  if (cpfCrm.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/) || cpfCrm.match(/^\d{11}$/)) {
    return 'CPF';
  }
  
  // CRM pattern
  if (cpfCrm.match(/^\d+-[A-Z]{2}$/)) {
    return 'CRM';
  }
  
  return 'Documento';
}
