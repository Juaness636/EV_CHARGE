// Paneles del administrador: resumen, usuarios, reportes, reservas, notificaciones,
// calificaciones y contactos (equivale a AdminPage.tsx del web).
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  actualizarReservaAdmin, actualizarUsuarioAdmin, cambiarEstadoReporte, eliminarReservaAdmin, listarCalificacionesAdmin,
  listarContactosAdmin, listarNotificacionesAdmin, listarReportesAdmin, listarReservasAdmin, listarUsuarios, obtenerEstadisticas,
  responderContactoAdmin, type AdminNotificacion, type AdminReservaDetail, type CalificacionAdmin, type ContactoAdmin,
  type ReporteAdmin, type UserAdmin,
} from '../../../api/admin.api';
import { mensajeError } from '../../../api/httpClient';
import { emitir } from '../../../utils/eventos';
import { etiquetaEstado } from '../../../utils/estaciones';
import { fechaHora } from '../../../utils/formato';
import { useCarga } from '../../../utils/useCarga';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, CampoSelect, CampoTexto, Cargando, Chips, Dato, Estrellas, Insignia, ItemLista, KPI, tonoEstado, Vacio } from '../../../components/ui';

export interface PropsAdmin {
  version: number;
}

// Ejecuta una operación del administrador, notifica y recarga.
export async function ejecutarAdmin(operacion: () => Promise<unknown>, recargar: () => Promise<void>, exito = 'Los cambios se guardaron correctamente.') {
  try {
    await operacion();
    notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: exito });
    emitir('estaciones-actualizadas');
    await recargar();
  } catch (e) {
    notificar({ tipo: 'error', titulo: 'Operación no completada', mensaje: mensajeError(e) });
  }
}

const nombreDe = (u?: { nombre?: string; apellido?: string } | null) => (u ? `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() : '');

export function ResumenAdmin({ version }: PropsAdmin) {
  const { datos: stats, cargando, error } = useCarga(obtenerEstadisticas, null, [version]);
  if (cargando && !stats) return <Cargando />;
  if (error) return <Alerta texto={error} />;
  if (!stats) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <KPI etiqueta="Usuarios" valor={stats.total_usuarios} icono="users" />
      <KPI etiqueta="Vehículos" valor={stats.total_vehiculos} icono="car" />
      <KPI etiqueta="Reservas activas" valor={stats.total_reservas_activas} icono="calendar-check" />
      <KPI etiqueta="Cargas" valor={stats.total_cargas} icono="bolt" />
      <KPI etiqueta="kWh cargados" valor={stats.total_kwh_cargados ?? 0} icono="battery-three-quarters" />
      <KPI etiqueta="Reportes abiertos" valor={stats.total_reportes_abiertos} icono="triangle-exclamation" />
      <KPI etiqueta="Estaciones propias" valor={stats.total_estaciones_propias} icono="charging-station" />
    </View>
  );
}

export function UsuariosAdmin({ version }: PropsAdmin) {
  const { datos: usuarios, cargando, error, recargar } = useCarga(() => listarUsuarios(), [] as UserAdmin[], [version]);
  const [busqueda, setBusqueda] = useState('');
  const filtrados = usuarios.filter((u) => `${u.nombre} ${u.apellido ?? ''} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase()));

  const cambiarRol = async (u: UserAdmin, rol: string) => {
    const esAdmin = rol === 'admin';
    if (esAdmin === u.is_admin) return;
    if (!(await confirmar({ titulo: 'Cambiar rol', mensaje: `¿Deseas asignar el rol ${esAdmin ? 'Administrador' : 'Usuario'} a ${nombreDe(u)}?`, confirmarTexto: 'Cambiar rol' }))) return;
    await ejecutarAdmin(() => actualizarUsuarioAdmin(u.id, { is_admin: esAdmin }), recargar, 'Rol actualizado correctamente.');
  };

  return (
    <>
      <CampoTexto icono="magnifying-glass" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por nombre, apellido o correo" />
      {error ? <Alerta texto={error} /> : null}
      {cargando && !usuarios.length ? <Cargando /> : filtrados.length === 0 ? <Vacio texto="No hay usuarios que coincidan." icono="users" /> : filtrados.map((u) => (
        <ItemLista key={u.id} titulo={nombreDe(u)} insignia={<Insignia texto={u.is_admin ? 'Administrador' : 'Usuario'} tono={u.is_admin ? 'verde' : 'gris'} />}>
          <Dato etiqueta="Correo" valor={u.email} />
          <Dato etiqueta="Fecha de creación" valor={fechaHora(u.created_at)} />
          <View style={{ maxWidth: 260, marginTop: 6 }}>
            <CampoSelect etiqueta="Rol" valor={u.is_admin ? 'admin' : 'usuario'} onChange={(v) => void cambiarRol(u, v)} opciones={[{ valor: 'usuario', etiqueta: 'Usuario' }, { valor: 'admin', etiqueta: 'Administrador' }]} />
          </View>
        </ItemLista>
      ))}
    </>
  );
}

