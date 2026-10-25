// Estaciones de la empresa: crear, cambiar estado (con motivo), eliminar y gestionar cargadores.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import {
  TIPOS_CONECTOR,
  actualizarCargador,
  agregarCargador,
  cambiarEstadoEstacion,
  crearEstacion,
  eliminarEstacion,
  listarEstaciones,
  quitarCargador,
  type Cargador,
  type EstacionEmpresa,
  type EstadoEstacion,
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
  etiqueta,
  mensajeError,
  useEmpresa,
  useEstilos,
  useColores,
} from './componentes';
import { EstacionesApi } from './EstacionesApi';
import { FotosEstacion } from './FotosEstacion';
import { ModalQrCargadores } from '../../components/ModalQrCargadores';

type Conector = (typeof TIPOS_CONECTOR)[number];

const OPCIONES_CONECTOR = TIPOS_CONECTOR.map((t) => ({ valor: t, texto: t }));
const OPCIONES_ESTADO: Array<{ valor: EstadoEstacion; texto: string }> = [
  { valor: 'activa', texto: 'Activa' },
  { valor: 'mantenimiento', texto: 'Mantenimiento' },
  { valor: 'inactiva', texto: 'Inactiva' },
];

interface FormCargador {
  tipo: Conector;
  potencia: string;
  bahias: string;
}

const cargadorVacio = (): FormCargador => ({ tipo: 'CCS', potencia: '50', bahias: '1' });

