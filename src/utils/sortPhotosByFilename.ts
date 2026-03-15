interface PhotoWithFilename {
  file_name: string;
  [key: string]: unknown;
}

function extractNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const matches = nameWithoutExt.match(/\d+/g);
  if (!matches) return null;
  return parseInt(matches[matches.length - 1], 10);
}

export function sortPhotosByFilename<T extends PhotoWithFilename>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const numA = extractNumber(a.file_name);
    const numB = extractNumber(b.file_name);

    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    }

    if (numA !== null && numB === null) return -1;
    if (numA === null && numB !== null) return 1;

    return a.file_name.localeCompare(b.file_name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export default sortPhotosByFilename;
