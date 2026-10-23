// Paneles de consulta del dashboard de usuario: Inicio, Compras, Cargas y Favoritos.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listarVehiculos } from '../../../api/vehiculos.api';
import { misReservas } from '../../../api/reservas.api';
import { listarMetodosPago } from '../../../api/metodosPago.api';
import { listarFavoritos, quitarFavorito, type Favorito } from '../../../api/favoritos.api';
import { listarCompras } from '../../../api/compras.api';
import { estadisticasCargas, listarCargas } from '../../../api/cargas.api';
import { obtenerEstadoEstacion } from '../../../api/estado.api';
import { mensajeError } from '../../../api/httpClient';
import { useTheme } from '../../../theme/ThemeContext';
import { etiquetaEstado } from '../../../utils/estaciones';
import { fechaHora, pesos } from '../../../utils/formato';
import { useCarga } from '../../../utils/useCarga';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { Alerta, Boton, Cargando, Dato, Icono, Insignia, ItemLista, KPI, Tarjeta, tonoEstado, Vacio } from '../../../components/ui';
import type { PropsPanel } from '../tipos';

export const totalReservasPagadas = (reservas: Array<{ estado?: string; costo_pagado?: number }>) =>
  reservas.filter((r) => r.estado !== 'cancelada').reduce((t, r) => t + Number(r.costo_pagado || 0), 0);

export function AvisoVehiculo({ texto, onRegistrar }: { texto: string; onRegistrar: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.aviso, { borderColor: colors.warning, backgroundColor: colors.warningSoft }]}>
      <Icono name="car" size={16} color={colors.warning} />
      <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{texto}</Text>
      <Boton titulo="Registrar vehículo" pequeno variante="outline" onPress={onRegistrar} />
    </View>
  );
}

export function InicioPanel({ version, irA }: PropsPanel) {
  const { colors } = useTheme();
  const { datos, cargando, error } = useCarga(async () => {
    const [vehiculos, reservas, pagos, compras, favoritos] = await Promise.all([listarVehiculos(), misReservas(), listarMetodosPago(), listarCompras(), listarFavoritos()]);
    return { vehiculos, reservas, pagos, compras, favoritos };
  }, null, [version]);

  if (cargando && !datos) return <Cargando />;
  if (error) return <Alerta texto={error} />;
  if (!datos) return null;
  const activas = datos.reservas.filter((r) => r.estado !== 'cancelada');
  const gastado = datos.compras.reduce((t, c) => t + Number(c.monto || 0), 0) + totalReservasPagadas(datos.reservas);

  return (
    <>
      <View style={styles.kpis}>
        <KPI etiqueta="Vehículos" valor={datos.vehiculos.length} icono="car" />
        <KPI etiqueta="Reservas" valor={activas.length} icono="calendar-check" />
        <KPI etiqueta="Métodos de pago" valor={datos.pagos.length} icono="credit-card" />
        <KPI etiqueta="Compras" valor={datos.compras.length} icono="bag-shopping" />
        <KPI etiqueta="Favoritos" valor={datos.favoritos.length} icono="star" />
        <KPI etiqueta="Gastado" valor={pesos(gastado)} icono="wallet" />
      </View>
      {datos.vehiculos.length === 0 && <AvisoVehiculo texto="Registra tu vehículo para ver estaciones compatibles y reservar cargadores." onRegistrar={() => irA('Vehículos')} />}
      <Tarjeta style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Actividad reciente</Text>
        {datos.reservas.length === 0 ? <Vacio texto="Todavía no tienes reservas. Reserva un cargador desde el mapa." icono="calendar" /> : datos.reservas.slice(0, 5).map((r) => (
          <View key={r.id} style={[styles.fila, { borderTopColor: colors.border }]}>
            <Icono name="bolt" size={13} color={colors.primary} />
            <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>{r.estacion_nombre || r.estacion_ocm_id}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>{fechaHora(r.fecha_hora_inicio)}</Text>
          </View>
        ))}
      </Tarjeta>
    </>
  );
}