const numeroValido = (texto: string) => {
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// Acción pendiente que espera el motivo del modal.
type Pendiente =
  | { tipo: 'estado'; estacion: EstacionEmpresa; estado: EstadoEstacion }
  | { tipo: 'eliminar'; estacion: EstacionEmpresa };

export const EstacionesTab: React.FC = () => {
  const estilos = useEstilos();
  const colors = useColores();
  const { puedeOperar } = useEmpresa();
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[] | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [qrDe, setQrDe] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = async () => {
    try {
      setEstaciones(await listarEstaciones());
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar las estaciones.'));
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const reemplazar = (actualizada: EstacionEmpresa) =>
    setEstaciones((lista) => (lista || []).map((e) => (e.id === actualizada.id ? actualizada : e)));

  // La acción puede devolver un mensaje más preciso que `ok`.
  const ejecutar = async (accion: () => Promise<string | void>, ok: string) => {
    setError('');
    setExito('');
    try {
      const mensaje = await accion();
      setExito(mensaje || ok);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const confirmarMotivo = async (motivo: string) => {
    if (!pendiente) return;
    const actual = pendiente;
    setPendiente(null);
    if (actual.tipo === 'estado') {
      await ejecutar(async () => {
        reemplazar(await cambiarEstadoEstacion(actual.estacion.id, actual.estado, motivo));
      }, `Estación marcada como ${etiqueta(actual.estado).toLowerCase()}. Las reservas futuras se cancelan si deja de estar activa.`);
    } else {
      await ejecutar(async () => {
        const r = await eliminarEstacion(actual.estacion.id, motivo);
        setEstaciones((lista) => (lista || []).filter((e) => e.id !== actual.estacion.id));
        return `Estación eliminada. Reservas canceladas: ${r.reservas_canceladas}.`;
      }, 'Estación eliminada.');
    }
  };

  const alternarCargador = (estacion: EstacionEmpresa, cargador: Cargador) => {
    if (!cargador.id) return;
    const nuevo = cargador.estado === 'disponible' ? 'fuera_servicio' : 'disponible';
    void ejecutar(async () => {
      reemplazar(await actualizarCargador(estacion.id, cargador.id as string, { estado: nuevo }));
    }, `Cargador #${cargador.numero} ${etiqueta(nuevo).toLowerCase()}.`);
  };

  const borrarCargador = (estacion: EstacionEmpresa, cargador: Cargador) => {
    if (!cargador.id) return;
    Alert.alert('Quitar cargador', `¿Quitar el cargador #${cargador.numero}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () =>
          void ejecutar(async () => {
            reemplazar(await quitarCargador(estacion.id, cargador.id as string));
          }, 'Cargador quitado.'),
      },
    ]);
  };

  if (!estaciones && !error) return <ActivityIndicator color={colors.primary} />;

  return (
    <View>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {exito ? <Aviso tipo="exito" texto={exito} /> : null}

      {creando ? (
        <NuevaEstacion
          onCancelar={() => setCreando(false)}
          onCreada={(e) => {
            setEstaciones((lista) => [e, ...(lista || [])]);
            setCreando(false);
            setExito('Estación creada. Ya aparece en el mapa.');
          }}
        />
      ) : (
        <View style={{ marginBottom: 12 }}>
          <Boton texto="+ Nueva estación" variante="primario" deshabilitado={!puedeOperar} onPress={() => setCreando(true)} />
        </View>
      )}

      {(estaciones || []).length === 0 ? <Vacio texto="Aún no tienes estaciones." /> : null}

      {(estaciones || []).map((estacion) => {
        const expandida = abierta === estacion.id;
        return (
          <Tarjeta key={estacion.id}>
            <View style={estilos.filaEntre}>
              <View style={{ flexShrink: 1 }}>
                <Text style={[estilos.texto, { fontWeight: '800' }]}>{estacion.nombre}</Text>
                <Text style={estilos.textoSuave}>{estacion.direccion}</Text>
              </View>
              <Insignia estado={estacion.estado} />
            </View>
            <Text style={estilos.textoSuave}>
              Cargadores disponibles {estacion.cargadores_disponibles}/{estacion.total_cargadores} · Incidentes abiertos{' '}
              {estacion.incidentes_abiertos}
            </Text>

            <View style={estilos.fila}>
              <Boton texto={expandida ? 'Ocultar' : 'Gestionar'} onPress={() => setAbierta(expandida ? null : estacion.id)} />
              <Boton texto="QR de cargadores" onPress={() => setQrDe({ id: estacion.id, nombre: estacion.nombre })} />
            </View>

            {expandida ? (
              <View>
                <View style={estilos.separador} />
                <Text style={estilos.campoEtiqueta}>Estado de la estación</Text>
                <Selector
                  opciones={OPCIONES_ESTADO}
                  valor={estacion.estado}
                  onChange={(estado) => {
                    if (!puedeOperar || estado === estacion.estado) return;
                    setPendiente({ tipo: 'estado', estacion, estado });
                  }}
                />

                <Text style={estilos.campoEtiqueta}>Cargadores</Text>
                {estacion.cargadores.map((c) => (
                  <View key={c.id ?? `legado-${c.numero}`} style={[estilos.filaEntre, { marginBottom: 8 }]}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={estilos.texto}>
                        #{c.numero} · {c.tipo_conector} · {c.potencia_kw} kW · {c.bahias} bahía(s)
                      </Text>
                      <Insignia estado={c.estado} />
                    </View>
                    {c.id ? (
                      <View style={{ gap: 6 }}>
                        <Boton
                          texto={c.estado === 'disponible' ? 'Fuera de servicio' : 'Habilitar'}
                          deshabilitado={!puedeOperar}
                          onPress={() => alternarCargador(estacion, c)}
                        />
                        <Boton texto="Quitar" variante="peligro" deshabilitado={!puedeOperar} onPress={() => borrarCargador(estacion, c)} />
                      </View>
                    ) : null}
                  </View>
                ))}

                {puedeOperar ? (
                  <NuevoCargador
                    siguienteNumero={Math.max(0, ...estacion.cargadores.map((c) => c.numero)) + 1}
                    onAgregar={async (payload) => {
                      await ejecutar(async () => {
                        reemplazar(await agregarCargador(estacion.id, payload));
                      }, 'Cargador agregado.');
                    }}
                  />
                ) : null}

                <View style={estilos.separador} />
                <FotosEstacion estacion={estacion} onCambio={reemplazar} />

                <View style={estilos.separador} />
                <Boton
                  texto="Eliminar estación"
                  variante="peligro"
                  deshabilitado={!puedeOperar}
                  onPress={() => setPendiente({ tipo: 'eliminar', estacion })}
                />
              </View>
            ) : null}
          </Tarjeta>
        );
      })}

      <EstacionesApi />
      <ModalQrCargadores estacion={qrDe} como="empresa" onCerrar={() => setQrDe(null)} />

      <MotivoModal
        visible={pendiente !== null}
        titulo={pendiente?.tipo === 'eliminar' ? 'Eliminar estación' : 'Cambiar estado'}
        onCancelar={() => setPendiente(null)}
        onConfirmar={confirmarMotivo}
      />
    </View>
  );
};

const NuevoCargador: React.FC<{
  siguienteNumero: number;
  onAgregar: (payload: { numero: number; tipo_conector: string; potencia_kw: number; bahias: number }) => Promise<void>;
}> = ({ siguienteNumero, onAgregar }) => {
  const estilos = useEstilos();
  const colors = useColores();
  const [form, setForm] = useState<FormCargador>(cargadorVacio());
  const [enviando, setEnviando] = useState(false);
  const potencia = numeroValido(form.potencia);
  const bahias = parseInt(form.bahias, 10);
  const valido = potencia > 0 && bahias >= 1;

  const agregar = async () => {
    setEnviando(true);
    try {
      await onAgregar({ numero: siguienteNumero, tipo_conector: form.tipo, potencia_kw: potencia, bahias });
      setForm(cargadorVacio());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={estilos.campoEtiqueta}>Agregar cargador #{siguienteNumero}</Text>
      <Selector opciones={OPCIONES_CONECTOR} valor={form.tipo} onChange={(tipo) => setForm({ ...form, tipo })} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Potencia (kW)" keyboardType="decimal-pad" value={form.potencia} onChangeText={(potencia) => setForm({ ...form, potencia })} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Bahías" keyboardType="number-pad" value={form.bahias} onChangeText={(b) => setForm({ ...form, bahias: b })} />
        </View>
      </View>
      <Boton texto="Agregar cargador" deshabilitado={!valido} cargando={enviando} onPress={() => void agregar()} />
    </View>
  );
};

const NuevaEstacion: React.FC<{ onCancelar: () => void; onCreada: (e: EstacionEmpresa) => void }> = ({ onCancelar, onCreada }) => {
  const estilos = useEstilos();
  const colors = useColores();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargadores, setCargadores] = useState<FormCargador[]>([cargadorVacio()]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const latN = numeroValido(lat);
  const lonN = numeroValido(lon);
  const coordenadasOk = latN >= -90 && latN <= 90 && lonN >= -180 && lonN <= 180;
  const cargadoresOk = cargadores.every((c) => numeroValido(c.potencia) > 0 && parseInt(c.bahias, 10) >= 1);
  const valido = nombre.trim().length >= 3 && coordenadasOk && cargadoresOk && cargadores.length > 0;

  const editar = (i: number, cambio: Partial<FormCargador>) =>
    setCargadores((lista) => lista.map((c, j) => (j === i ? { ...c, ...cambio } : c)));

  const guardar = async () => {
    setEnviando(true);
    setError('');
    try {
      const creada = await crearEstacion({
        nombre: nombre.trim(),
        direccion: direccion.trim() || undefined,
        lat: latN,
        lon: lonN,
        descripcion: descripcion.trim() || undefined,
        cargadores: cargadores.map((c, i) => ({
          numero: i + 1,
          tipo_conector: c.tipo,
          potencia_kw: numeroValido(c.potencia),
          bahias: parseInt(c.bahias, 10),
        })),
      });
      onCreada(creada);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear la estación.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta>
      <Titulo>Nueva estación</Titulo>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Latitud" keyboardType="numbers-and-punctuation" value={lat} onChangeText={setLat} placeholder="4.6097" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Longitud" keyboardType="numbers-and-punctuation" value={lon} onChangeText={setLon} placeholder="-74.0817" />
        </View>
      </View>
      <Campo etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} multiline />

      {cargadores.map((c, i) => (
        <View key={i}>
          <View style={estilos.separador} />
          <View style={estilos.filaEntre}>
            <Text style={estilos.campoEtiqueta}>Cargador #{i + 1}</Text>
            {cargadores.length > 1 ? (
              <Boton texto="Quitar" variante="peligro" onPress={() => setCargadores((l) => l.filter((_, j) => j !== i))} />
            ) : null}
          </View>
          <Selector opciones={OPCIONES_CONECTOR} valor={c.tipo} onChange={(tipo) => editar(i, { tipo })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Potencia (kW)" keyboardType="decimal-pad" value={c.potencia} onChangeText={(potencia) => editar(i, { potencia })} />
            </View>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Bahías" keyboardType="number-pad" value={c.bahias} onChangeText={(bahias) => editar(i, { bahias })} />
            </View>
          </View>
        </View>
      ))}

      <View style={estilos.fila}>
        <Boton texto="+ Cargador" onPress={() => setCargadores((l) => [...l, cargadorVacio()])} />
        <Boton texto="Cancelar" onPress={onCancelar} />
        <Boton texto="Crear estación" variante="primario" deshabilitado={!valido} cargando={enviando} onPress={() => void guardar()} />
      </View>
    </Tarjeta>
  );
};
