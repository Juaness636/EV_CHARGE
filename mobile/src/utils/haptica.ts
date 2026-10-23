// Vibración ligera de confirmación en Android/iOS (en web no hace nada).
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const disponible = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptica = {
  toque: () => { if (disponible) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); },
  exito: () => { if (disponible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
  error: () => { if (disponible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined); },
  aviso: () => { if (disponible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined); },
};
