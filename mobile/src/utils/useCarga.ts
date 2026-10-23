// Carga datos asíncronos con estado de carga/error y recarga manual.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mensajeError } from '../api/httpClient';
import { listarEstacionesMapa } from '../api/mapa.api';
import type { EstacionOCM } from '../features/mapa/types';

export function useCarga<T>(cargar: () => Promise<T>, inicial: T, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T>(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const ultima = useRef(0);

  const recargar = useCallback(async () => {
    const id = ++ultima.current;
    setCargando(true);
    setError('');
    try {
      const resultado = await cargar();
      if (id === ultima.current) setDatos(resultado);
    } catch (e) {
      if (id === ultima.current) setError(mensajeError(e, 'No se pudo cargar la información.'));
    } finally {
      if (id === ultima.current) setCargando(false);
    }
  }, deps);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, setDatos, cargando, error, recargar };
}

// Lista nacional de estaciones (para los selectores de reservas, reportes y calificaciones).
// Reutiliza la caché del mapa para responder de inmediato.
export function useEstacionesMapa(activo = true) {
  const [estaciones, setEstaciones] = useState<EstacionOCM[]>([]);
  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    AsyncStorage.getItem('ev-charge:estaciones:nacional')
      .then((cache) => { if (cache && !cancelado) setEstaciones(JSON.parse(cache) as EstacionOCM[]); })
      .catch(() => undefined);
    listarEstacionesMapa()
      .then((lista) => { if (!cancelado) setEstaciones(lista.filter((e) => e.AddressInfo)); })
      .catch(() => undefined);
    return () => { cancelado = true; };
  }, [activo]);
  return estaciones;
}
