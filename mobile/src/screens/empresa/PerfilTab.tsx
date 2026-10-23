// Datos comerciales y color de marca de la empresa, y cambio de contraseña.
// NIT y razón social no se editan aquí: los valida el administrador al aprobar la empresa.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { actualizarPerfilEmpresa, cambiarPasswordEmpresa } from '../../api/empresa.api';
import { Aviso, Boton, Campo, Insignia, Tarjeta, Titulo, estilos, mensajeError, useEmpresa } from './componentes';

const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;

export const PerfilTab: React.FC = () => {
  const { perfil, refrescarPerfil } = useEmpresa();
  const [form, setForm] = useState({
    nombre_comercial: perfil?.nombre_comercial ?? '',
    telefono: perfil?.telefono ?? '',
    email_contacto: perfil?.email_contacto ?? '',
    direccion_sede: perfil?.direccion_sede ?? '',
    descripcion: perfil?.descripcion ?? '',
    color_hex: perfil?.color_hex ?? '#39a900',
  });
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [mensajeClave, setMensajeClave] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [cambiando, setCambiando] = useState(false);

  if (!perfil) return null;

  const colorOk = COLOR_VALIDO.test(form.color_hex);

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await actualizarPerfilEmpresa({
        nombre_comercial: form.nombre_comercial.trim(),
        telefono: form.telefono.trim() || null,
        email_contacto: form.email_contacto.trim() || null,
        direccion_sede: form.direccion_sede.trim() || null,
        descripcion: form.descripcion.trim() || null,
        color_hex: form.color_hex,
      });
      await refrescarPerfil();
      setMensaje({ tipo: 'exito', texto: 'Perfil actualizado.' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: mensajeError(e, 'No se pudo guardar el perfil.') });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarClave = async () => {
    setCambiando(true);
    setMensajeClave(null);
    try {
      await cambiarPasswordEmpresa(actual, nueva);
      setActual('');
      setNueva('');
      setMensajeClave({ tipo: 'exito', texto: 'Contraseña actualizada.' });
    } catch (e) {
      setMensajeClave({ tipo: 'error', texto: mensajeError(e, 'No se pudo cambiar la contraseña.') });
    } finally {
      setCambiando(false);
    }
  };

  return (
    <View>
      <Tarjeta>
        <View style={estilos.filaEntre}>
          <Titulo>Datos de la empresa</Titulo>
          <Insignia estado={perfil.estado} />
        </View>
        <Text style={estilos.textoSuave}>NIT: {perfil.nit || '—'} · Razón social: {perfil.razon_social || '—'}</Text>
        <Text style={[estilos.textoSuave, { marginBottom: 10 }]}>Cuenta: {perfil.usuario_email || '—'}</Text>
        {mensaje ? <Aviso tipo={mensaje.tipo} texto={mensaje.texto} /> : null}
        <Campo etiqueta="Nombre comercial" value={form.nombre_comercial} onChangeText={(v) => setForm({ ...form, nombre_comercial: v })} />
        <Campo etiqueta="Teléfono" keyboardType="phone-pad" value={form.telefono} onChangeText={(v) => setForm({ ...form, telefono: v })} />
        <Campo
          etiqueta="Correo de contacto"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email_contacto}
          onChangeText={(v) => setForm({ ...form, email_contacto: v })}
        />
        <Campo etiqueta="Dirección de la sede" value={form.direccion_sede} onChangeText={(v) => setForm({ ...form, direccion_sede: v })} />
        <Campo etiqueta="Descripción" multiline value={form.descripcion} onChangeText={(v) => setForm({ ...form, descripcion: v })} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Campo
              etiqueta="Color de marca (#RRGGBB)"
              autoCapitalize="none"
              value={form.color_hex}
              onChangeText={(v) => setForm({ ...form, color_hex: v.trim() })}
            />
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              marginBottom: 8,
              backgroundColor: colorOk ? form.color_hex : 'transparent',
              borderWidth: 1,
              borderColor: '#555',
            }}
          />
        </View>
        <Boton
          texto="Guardar cambios"
          variante="primario"
          deshabilitado={!colorOk || form.nombre_comercial.trim().length < 2}
          cargando={guardando}
          onPress={() => void guardar()}
        />
      </Tarjeta>

      <Tarjeta>
        <Titulo>Cambiar contraseña</Titulo>
        {mensajeClave ? <Aviso tipo={mensajeClave.tipo} texto={mensajeClave.texto} /> : null}
        <Campo etiqueta="Contraseña actual" secureTextEntry value={actual} onChangeText={setActual} />
        <Campo etiqueta="Nueva contraseña" secureTextEntry value={nueva} onChangeText={setNueva} />
        <Text style={[estilos.textoSuave, { marginBottom: 8 }]}>Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.</Text>
        <Boton texto="Cambiar contraseña" deshabilitado={!actual || nueva.length < 8} cargando={cambiando} onPress={() => void cambiarClave()} />
      </Tarjeta>
    </View>
  );
};
