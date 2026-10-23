// Utilidades compartidas por los paneles del administrador. Viven aparte de
// AdminPaneles.tsx para que los paneles que este importa (EmpresasAdmin) no formen
// un ciclo de imports con él.
import { mensajeError } from '../../../api/httpClient';
import { emitir } from '../../../utils/eventos';
import { notificar } from '../../../components/Notificaciones';

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
