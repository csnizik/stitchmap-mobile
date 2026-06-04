// Metro configuration extended with NativeWind so Tailwind utilities compile
// from `global.css` across iOS, Android, and web.
// https://www.nativewind.dev/getting-started/expo-router
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
