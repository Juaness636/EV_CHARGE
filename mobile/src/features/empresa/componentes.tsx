// Piezas compartidas del panel de empresa móvil. Envuelven el kit de UI de la app (components/ui)
// para que el panel siga el tema claro/oscuro, e incluyen el modal de motivo
// (RN-E04: cambiar estado o borrar exige motivo).
import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { mensajeError as mensajeHttp } from '../../api/httpClient';
import { Alerta, AppModal, Boton as BotonUI, CampoTexto, Chips, Insignia as InsigniaUI, KPI, Tarjeta as TarjetaUI, Vacio as VacioUI, tonoEstado } from '../../components/ui';
import { LONGITUD_MINIMA_MOTIVO, type EmpresaPerfil } from '../../api/empresa.api';

// ---------------------------------------------------------------------------
// Contexto: perfil de la empresa y si puede publicar (RN-E11)
// ---------------------------------------------------------------------------

interface EmpresaContexto {
  perfil: EmpresaPerfil | null;
  puedeOperar: boolean;
  refrescarPerfil: () => Promise<void>;
}

export const EmpresaContext = createContext<EmpresaContexto>({
  perfil: null,
  puedeOperar: false,
  refrescarPerfil: async () => {},
});

export const useEmpresa = () => useContext(EmpresaContext);

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

export const fecha = (valor?: string | null) =>
  valor ? new Date(valor).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

export const dinero = (valor: number) =>
  `$${Math.round(valor || 0).toLocaleString('es-CO')}`;

export const mensajeError = (error: unknown, porDefecto = 'No se pudo completar la operación.') =>
  mensajeHttp(error, porDefecto);

const ETIQUETAS: Record<string, string> = {
  activa: 'Activa',
  mantenimiento: 'Mantenimiento',
  inactiva: 'Inactiva',
  disponible: 'Disponible',
  fuera_servicio: 'Fuera de servicio',
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
  aprobada: 'Aprobada',
  pendiente: 'Pendiente',
  suspendida: 'Suspendida',
};

export const etiqueta = (estado: string) => ETIQUETAS[estado] || estado;

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

export const Tarjeta: React.FC<{ children: ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <TarjetaUI style={style}>{children}</TarjetaUI>
);

export const Titulo: React.FC<{ children: ReactNode }> = ({ children }) => {
  const estilos = useEstilos();
  return <Text style={estilos.titulo}>{children}</Text>;
};

// tonoEstado no conoce los estados de incidente y empresa, así que se completan aquí.
const TONOS_EXTRA: Record<string, 'verde' | 'amarillo' | 'rojo' | 'gris'> = {
  cerrado: 'verde',
  en_progreso: 'amarillo',
  pendiente: 'amarillo',
  descartado: 'gris',
  suspendida: 'rojo',
};

export const Insignia: React.FC<{ estado: string }> = ({ estado }) => (
  <InsigniaUI texto={etiqueta(estado)} tono={TONOS_EXTRA[estado] ?? tonoEstado(estado)} />
);

export const Kpi: React.FC<{ etiqueta: string; valor: string | number }> = ({ etiqueta: texto, valor }) => (
  <View style={{ flexBasis: '47%', flexGrow: 1 }}>
    <KPI etiqueta={texto} valor={valor} />
  </View>
);

type VarianteBoton = 'primario' | 'secundario' | 'peligro';
const VARIANTES = { primario: 'primary', secundario: 'outline', peligro: 'danger' } as const;

export const Boton: React.FC<{
  texto: string;
  onPress: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
}> = ({ texto, onPress, variante = 'secundario', deshabilitado, cargando }) => (
  <BotonUI titulo={texto} onPress={onPress} variante={VARIANTES[variante]} disabled={deshabilitado} cargando={cargando} pequeno />
);

export const Campo: React.FC<Omit<TextInputProps, 'style'> & { etiqueta: string }> = ({ etiqueta: texto, ...props }) => (
  <CampoTexto etiqueta={texto} {...props} />
);

export function Selector<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: Array<{ valor: T; texto: string }>;
  valor: T;
  onChange: (valor: T) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Chips opciones={opciones.map((o) => ({ valor: o.valor, etiqueta: o.texto }))} valor={valor} onChange={onChange} />
    </View>
  );
}

const TIPOS_AVISO = { error: 'error', exito: 'success', info: 'info' } as const;

export const Aviso: React.FC<{ tipo: 'error' | 'exito' | 'info'; texto: string }> = ({ tipo, texto }) => (
  <Alerta tipo={TIPOS_AVISO[tipo]} texto={texto} />
);

export const Vacio: React.FC<{ texto: string }> = ({ texto }) => <VacioUI texto={texto} />;

// Pide un motivo de al menos LONGITUD_MINIMA_MOTIVO caracteres antes de confirmar.
export const MotivoModal: React.FC<{
  visible: boolean;
  titulo: string;
  ayuda?: string;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}> = ({ visible, titulo, ayuda, onCancelar, onConfirmar }) => {
  const estilos = useEstilos();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= LONGITUD_MINIMA_MOTIVO;

  const confirmar = async () => {
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
      setMotivo('');
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = () => {
    setMotivo('');
    onCancelar();
  };

  return (
    <AppModal visible={visible} onClose={cancelar} titulo={titulo} anchoMaximo={460}>
      <Text style={estilos.textoSuave}>
        {ayuda || `Escribe el motivo (mínimo ${LONGITUD_MINIMA_MOTIVO} caracteres). Queda en el historial.`}
      </Text>
      <CampoTexto value={motivo} onChangeText={setMotivo} multiline placeholder="Motivo" />
      <View style={estilos.fila}>
        <Boton texto="Cancelar" onPress={cancelar} />
        <Boton texto="Confirmar" variante="primario" deshabilitado={!valido} cargando={enviando} onPress={() => void confirmar()} />
      </View>
    </AppModal>
  );
};

// ---------------------------------------------------------------------------
// Estilos según el tema activo
// ---------------------------------------------------------------------------

const crearEstilos = (c: Palette) =>
  StyleSheet.create({
    titulo: { color: c.text, fontSize: 16, fontWeight: '800', marginBottom: Spacing.sm },
    texto: { color: c.text, fontSize: 14 },
    textoSuave: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
    filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    kpiValor: { color: c.primary, fontSize: 22, fontWeight: '900' },
    campoEtiqueta: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
    separador: { height: 1, backgroundColor: c.border, marginVertical: Spacing.sm },
  });

export const useEstilos = () => useThemedStyles(crearEstilos);
export const useColores = () => useTheme().colors;
