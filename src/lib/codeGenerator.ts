function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function generateShortHash(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generateProductCode(name: string): string {
  if (!name || typeof name !== 'string') {
    return `P_${generateShortHash()}`;
  }

  let code = name.toUpperCase();
  code = removeAccents(code);
  code = code.replace(/[^A-Z0-9]/g, '_');
  code = code.replace(/_+/g, '_');
  code = code.replace(/^_+|_+$/g, '');
  code = code.substring(0, 64);

  if (code === '') {
    return `P_${generateShortHash()}`;
  }

  return code;
}

export function normalizeProductCode(code: string): string {
  return generateProductCode(code);
}

export function generateUniqueCode(baseCode: string, existingCodes: string[]): string {
  if (!existingCodes.includes(baseCode)) {
    return baseCode;
  }

  let counter = 2;
  let uniqueCode = `${baseCode}_${counter}`;

  while (existingCodes.includes(uniqueCode)) {
    counter++;
    uniqueCode = `${baseCode}_${counter}`;
  }

  return uniqueCode;
}
