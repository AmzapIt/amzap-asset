export const LABEL_PREFERENCES_KEY = "amzap:label-preferences:v1";
export const DEFAULT_LABEL_PREFERENCES = Object.freeze({
  qrSizeMm: 19,
  offsetXmm: 0,
  offsetYmm: 0,
  codeFontPt: 9,
});

export function normalizeLabelPreferences(value) {
  const ranges = {
    qrSizeMm: [14, 23],
    offsetXmm: [-4, 4],
    offsetYmm: [-4, 4],
    codeFontPt: [7, 11],
  };
  const result = {};
  for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
    const number = Number(value?.[key]);
    result[key] = Number.isFinite(number) && number >= minimum && number <= maximum
      ? Math.round(number * 10) / 10
      : DEFAULT_LABEL_PREFERENCES[key];
  }
  return result;
}

export function labelPreferenceStyle(value) {
  const settings = normalizeLabelPreferences(value);
  return {
    "--label-qr-size": `${settings.qrSizeMm}mm`,
    "--label-offset-x": `${settings.offsetXmm}mm`,
    "--label-offset-y": `${settings.offsetYmm}mm`,
    "--label-code-size": `${settings.codeFontPt}pt`,
  };
}

export function subscribeLabelPreferences(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("amzap-label-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("amzap-label-preferences", callback);
  };
}

export function labelPreferenceSnapshot() {
  try {
    return window.localStorage.getItem(LABEL_PREFERENCES_KEY);
  } catch {
    return null;
  }
}

export function labelPreferenceServerSnapshot() {
  return null;
}

export function preferencesFromSnapshot(snapshot) {
  try {
    return snapshot ? normalizeLabelPreferences(JSON.parse(snapshot)) : DEFAULT_LABEL_PREFERENCES;
  } catch {
    return DEFAULT_LABEL_PREFERENCES;
  }
}
