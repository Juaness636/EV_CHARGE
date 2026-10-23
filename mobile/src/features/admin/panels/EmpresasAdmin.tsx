// Panel de empresas del administrador: crear (con cuenta nueva o vinculando un usuario
// registrado), aprobar y suspender. Cada empresa solo gestiona sus propias estaciones.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { cambiarEstadoEmpresaAdmin, cambiarPalabrasEmpresaAdmin, crearEmpresaAdmin, listarEmpresasAdmin, type EmpresaCrear } from '../../../api/admin.api';
import type { EmpresaPerfil, EstadoEmpresa } from '../../../api/empresa.api';
import { mensajeError } from '../../../api/httpClient';
import { useCarga } from '../../../utils/useCarga';
import { fechaHora } from '../../../utils/formato';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, AppModal, Boton, CampoSelect, CampoTexto, Cargando, Chips, Dato, Insignia, ItemLista, Vacio } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeContext';
import { ejecutarAdmin, type PropsAdmin } from './comun';

const ETIQUETA_ESTADO: Record<EstadoEmpresa, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', suspendida: 'Suspendida' };
const TONO_ESTADO = { pendiente: 'amarillo', aprobada: 'verde', suspendida: 'rojo' } as const;
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}$/;
const AYUDA_PALABRAS = 'Separadas por coma. Toda estación del mapa cuyo nombre u operador contenga una de estas palabras pasa a esta empresa. Ej: enel x, terpel, celsia.';

type Filtro = 'todas' | EstadoEmpresa;

export function EmpresasAdmin({ version }: PropsAdmin) {
  const { colors } = useTheme();
  const { datos: empresas, cargando, error, recargar } = useCarga(() => listarEmpresasAdmin(), [] as EmpresaPerfil[], [version]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [creando, setCreando] = useState(false);
  const [editandoPalabras, setEditandoPalabras] = useState<EmpresaPerfil | null>(null);
  const filas = filtro === 'todas' ? empresas : empresas.filter((e) => e.estado === filtro);

  const cambiar = async (empresa: EmpresaPerfil, estado: EstadoEmpresa) => {
    const texto = estado === 'suspendida'
      ? `Al suspender ${empresa.nombre_comercial}, sus estaciones dejan de aparecer en el mapa y no puede editarlas.`
      : `¿Marcar ${empresa.nombre_comercial} como ${ETIQUETA_ESTADO[estado].toLowerCase()}?`;
    if (!(await confirmar({ titulo: 'Estado de la empresa', mensaje: texto, confirmarTexto: ETIQUETA_ESTADO[estado] }))) return;
    await ejecutarAdmin(() => cambiarEstadoEmpresaAdmin(empresa.id, estado), recargar, 'Estado de la empresa actualizado.');
  };

  return (
    <>
      <Boton titulo="Nueva empresa" icono="building" onPress={() => setCreando(true)} style={{ alignSelf: 'flex-start' }} />
      <Chips valor={filtro} onChange={setFiltro} opciones={[
        { valor: 'todas', etiqueta: 'Todas' }, { valor: 'pendiente', etiqueta: 'Pendientes' },
        { valor: 'aprobada', etiqueta: 'Aprobadas' }, { valor: 'suspendida', etiqueta: 'Suspendidas' },
      ]} />
      {error ? <Alerta texto={error} /> : null}
      {cargando && !empresas.length ? <Cargando /> : filas.length === 0 ? <Vacio texto="No hay empresas para este filtro." icono="building" /> : filas.map((e) => (
        <ItemLista
          key={e.id}
          titulo={e.nombre_comercial}
          insignia={<Insignia texto={ETIQUETA_ESTADO[e.estado]} tono={TONO_ESTADO[e.estado]} />}
          acciones={<>
            {e.estado !== 'aprobada' && <Boton titulo="Aprobar" pequeno variante="soft" onPress={() => void cambiar(e, 'aprobada')} />}
            {e.estado !== 'suspendida' && <Boton titulo="Suspender" pequeno variante="danger" onPress={() => void cambiar(e, 'suspendida')} />}
            <Boton titulo="Palabras clave" icono="tags" pequeno variante="outline" onPress={() => setEditandoPalabras(e)} />
          </>}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: e.color_hex }} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{e.color_hex}</Text>
          </View>
          <Dato etiqueta="Cuenta de acceso" valor={e.usuario_email || '—'} />
          <Dato etiqueta="NIT" valor={e.nit || '—'} />
          <Dato etiqueta="Palabras clave" valor={e.palabras_clave || 'Sin palabras: no recibe estaciones del mapa'} />
          <Dato etiqueta="Estaciones" valor={String(e.total_estaciones)} />
          <Dato etiqueta="Creada" valor={fechaHora(e.created_at)} />
        </ItemLista>
      ))}
      <FormEmpresa visible={creando} onCerrar={() => setCreando(false)} onCreada={recargar} />
      <FormPalabras empresa={editandoPalabras} onCerrar={() => setEditandoPalabras(null)} onGuardada={recargar} />
    </>
  );
}

