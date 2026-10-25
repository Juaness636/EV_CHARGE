// Estaciones del mapa (OpenChargeMap) que el admin le asignó a la empresa con palabras clave.
// La empresa no las crea ni las borra: solo ve cuáles son suyas, les cambia el estado y sube fotos.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  cambiarEstadoEstacionApiEmpresa,
  eliminarFotoEstacionApi,
  listarEstacionesApiEmpresa,
  subirFotoEstacionApi,
  type EstacionApiEmpresa,
  type FotoEstacion,
} from '../../api/empresa.api';
import { EditorFotos } from '../../components/EditorFotos';
import { ModalQrCargadores } from '../../components/ModalQrCargadores';
import { Aviso, Boton, Insignia, Selector, Tarjeta, Titulo, Vacio, etiqueta, mensajeError, useColores, useEmpresa, useEstilos } from './componentes';

const OPCIONES_ESTADO: Array<{ valor: EstacionApiEmpresa['estado']; texto: string }> = [
  { valor: 'activa', texto: 'Activa' },
  { valor: 'mantenimiento', texto: 'Mantenimiento' },
  { valor: 'inactiva', texto: 'Inactiva' },
];

export const EstacionesApi: React.FC = () => {
  const estilos = useEstilos();
  const colors = useColores();
  const { perfil, puedeOperar } = useEmpresa();
  const [estaciones, setEstaciones] = useState<EstacionApiEmpresa[] | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [qrDe, setQrDe] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    listarEstacionesApiEmpresa()
      .then(setEstaciones)
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar las estaciones del mapa.')));
  }, []);

  const cambiar = async (estacion: EstacionApiEmpresa, estado: EstacionApiEmpresa['estado']) => {
    if (!puedeOperar || estado === estacion.estado) return;
    setError('');
    setExito('');
    try {
      await cambiarEstadoEstacionApiEmpresa(estacion.id, estado);
      setEstaciones((lista) => (lista || []).map((e) => (e.id === estacion.id ? { ...e, estado } : e)));
      setExito(`${estacion.nombre} quedó ${etiqueta(estado).toLowerCase()}.`);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const ponerFotos = (id: string, fotos: FotoEstacion[]) =>
    setEstaciones((lista) => (lista || []).map((e) => (e.id === id ? { ...e, fotos } : e)));

  return (
    <View style={{ marginTop: 12 }}>
      <Titulo>Estaciones del mapa asignadas</Titulo>
      <Text style={[estilos.textoSuave, { marginBottom: 8 }]}>
        {perfil?.palabras_clave
          ? `Son las estaciones del mapa cuyo nombre u operador contiene: ${perfil?.palabras_clave}.`
          : 'El administrador aún no te asignó palabras clave, así que no tienes estaciones del mapa.'}
      </Text>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {exito ? <Aviso tipo="exito" texto={exito} /> : null}
      {!estaciones && !error ? <ActivityIndicator color={colors.primary} /> : null}
      {estaciones && estaciones.length === 0 && perfil?.palabras_clave ? <Vacio texto="Ninguna estación del mapa coincide con tus palabras clave." /> : null}
      {(estaciones || []).map((estacion) => (
        <Tarjeta key={estacion.id}>
          <View style={estilos.filaEntre}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[estilos.texto, { fontWeight: '800' }]}>{estacion.nombre}</Text>
              <Text style={estilos.textoSuave}>{[estacion.direccion, estacion.ciudad].filter(Boolean).join(' · ')}</Text>
            </View>
            <Insignia estado={estacion.estado} />
          </View>
          <Text style={estilos.textoSuave}>Operador: {estacion.operador} · {estacion.conectores} conector(es)</Text>
          <Text style={estilos.campoEtiqueta}>Estado en el mapa</Text>
          <Selector opciones={OPCIONES_ESTADO} valor={estacion.estado} onChange={(estado) => void cambiar(estacion, estado)} />
          <View style={estilos.fila}>
            <Boton texto="QR de cargadores" onPress={() => setQrDe({ id: estacion.id, nombre: estacion.nombre })} />
          </View>
          <View style={estilos.separador} />
          <EditorFotos
            fotos={estacion.fotos || []}
            puedeEditar={puedeOperar}
            onSubir={async (foto) => ponerFotos(estacion.id, await subirFotoEstacionApi(estacion.id, foto))}
            onQuitar={async (foto) => ponerFotos(estacion.id, await eliminarFotoEstacionApi(estacion.id, foto.id))}
          />
        </Tarjeta>
      ))}
      <ModalQrCargadores estacion={qrDe} como="empresa" onCerrar={() => setQrDe(null)} />
    </View>
  );
};
