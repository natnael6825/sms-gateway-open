import { Platform } from 'react-native';

export function getDeviceInfo() {
  const constants = Platform.constants || {};
  const manufacturer = String(constants.Manufacturer || constants.Brand || 'Android').trim();
  const hardwareModel = String(constants.Model || 'Device').trim();
  const release = String(constants.Release || Platform.Version || '').trim();
  return {
    name: `${manufacturer} ${hardwareModel}`.trim(),
    model: release ? `${hardwareModel} · Android ${release}` : hardwareModel,
  };
}