function FormPalabras({ empresa, onCerrar, onGuardada }: {
  empresa: EmpresaPerfil | null;
  onCerrar: () => void;
  onGuardada: () => void | Promise<void>;
}) {
  const [palabras, setPalabras] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  React.useEffect(() => {
    setPalabras(empresa?.palabras_clave ?? '');
    setError('');
  }, [empresa]);

  const guardar = async () => {
    if (!empresa) return;
    setGuardando(true);
    setError('');
    try {
      await cambiarPalabrasEmpresaAdmin(empresa.id, palabras);
      notificar({ tipo: 'success', titulo: 'Palabras clave', mensaje: `Listo. Las estaciones del mapa que coincidan ahora son de ${empresa.nombre_comercial}.` });
      await onGuardada();
      onCerrar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar las palabras clave.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppModal visible={!!empresa} onClose={onCerrar} titulo={`Palabras clave · ${empresa?.nombre_comercial ?? ''}`} anchoMaximo={520}
      pie={<Boton titulo="Guardar" icono="check" cargando={guardando} onPress={() => void guardar()} bloque />}
    >
      {error ? <Alerta texto={error} /> : null}
      <CampoTexto etiqueta="Palabras clave" value={palabras} onChangeText={setPalabras} autoCapitalize="none" placeholder="enel x, enelx" ayuda={AYUDA_PALABRAS} />
    </AppModal>
  );
}

// También lo usa el panel de usuarios para vincular a un usuario ya registrado.
export function FormEmpresa({ visible, correoExistente, onCerrar, onCreada }: {
  visible: boolean;
  correoExistente?: string;
  onCerrar: () => void;
  onCreada: () => void | Promise<void>;
}) {
  const [modo, setModo] = useState<'existente' | 'nueva'>(correoExistente ? 'existente' : 'nueva');
  const [form, setForm] = useState({
    nombre_comercial: '', nit: '', palabras_clave: '', telefono: '', email_contacto: '', color_hex: '#16a34a', estado: 'aprobada' as EstadoEmpresa,
    usuario_nombre: '', usuario_email: '', usuario_password: '', usuario_existente_email: correoExistente ?? '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campo = (clave: keyof typeof form) => (valor: string) => setForm((f) => ({ ...f, [clave]: valor }));

  // Al abrir desde un usuario concreto, el formulario llega listo para vincularlo.
  React.useEffect(() => {
    if (!visible) return;
    setError('');
    if (correoExistente) {
      setModo('existente');
      setForm((f) => ({ ...f, usuario_existente_email: correoExistente }));
    }
  }, [visible, correoExistente]);

  const cuentaLista = modo === 'existente'
    ? form.usuario_existente_email.includes('@')
    : form.usuario_nombre.trim().length >= 2 && form.usuario_email.includes('@') && form.usuario_password.length >= 8;
  const valido = form.nombre_comercial.trim().length >= 2 && COLOR_VALIDO.test(form.color_hex) && cuentaLista;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const base: EmpresaCrear = {
      nombre_comercial: form.nombre_comercial.trim(),
      nit: form.nit.trim() || undefined,
      palabras_clave: form.palabras_clave.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      email_contacto: form.email_contacto.trim() || undefined,
      color_hex: form.color_hex,
      estado: form.estado,
    };
    const payload: EmpresaCrear = modo === 'existente'
      ? { ...base, usuario_existente_email: form.usuario_existente_email.trim() }
      : { ...base, usuario_nombre: form.usuario_nombre.trim(), usuario_email: form.usuario_email.trim(), usuario_password: form.usuario_password };
    try {
      const empresa = await crearEmpresaAdmin(payload);
      notificar({ tipo: 'success', titulo: 'Empresa creada', mensaje: `${empresa.nombre_comercial} ya puede iniciar sesión con ${empresa.usuario_email}.` });
      await onCreada();
      onCerrar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear la empresa.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onCerrar} titulo="Nueva empresa" anchoMaximo={520}
      pie={<Boton titulo="Crear empresa" icono="building" cargando={guardando} disabled={!valido} onPress={() => void guardar()} bloque />}
    >
      {error ? <Alerta texto={error} /> : null}
      <CampoTexto etiqueta="Nombre comercial" requerido value={form.nombre_comercial} onChangeText={campo('nombre_comercial')} placeholder="Ej. Enel X" />
      <CampoTexto etiqueta="NIT" value={form.nit} onChangeText={campo('nit')} placeholder="900123456-7" ayuda="Opcional. Es solo un dato de referencia, no se valida el formato." />
      <CampoTexto etiqueta="Palabras clave de sus estaciones" value={form.palabras_clave} onChangeText={campo('palabras_clave')} autoCapitalize="none" placeholder="enel x, enelx" ayuda={AYUDA_PALABRAS} />
      <CampoTexto etiqueta="Teléfono" value={form.telefono} onChangeText={campo('telefono')} keyboardType="phone-pad" />
      <CampoTexto etiqueta="Correo de contacto" value={form.email_contacto} onChangeText={campo('email_contacto')} keyboardType="email-address" autoCapitalize="none" />
      <CampoTexto etiqueta="Color de marca (#RRGGBB)" value={form.color_hex} onChangeText={(v) => campo('color_hex')(v.trim())} autoCapitalize="none"
        error={COLOR_VALIDO.test(form.color_hex) ? undefined : 'Usa el formato #RRGGBB'} />
      <CampoSelect etiqueta="Estado inicial" valor={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v as EstadoEmpresa }))}
        opciones={[{ valor: 'aprobada', etiqueta: 'Aprobada (puede publicar)' }, { valor: 'pendiente', etiqueta: 'Pendiente' }]} />

      <Chips valor={modo} onChange={setModo} opciones={[
        { valor: 'existente', etiqueta: 'Usuario ya registrado', icono: 'user-check' },
        { valor: 'nueva', etiqueta: 'Cuenta nueva', icono: 'user-plus' },
      ]} />
      {modo === 'existente' ? (
        <CampoTexto etiqueta="Correo del usuario" requerido value={form.usuario_existente_email} onChangeText={campo('usuario_existente_email')}
          keyboardType="email-address" autoCapitalize="none" ayuda="Ese usuario pasa a ser la cuenta de la empresa y entra al panel de empresa." />
      ) : (
        <>
          <CampoTexto etiqueta="Nombre del responsable" requerido value={form.usuario_nombre} onChangeText={campo('usuario_nombre')} />
          <CampoTexto etiqueta="Correo de acceso" requerido value={form.usuario_email} onChangeText={campo('usuario_email')} keyboardType="email-address" autoCapitalize="none" />
          <CampoTexto etiqueta="Contraseña" requerido password value={form.usuario_password} onChangeText={campo('usuario_password')}
            ayuda="Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo." />
        </>
      )}
    </AppModal>
  );
}
