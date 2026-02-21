/** @type {const} */
const themeColors = {
  // Premium ember/fire palette — dark-first, warm accents
  primary: { light: '#FF6B35', dark: '#FF6B35' },       // Ember orange — vibrant but not garish
  background: { light: '#0A0A0C', dark: '#0A0A0C' },    // Near-black with slight warmth
  surface: { light: '#161418', dark: '#161418' },        // Elevated surface — subtle purple-warm tint
  foreground: { light: '#F0E6D8', dark: '#F0E6D8' },    // Warm cream text
  muted: { light: '#7A6B5D', dark: '#7A6B5D' },         // Warm gray for secondary text
  border: { light: '#241E1A', dark: '#241E1A' },         // Subtle warm border
  success: { light: '#34D399', dark: '#34D399' },        // Emerald green
  warning: { light: '#FBBF24', dark: '#FBBF24' },       // Amber
  error: { light: '#EF4444', dark: '#EF4444' },          // Red
};

module.exports = { themeColors };
