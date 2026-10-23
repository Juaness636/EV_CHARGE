// Reportes de los usuarios sobre las estaciones de la empresa e incidentes de mantenimiento.
// Un incidente que bloquea la estación la pasa a mantenimiento; al cerrar el último,
// el backend avisa con `puede_reactivar` y la empresa decide si la vuelve a activar (RN-E07).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';
import {
  cambiarEstadoEstacion,
  cambiarEstadoIncidente,
  cambiarEstadoReporte,
  crearIncidente,
  listarEstaciones,
  listarIncidentes,
  listarReportes,
  reporteAIncidente,
  type EstacionEmpresa,
  type EstadoIncidente,
  type IncidenteEmpresa,
  type PrioridadIncidente,
  type ReporteEmpresa,
} from '../../api/empresa.api';
import {
  Aviso,
  Boton,
  Campo,
  Insignia,
  MotivoModal,
  Selector,
  Tarjeta,
  Titulo,
  Vacio,
  estilos,
  fecha,
  mensajeError,
  useEmpresa,
} from './componentes';

type Vista = 'reportes' | 'incidentes';
type TipoIncidente = 'falla' | 'reparacion' | 'actualizacion';

// Mismas transiciones que TRANSICIONES_INCIDENTE en app/utils/constantes.py.
const SIGUIENTES: Record<EstadoIncidente, Array<{ estado: EstadoIncidente; texto: string }>> = {
  abierto: [
    { estado: 'en_progreso', texto: 'Iniciar' },
    { estado: 'cerrado', texto: 'Cerrar' },
  ],
  en_progreso: [
    { estado: 'resuelto', texto: 'Resolver' },
    { estado: 'cerrado', texto: 'Cerrar' },
  ],
  resuelto: [
    { estado: 'cerrado', texto: 'Cerrar' },
    { estado: 'en_progreso', texto: 'Reabrir' },
  ],
  cerrado: [],
};

