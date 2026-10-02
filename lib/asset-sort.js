// Use the same order during server rendering and browser hydration. The user's
// default locale (and ICU version) must not affect the initial Asset list.
export function compareNaturalText(left, right) {
  const leftParts = String(left).match(/[0-9]+|[^0-9]+/g) ?? [];
  const rightParts = String(right).match(/[0-9]+|[^0-9]+/g) ?? [];

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart == null) return -1;
    if (rightPart == null) return 1;

    const bothNumeric = /^[0-9]/.test(leftPart) && /^[0-9]/.test(rightPart);
    const leftValue = bothNumeric ? leftPart.replace(/^0+/, "") || "0" : leftPart;
    const rightValue = bothNumeric ? rightPart.replace(/^0+/, "") || "0" : rightPart;

    if (bothNumeric && leftValue.length !== rightValue.length) {
      return leftValue.length < rightValue.length ? -1 : 1;
    }
    if (leftValue !== rightValue) return leftValue < rightValue ? -1 : 1;
  }

  return 0;
}
