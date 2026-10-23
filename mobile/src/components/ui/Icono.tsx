// Envoltorio de FontAwesome 6 (mismos nombres de iconos que el web: fa-bolt -> "bolt").
// Por defecto usa el estilo sólido, como `fa-solid` en el frontend web.
import React from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

interface Props {
  name: string;
  size?: number;
  color?: string;
  regular?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Icono({ name, size = 16, color, regular = false, style }: Props) {
  return regular
    ? <FontAwesome6 name={name} size={size} color={color} style={style} />
    : <FontAwesome6 name={name} size={size} color={color} style={style} solid />;
}