export function ComprasPanel({ version, irA }: PropsPanel) {
  const { colors } = useTheme();
  const { datos, cargando, error } = useCarga(async () => {
    const [compras, vehiculos] = await Promise.all([listarCompras(), listarVehiculos()]);
    return { compras, vehiculos };
  }, null, [version]);
  if (cargando && !datos) return <Cargando />;
  if (error) return <Alerta texto={error} />;
  if (!datos) return null;
  const total = datos.compras.reduce((t, c) => t + Number(c.monto || 0), 0);
  return (
    <>
      <Tarjeta><Text style={{ color: colors.textMuted }}>Aquí encontrarás los productos adquiridos mediante el pago simulado de EV Charge.</Text></Tarjeta>
      <View style={styles.kpis}>
        <KPI etiqueta="Compras registradas" valor={datos.compras.length} icono="bag-shopping" />
        <KPI etiqueta="Total gastado en compras" valor={pesos(total)} icono="wallet" />
      </View>
      {datos.vehiculos.length === 0 && <AvisoVehiculo texto="Registra un vehículo para completar los cálculos generales de tu actividad." onRegistrar={() => irA('Vehículos')} />}
      {datos.compras.length === 0 && <Vacio texto="Todavía no tienes compras realizadas." icono="bag-shopping" />}
      {datos.compras.map((c) => (
        <ItemLista key={c.id} titulo={c.producto} insignia={<Insignia texto="Compra aprobada" tono="verde" />}>
          <Dato etiqueta="Valor" valor={pesos(c.monto)} />
          <Dato etiqueta="Pago" valor={c.metodo} />
          <Dato etiqueta="Fecha" valor={fechaHora(c.created_at)} />
          <Dato etiqueta="Transacción" valor={c.transaccion_id} />
        </ItemLista>
      ))}
    </>
  );
}

export function CargasPanel({ version }: PropsPanel) {
  const { datos, cargando, error } = useCarga(async () => {
    const [cargas, estadisticas] = await Promise.all([listarCargas(), estadisticasCargas()]);
    return { cargas, estadisticas };
  }, null, [version]);
  if (cargando && !datos) return <Cargando />;
  if (error) return <Alerta texto={error} />;
  if (!datos) return null;
  return (
    <>
      <View style={styles.kpis}>
        <KPI etiqueta="Sesiones validadas" valor={datos.estadisticas.total_cargas} icono="plug-circle-check" />
        <KPI etiqueta="Energía validada" valor={`${datos.estadisticas.total_kwh} kWh`} icono="bolt" />
        <KPI etiqueta="Costo validado" valor={pesos(datos.estadisticas.total_costo)} icono="receipt" />
      </View>
      {datos.cargas.length === 0 && <Vacio texto="Todavía no tienes cargas registradas." icono="charging-station" />}
      {datos.cargas.map((c) => (
        <ItemLista key={c.id} titulo={c.estacion_nombre || c.estacion_ocm_id} insignia={<Insignia texto={c.estado} tono={tonoEstado(c.estado)} />}>
          <Dato etiqueta="Energía" valor={`${c.kwh_cargados} kWh`} />
          <Dato etiqueta="Costo" valor={pesos(c.costo_estimado)} />
          <Dato etiqueta="Fecha" valor={fechaHora(c.fecha)} />
        </ItemLista>
      ))}
    </>
  );
}

export function FavoritosPanel({ version }: PropsPanel) {
  const router = useRouter();
  const [estados, setEstados] = useState<Record<string, string>>({});
  const { datos: favoritos, cargando, error, recargar } = useCarga(listarFavoritos, [] as Favorito[], [version]);

  useEffect(() => {
    let cancelado = false;
    Promise.all(favoritos.map(async (f) => {
      try {
        return [f.estacion_ocm_id, String((await obtenerEstadoEstacion(f.estacion_ocm_id)).estado || 'disponible')] as const;
      } catch {
        return [f.estacion_ocm_id, 'disponible'] as const;
      }
    })).then((r) => !cancelado && setEstados(Object.fromEntries(r)));
    return () => { cancelado = true; };
  }, [favoritos]);

  const quitar = async (f: Favorito) => {
    if (!(await confirmar({ titulo: 'Quitar favorito', mensaje: `¿Deseas quitar ${f.estacion_nombre || 'esta estación'} de tus favoritos?`, confirmarTexto: 'Quitar favorito' }))) return;
    try {
      await quitarFavorito(f.estacion_ocm_id);
      notificar({ tipo: 'success', titulo: 'Favorito eliminado', mensaje: `${f.estacion_nombre || 'La estación'} se quitó de tus favoritos.` });
      await recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Favoritos', mensaje: mensajeError(e) });
    }
  };

  if (cargando && !favoritos.length) return <Cargando />;
  if (error) return <Alerta texto={error} />;
  return (
    <>
      {favoritos.length === 0 && <Vacio texto="No tienes estaciones favoritas. Guárdalas desde el mapa con el botón Favorito." icono="star" />}
      {favoritos.map((f) => {
        const estado = estados[f.estacion_ocm_id] || 'disponible';
        return (
          <ItemLista
            key={f.id}
            titulo={f.estacion_nombre || 'Estación guardada'}
            insignia={<Insignia texto={etiquetaEstado(estado)} tono={tonoEstado(estado)} />}
            acciones={<>
              <Boton titulo="Ver en mapa" icono="map-location-dot" pequeno variante="soft" onPress={() => router.push({ pathname: '/mapa', params: { estacion: f.estacion_ocm_id } })} />
              <Boton titulo="Quitar" pequeno variante="danger" onPress={() => void quitar(f)} />
            </>}
          >
            <Dato etiqueta="ID de estación" valor={f.estacion_ocm_id} />
          </ItemLista>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, flexWrap: 'wrap' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1 },
});