export const IncidentesTab: React.FC = () => {
  const { puedeOperar } = useEmpresa();
  const [vista, setVista] = useState<Vista>('reportes');
  const [reportes, setReportes] = useState<ReporteEmpresa[] | null>(null);
  const [incidentes, setIncidentes] = useState<IncidenteEmpresa[] | null>(null);
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[]>([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [creando, setCreando] = useState(false);
  const [reactivar, setReactivar] = useState<IncidenteEmpresa | null>(null);

  const cargar = async () => {
    try {
      const [r, i, e] = await Promise.all([
        listarReportes({ estado: 'abierto', limit: 50 }),
        listarIncidentes({ limit: 50 }),
        listarEstaciones(),
      ]);
      setReportes(r.resultados);
      setIncidentes(i.resultados);
      setEstaciones(e);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los reportes.'));
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const ejecutar = async (accion: () => Promise<void>, ok: string) => {
    setError('');
    setExito('');
    try {
      await accion();
      setExito(ok);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const atenderReporte = (reporte: ReporteEmpresa, estado: 'resuelto' | 'descartado') =>
    void ejecutar(async () => {
      await cambiarEstadoReporte(reporte.id, estado);
      setReportes((lista) => (lista || []).filter((r) => r.id !== reporte.id));
    }, estado === 'resuelto' ? 'Reporte resuelto.' : 'Reporte descartado.');

  const convertirReporte = (reporte: ReporteEmpresa) =>
    void ejecutar(async () => {
      const incidente = await reporteAIncidente(reporte.id);
      setIncidentes((lista) => [incidente, ...(lista || [])]);
      setReportes((lista) => (lista || []).filter((r) => r.id !== reporte.id));
    }, 'Se abrió un incidente a partir del reporte.');

  const moverIncidente = (incidente: IncidenteEmpresa, estado: EstadoIncidente) =>
    void ejecutar(async () => {
      const actualizado = await cambiarEstadoIncidente(incidente.id, estado);
      setIncidentes((lista) => (lista || []).map((i) => (i.id === actualizado.id ? actualizado : i)));
      if (actualizado.puede_reactivar) {
        Alert.alert(
          'Estación sin incidentes',
          `${actualizado.estacion_nombre} ya no tiene incidentes que la bloqueen. ¿Quieres reactivarla?`,
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Reactivar', onPress: () => setReactivar(actualizado) },
          ],
        );
      }
    }, 'Incidente actualizado.');

  const confirmarReactivacion = async (motivo: string) => {
    if (!reactivar) return;
    const incidente = reactivar;
    setReactivar(null);
    await ejecutar(async () => {
      await cambiarEstadoEstacion(incidente.estacion_id, 'activa', motivo);
    }, 'Estación reactivada.');
  };

  if ((!reportes || !incidentes) && !error) return <ActivityIndicator color={Colors.greenEv} />;

  return (
    <View>
      <Selector
        opciones={[
          { valor: 'reportes', texto: `Reportes (${reportes?.length ?? 0})` },
          { valor: 'incidentes', texto: `Incidentes (${incidentes?.length ?? 0})` },
        ]}
        valor={vista}
        onChange={setVista}
      />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {exito ? <Aviso tipo="exito" texto={exito} /> : null}

      {vista === 'reportes' ? (
        (reportes || []).length === 0 ? (
          <Vacio texto="No hay reportes pendientes." />
        ) : (
          (reportes || []).map((r) => (
            <Tarjeta key={r.id}>
              <View style={estilos.filaEntre}>
                <Text style={[estilos.texto, { fontWeight: '800', flexShrink: 1 }]}>{r.estacion_nombre}</Text>
                <Insignia estado={r.estado} />
              </View>
              <Text style={estilos.textoSuave}>{r.tipo} · {r.usuario_nombre} · {fecha(r.fecha)}</Text>
              <Text style={[estilos.texto, { marginTop: 6 }]}>{r.descripcion}</Text>
              <View style={estilos.fila}>
                <Boton texto="Resolver" variante="primario" deshabilitado={!puedeOperar} onPress={() => atenderReporte(r, 'resuelto')} />
                <Boton texto="Abrir incidente" deshabilitado={!puedeOperar} onPress={() => convertirReporte(r)} />
                <Boton texto="Descartar" variante="peligro" deshabilitado={!puedeOperar} onPress={() => atenderReporte(r, 'descartado')} />
              </View>
            </Tarjeta>
          ))
        )
      ) : (
        <View>
          {creando ? (
            <NuevoIncidente
              estaciones={estaciones}
              onCancelar={() => setCreando(false)}
              onCreado={(i) => {
                setIncidentes((lista) => [i, ...(lista || [])]);
                setCreando(false);
                setExito(i.bloquea_estacion ? 'Incidente creado. La estación pasó a mantenimiento.' : 'Incidente creado.');
              }}
            />
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Boton
                texto="+ Nuevo incidente"
                variante="primario"
                deshabilitado={!puedeOperar || estaciones.length === 0}
                onPress={() => setCreando(true)}
              />
            </View>
          )}
          {(incidentes || []).length === 0 ? <Vacio texto="No hay incidentes registrados." /> : null}
          {(incidentes || []).map((i) => (
            <Tarjeta key={i.id}>
              <View style={estilos.filaEntre}>
                <Text style={[estilos.texto, { fontWeight: '800', flexShrink: 1 }]}>{i.titulo}</Text>
                <Insignia estado={i.estado} />
              </View>
              <Text style={estilos.textoSuave}>
                {i.estacion_nombre}
                {i.cargador_numero != null ? ` · Cargador #${i.cargador_numero}` : ''} · {i.tipo} · prioridad {i.prioridad}
                {i.bloquea_estacion ? ' · bloquea la estación' : ''}
              </Text>
              <Text style={estilos.textoSuave}>Desde {fecha(i.fecha_inicio)}</Text>
              {i.descripcion ? <Text style={[estilos.texto, { marginTop: 6 }]}>{i.descripcion}</Text> : null}
              {SIGUIENTES[i.estado].length > 0 ? (
                <View style={estilos.fila}>
                  {SIGUIENTES[i.estado].map((s) => (
                    <Boton key={s.estado} texto={s.texto} deshabilitado={!puedeOperar} onPress={() => moverIncidente(i, s.estado)} />
                  ))}
                </View>
              ) : null}
            </Tarjeta>
          ))}
        </View>
      )}

      <MotivoModal
        visible={reactivar !== null}
        titulo="Reactivar estación"
        onCancelar={() => setReactivar(null)}
        onConfirmar={confirmarReactivacion}
      />
    </View>
  );
};

const NuevoIncidente: React.FC<{
  estaciones: EstacionEmpresa[];
  onCancelar: () => void;
  onCreado: (i: IncidenteEmpresa) => void;
}> = ({ estaciones, onCancelar, onCreado }) => {
  const [estacionId, setEstacionId] = useState(estaciones[0]?.id ?? '');
  const [cargadorId, setCargadorId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoIncidente>('falla');
  const [prioridad, setPrioridad] = useState<PrioridadIncidente>('media');
  const [bloquea, setBloquea] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const estacion = estaciones.find((e) => e.id === estacionId);
  const cargadores = (estacion?.cargadores || []).filter((c) => c.id);

  const guardar = async () => {
    setEnviando(true);
    setError('');
    try {
      onCreado(
        await crearIncidente({
          estacion_id: estacionId,
          cargador_id: cargadorId || undefined,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          tipo,
          prioridad,
          bloquea_estacion: bloquea,
        }),
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear el incidente.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta>
      <Titulo>Nuevo incidente</Titulo>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Text style={estilos.campoEtiqueta}>Estación</Text>
      <Selector
        opciones={estaciones.map((e) => ({ valor: e.id, texto: e.nombre }))}
        valor={estacionId}
        onChange={(id) => {
          setEstacionId(id);
          setCargadorId('');
        }}
      />
      {cargadores.length > 0 ? (
        <>
          <Text style={estilos.campoEtiqueta}>Cargador (opcional)</Text>
          <Selector
            opciones={[{ valor: '', texto: 'Toda la estación' }, ...cargadores.map((c) => ({ valor: c.id ?? '', texto: `#${c.numero}` }))]}
            valor={cargadorId}
            onChange={setCargadorId}
          />
        </>
      ) : null}
      <Campo etiqueta="Título" value={titulo} onChangeText={setTitulo} />
      <Campo etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} multiline />
      <Text style={estilos.campoEtiqueta}>Tipo</Text>
      <Selector
        opciones={[
          { valor: 'falla', texto: 'Falla' },
          { valor: 'reparacion', texto: 'Reparación' },
          { valor: 'actualizacion', texto: 'Actualización' },
        ]}
        valor={tipo}
        onChange={setTipo}
      />
      <Text style={estilos.campoEtiqueta}>Prioridad</Text>
      <Selector
        opciones={[
          { valor: 'baja', texto: 'Baja' },
          { valor: 'media', texto: 'Media' },
          { valor: 'alta', texto: 'Alta' },
        ]}
        valor={prioridad}
        onChange={setPrioridad}
      />
      <View style={estilos.filaEntre}>
        <Text style={estilos.texto}>Bloquea la estación (pasa a mantenimiento)</Text>
        <Switch value={bloquea} onValueChange={setBloquea} trackColor={{ true: Colors.greenEv, false: Colors.borderLight }} />
      </View>
      <View style={estilos.fila}>
        <Boton texto="Cancelar" onPress={onCancelar} />
        <Boton
          texto="Crear incidente"
          variante="primario"
          deshabilitado={!estacionId || titulo.trim().length < 3}
          cargando={enviando}
          onPress={() => void guardar()}
        />
      </View>
    </Tarjeta>
  );
};
