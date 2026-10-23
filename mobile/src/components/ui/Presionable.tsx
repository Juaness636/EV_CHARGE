// Pressable con respuesta física: se encoge con resorte al tocar y, en PC, se eleva al pasar el mouse.
// Se anima el propio Pressable para que los estilos de distribución (flex, márgenes) sigan funcionando.
import React, { useRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const usarNativo = Platform.OS !== 'web';
const PressableAnimado = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  escalaPresion?: number;
  elevarAlPasar?: boolean;
}

export function Presionable({ children, style, escalaPresion = 0.96, elevarAlPasar = false, disabled, onPressIn, onPressOut, onHoverIn, onHoverOut, ...props }: Props) {
  const escala = useRef(new Animated.Value(1)).current;
  const elevacion = useRef(new Animated.Value(0)).current;

  const resorte = (valor: Animated.Value, destino: number) =>
    Animated.spring(valor, { toValue: destino, friction: 6, tension: 220, useNativeDriver: usarNativo }).start();

  return (
    <PressableAnimado
      {...props}
      disabled={disabled}
      onPressIn={(e) => { if (!disabled) resorte(escala, escalaPresion); onPressIn?.(e); }}
      onPressOut={(e) => { resorte(escala, 1); onPressOut?.(e); }}
      onHoverIn={(e) => { if (elevarAlPasar && !disabled) resorte(elevacion, 1); onHoverIn?.(e); }}
      onHoverOut={(e) => { resorte(elevacion, 0); onHoverOut?.(e); }}
      style={[style, {
        transform: [
          { scale: escala },
          { translateY: elevacion.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
        ],
      }]}
    >
      {children}
    </PressableAnimado>
  );
}
