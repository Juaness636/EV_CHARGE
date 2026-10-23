// Reseñas que los usuarios dejaron en las estaciones de la empresa, con filtro por puntaje.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { listarResenas, type ResenasEmpresa } from '../../api/empresa.api';
import { Aviso, Boton, Selector, Tarjeta, Vacio, estilos, fecha, mensajeError } from './componentes';

const POR_PAGINA = 20;
const estrellas = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

export const ResenasTab: React.FC = () => {
  const [datos, setDatos] = useState<ResenasEmpresa | null>(null);
  const [puntaje, setPuntaje] = useState('');
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    setDatos(null);
    listarResenas({ puntaje: puntaje ? Number(puntaje) : undefined, page: pagina, limit: POR_PAGINA })
      .then(setDatos)
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar las reseñas.')));
  }, [puntaje, pagina]);

  if (error) return <Aviso tipo="error" texto={error} />;

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1;

  return (
    <View>
      <Tarjeta>
        <Text style={[estilos.kpiValor, { color: Colors.warning }]}>
          {datos?.promedio != null ? `${datos.promedio.toFixed(1)} ★` : '—'}
        </Text>
        <Text style={estilos.textoSuave}>{datos?.total_general ?? 0} reseñas en total</Text>
        {datos
          ? [5, 4, 3, 2, 1].map((n) => (
              <Text key={n} style={estilos.textoSuave}>
                {estrellas(n)} {datos.distribucion[String(n)] ?? 0}
              </Text>
            ))
          : null}
      </Tarjeta>

      <Selector
        opciones={[{ valor: '', texto: 'Todas' }, ...[5, 4, 3, 2, 1].map((n) => ({ valor: String(n), texto: `${n} ★` }))]}
        valor={puntaje}
        onChange={(v) => {
          setPuntaje(v);
          setPagina(1);
        }}
      />

      {!datos ? (
        <ActivityIndicator color={Colors.greenEv} />
      ) : datos.resultados.length === 0 ? (
        <Vacio texto="No hay reseñas con este filtro." />
      ) : (
        datos.resultados.map((r) => (
          <Tarjeta key={r.id}>
            <View style={estilos.filaEntre}>
              <Text style={[estilos.texto, { fontWeight: '800', flexShrink: 1 }]}>{r.estacion_nombre}</Text>
              <Text style={{ color: Colors.warning }}>{estrellas(r.puntaje)}</Text>
            </View>
            <Text style={estilos.textoSuave}>{r.usuario_nombre} · {fecha(r.fecha)}</Text>
            {r.comentario ? <Text style={[estilos.texto, { marginTop: 6 }]}>{r.comentario}</Text> : null}
          </Tarjeta>
        ))
      )}

      {paginas > 1 ? (
        <View style={[estilos.filaEntre, { marginTop: 4 }]}>
          <Boton texto="Anterior" deshabilitado={pagina <= 1} onPress={() => setPagina((p) => p - 1)} />
          <Text style={estilos.textoSuave}>Página {pagina} de {paginas}</Text>
          <Boton texto="Siguiente" deshabilitado={pagina >= paginas} onPress={() => setPagina((p) => p + 1)} />
        </View>
      ) : null}
    </View>
  );
};
