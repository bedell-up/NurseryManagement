function formatSizeCode(containerSize) {
  if (!containerSize) return 'NA';
  const s = containerSize.trim().toLowerCase();

  // "N gal" or "N gallon"
  const galMatch = s.match(/^(\d+(?:\.\d+)?)\s*gal(?:lon)?s?$/);
  if (galMatch) return `${galMatch[1]}G`;

  // "bare root" with optional size suffix
  if (s.startsWith('bare root')) {
    const rest = s.replace(/^bare root\s*/, '');
    if (!rest) return 'BR';
    const normalized = rest
      .replace(/(\d[\d/-]*(?:\+)?)\s*inch(?:es)?(\+?)/g, '$1in$2')
      .replace(/\s+/g, '-');
    return `BR-${normalized}`;
  }

  // "plug tray N"
  const plugMatch = s.match(/^plug\s*tray\s*(\d+)$/);
  if (plugMatch) return `plug${plugMatch[1]}`;

  // "N inch" variants (4 inch, 3.5 inch, 2 7/8 inch, 3x9 inch band, etc.)
  const inchMatch = s.match(/^([\d.x/\s]+(?:\/\d+)?)\s*inch(?:es)?\s*(.*)$/);
  if (inchMatch) {
    const num = inchMatch[1].trim().replace(/\s+/g, '');
    const suffix = inchMatch[2].trim().replace(/\s+/g, '-');
    return suffix ? `${num}in-${suffix}` : `${num}in`;
  }

  // TBD / TBD (grafting)
  if (s.startsWith('tbd')) return 'TBD';

  // fallback: compact spaces to hyphens
  return s.replace(/\s+/g, '-');
}

function generateSku(genus, species, containerSize) {
  const g = (genus || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const sp = (species || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const size = formatSizeCode(containerSize);
  if (!g && !sp) return null;
  return `${g}${sp}-${size}`;
}

module.exports = { generateSku, formatSizeCode };