type FiltroReporte = 'todos' | 'abierto' | 'mantenimiento' | 'resuelto' | 'fuera_servicio';

export function ReportesAdmin({ version }: PropsAdmin) {
  const { datos: reportes, cargando, error, recargar } = useCarga(listarReportesAdmin, [] as ReporteAdmin[], [version]);
  const [filtro, setFiltro] = useState<FiltroReporte>('todos');
  const filas = filtro === 'todos' ? reportes : reportes.filter((r) => r.estado === filtro);
  const cambiar = (id: string, estado: Exclude<FiltroReporte, 'todos'>) => ejecutarAdmin(() => cambiarEstadoReporte(id, estado), recargar);

  return (
    <>
      <Chips valor={filtro} onChange={setFiltro} opciones={[
        { valor: 'todos', etiqueta: 'Todos' }, { valor: 'abierto', etiqueta: 'Abiertos' }, { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
        { valor: 'resuelto', etiqueta: 'Resueltos' }, { valor: 'fuera_servicio', etiqueta: 'Fuera de servicio' },
      ]} />
      {error ? <Alerta texto={error} /> : null}
      {cargando && !reportes.length ? <Cargando /> : filas.length === 0 ? <Vacio texto="No hay reportes para este filtro." icono="triangle-exclamation" /> : filas.map((r) => (
        <ItemLista
          key={r.id}
          titulo={r.estacion_nombre || r.estacion_ocm_id}
          insignia={<Insignia texto={etiquetaEstado(r.estado)} tono={tonoEstado(r.estado)} />}
          acciones={<>
            <Boton titulo="Mantenimiento" pequeno variante="outline" onPress={() => void cambiar(r.id, 'mantenimiento')} />
            <Boton titulo="Fuera de servicio" pequeno variante="danger" onPress={() => void cambiar(r.id, 'fuera_servicio')} />
            <Boton titulo="Resolver" pequeno variante="soft" onPress={() => void cambiar(r.id, 'resuelto')} />
          </>}
        >
          <Dato etiqueta="Usuario" valor={r.usuario ? `${nombreDe(r.usuario)} · ${r.usuario.email}` : r.usuario_id} />
          <Dato etiqueta="Tipo" valor={r.tipo} />
          <Dato etiqueta="Comentario" valor={r.descripcion || 'Sin comentario'} />
          <Dato etiqueta="Fecha" valor={fechaHora(r.fecha)} />
        </ItemLista>
      ))}
    </>
  );
}

export function ReservasAdmin({ version }: PropsAdmin) {
  const { datos: reservas, cargando, error, recargar } = useCarga(listarReservasAdmin, [] as AdminReservaDetail[], [version]);
  return (
    <>
      {error ? <Alerta texto={error} /> : null}
      {cargando && !reservas.length ? <Cargando /> : reservas.length === 0 ? <Vacio texto="No hay reservas registradas." icono="calendar" /> : reservas.map((r) => (
        <ItemLista
          key={r.id}
          titulo={r.estacion_nombre || r.estacion_ocm_id}
          insignia={<Insignia texto={r.estado === 'activa' ? 'Aceptada' : r.estado} tono={tonoEstado(r.estado)} />}
          acciones={r.estado === 'activa'
            ? <Boton titulo="Marcar realizada" pequeno variante="soft" onPress={() => void ejecutarAdmin(() => actualizarReservaAdmin(r.id, { estado: 'realizada' }), recargar)} />
            : r.estado === 'realizada'
              ? <Boton titulo="Eliminar" pequeno variante="danger" onPress={async () => { if (await confirmar({ titulo: 'Eliminar reserva', mensaje: '¿Deseas eliminar esta reserva realizada?', confirmarTexto: 'Eliminar' })) void ejecutarAdmin(() => eliminarReservaAdmin(r.id), recargar); }} />
              : undefined}
        >
          <Dato etiqueta="Usuario" valor={r.usuario ? `${nombreDe(r.usuario)} · ${r.usuario.email}` : r.usuario_id} />
          <Dato etiqueta="Cargador" valor={r.cargador_id || 'General'} />
          <Dato etiqueta="Desde" valor={fechaHora(r.fecha_hora_inicio)} />
          <Dato etiqueta="Hasta" valor={fechaHora(r.fecha_hora_fin)} />
          {r.estado === 'pendiente' && <Dato etiqueta="Estado" valor="Esperando pago del usuario" />}
        </ItemLista>
      ))}
    </>
  );
}

type FiltroFecha = 'todos' | 'dia' | 'mes' | 'anio';

export function NotificacionesAdmin({ version }: PropsAdmin) {
  const { datos: notificaciones, cargando, error } = useCarga(listarNotificacionesAdmin, [] as AdminNotificacion[], [version]);
  const [filtro, setFiltro] = useState<FiltroFecha>('todos');
  const filas = useMemo(() => {
    const ahora = new Date();
    return notificaciones.filter((n) => {
      if (filtro === 'todos') return true;
      const f = new Date(n.created_at);
      if (f.getFullYear() !== ahora.getFullYear()) return false;
      if (filtro === 'anio') return true;
      if (f.getMonth() !== ahora.getMonth()) return false;
      return filtro === 'mes' || f.getDate() === ahora.getDate();
    });
  }, [notificaciones, filtro]);

  return (
    <>
      <Chips valor={filtro} onChange={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todas' }, { valor: 'dia', etiqueta: 'Hoy' }, { valor: 'mes', etiqueta: 'Este mes' }, { valor: 'anio', etiqueta: 'Este año' }]} />
      <Dato etiqueta="Total" valor={`${filas.length} notificación${filas.length === 1 ? '' : 'es'}`} />
      {error ? <Alerta texto={error} /> : null}
      {cargando && !notificaciones.length ? <Cargando /> : filas.length === 0 ? <Vacio texto="No hay notificaciones para este filtro." icono="bell-slash" /> : filas.map((n) => (
        <ItemLista key={n.id} titulo={n.titulo} insignia={<Insignia texto={n.tipo} tono="azul" />}>
          <Dato etiqueta="Usuario" valor={`${n.usuario_nombre || 'Usuario eliminado'} · ${n.usuario_email || n.usuario_id}`} />
          <Dato etiqueta="Actividad" valor={n.mensaje} />
          <Dato etiqueta="Fecha" valor={fechaHora(n.created_at)} />
        </ItemLista>
      ))}
    </>
  );
}

export function CalificacionesAdmin({ version }: PropsAdmin) {
  const { datos: calificaciones, cargando, error } = useCarga(listarCalificacionesAdmin, [] as CalificacionAdmin[], [version]);
  return (
    <>
      {error ? <Alerta texto={error} /> : null}
      {cargando && !calificaciones.length ? <Cargando /> : calificaciones.length === 0 ? <Vacio texto="No hay calificaciones registradas." icono="star" /> : calificaciones.map((c) => (
        <ItemLista key={c.id} titulo={c.estacion_nombre || c.estacion_ocm_id} insignia={<Estrellas valor={c.puntaje} tamano={13} />}>
          <Dato etiqueta="Usuario" valor={c.usuario_nombre || c.usuario_id} />
          <Dato etiqueta="Comentario" valor={c.comentario || 'Sin comentario'} />
          <Dato etiqueta="Fecha" valor={fechaHora(c.fecha)} />
        </ItemLista>
      ))}
    </>
  );
}

export function ContactosAdmin({ version }: PropsAdmin) {
  const { datos: contactos, cargando, error, recargar } = useCarga(listarContactosAdmin, [] as ContactoAdmin[], [version]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState('');

  const responder = async (id: string) => {
    if (!respuesta.trim()) return;
    await ejecutarAdmin(() => responderContactoAdmin(id, respuesta.trim()), recargar, 'Respuesta enviada correctamente.');
    setAbierto(null);
    setRespuesta('');
  };

  return (
    <>
      {error ? <Alerta texto={error} /> : null}
      {cargando && !contactos.length ? <Cargando /> : contactos.length === 0 ? <Vacio texto="No hay mensajes de contacto." icono="envelope" /> : contactos.map((c) => {
        const respondido = Boolean(c.respuesta?.trim());
        return (
          <ItemLista
            key={c.id}
            titulo={`${c.nombre} ${c.apellido || ''}`.trim()}
            insignia={<Insignia texto={respondido ? 'Respondido' : 'Pendiente'} tono={respondido ? 'verde' : 'azul'} />}
            acciones={!respondido && abierto !== c.id ? <Boton titulo="Responder" pequeno variante="soft" icono="reply" onPress={() => { setAbierto(c.id); setRespuesta(''); }} /> : undefined}
          >
            <Dato etiqueta="Correo" valor={c.correo} />
            <Dato etiqueta="Mensaje" valor={c.mensaje} />
            <Dato etiqueta="Fecha" valor={fechaHora(c.fecha_envio)} />
            {respondido && <Dato etiqueta="Respuesta" valor={c.respuesta} />}
            {abierto === c.id && !respondido && (
              <View style={{ marginTop: 8 }}>
                <CampoTexto value={respuesta} onChangeText={setRespuesta} placeholder="Escribe la respuesta" multiline />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Boton titulo="Enviar" pequeno icono="paper-plane" disabled={!respuesta.trim()} onPress={() => void responder(c.id)} />
                  <Boton titulo="Cancelar" pequeno variante="outline" onPress={() => setAbierto(null)} />
                </View>
              </View>
            )}
          </ItemLista>
        );
      })}
    </>
  );
}
