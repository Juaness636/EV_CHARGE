// Conversación entre el comprador y el administrador sobre un pedido de productos.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MensajeCompra } from '../api/compras.api';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { fechaHora } from '../utils/formato';
import { contieneLenguajeOfensivo, mensajeContenidoOfensivo } from '../utils/contentFilter';
import { Alerta, Boton, CampoTexto, Etiqueta } from './ui';

interface Props {
  mensajes: MensajeCompra[];
  // true en el panel del admin: sus mensajes se alinean a la derecha.
  vistaAdmin?: boolean;
  cerrado?: boolean;
  onEnviar: (texto: string) => Promise<void>;
}

export function ConversacionPedido({ mensajes, vistaAdmin = false, cerrado = false, onEnviar }: Props) {
  const { colors } = useTheme();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    if (contieneLenguajeOfensivo(limpio)) return setError(mensajeContenidoOfensivo);
    setError('');
    setEnviando(true);
    try {
      await onEnviar(limpio);
      setTexto('');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar el mensaje.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Etiqueta texto={vistaAdmin ? 'Conversación con el comprador' : 'Mensajes con EV Charge'} />
      {mensajes.length === 0 ? (
        <Text style={{ color: colors.textDim, fontSize: 13 }}>
          {vistaAdmin ? 'Aún no hay mensajes. Escribe al comprador para confirmar la dirección o coordinar la entrega.' : 'Aún no hay mensajes. Si tienes dudas sobre el envío, escríbenos aquí.'}
        </Text>
      ) : mensajes.map((m) => {
        const propio = m.es_admin === vistaAdmin;
        return (
          <View
            key={m.id}
            style={[
              styles.burbuja,
              propio
                ? { alignSelf: 'flex-end', backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }
                : { alignSelf: 'flex-start', backgroundColor: colors.cardElevated, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: '800' }}>{m.es_admin ? 'EV Charge' : 'Comprador'}</Text>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{m.texto}</Text>
            <Text style={{ color: colors.textDim, fontSize: 10.5, alignSelf: 'flex-end' }}>{fechaHora(m.created_at)}</Text>
          </View>
        );
      })}
      {error ? <Alerta texto={error} /> : null}
      {cerrado && !vistaAdmin ? (
        <Text style={{ color: colors.textDim, fontSize: 12.5 }}>Este pedido ya está cerrado. Si necesitas ayuda, escríbenos desde Contacto.</Text>
      ) : (
        <>
          <CampoTexto value={texto} onChangeText={(v) => setTexto(v.slice(0, 1000))} placeholder="Escribe un mensaje" multiline accessibilityLabel="Mensaje" />
          <Boton titulo="Enviar mensaje" icono="paper-plane" pequeno cargando={enviando} disabled={!texto.trim()} onPress={() => void enviar()} style={{ alignSelf: 'flex-end' }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  burbuja: { maxWidth: '85%', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
});
