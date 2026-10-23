// Piezas compartidas del panel de empresa móvil: tarjetas, insignias de estado,
// botones, campos y el modal de motivo (RN-E04: cambiar estado o borrar exige motivo).
import React, { createContext, useContext, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';
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
  error instanceof Error && error.message ? error.message : porDefecto;

const ESTADOS_OK = new Set(['activa', 'resuelto', 'cerrado', 'disponible', 'aprobada']);
const ESTADOS_PENDIENTES = new Set(['mantenimiento', 'pendiente', 'abierto', 'en_progreso']);

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
  <View style={[estilos.tarjeta, style]}>{children}</View>
);

export const Titulo: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Text style={estilos.titulo}>{children}</Text>
);

export const Insignia: React.FC<{ estado: string }> = ({ estado }) => {
  const color = ESTADOS_OK.has(estado) ? Colors.success : ESTADOS_PENDIENTES.has(estado) ? Colors.warning : Colors.error;
  return (
    <View style={[estilos.insignia, { borderColor: color }]}>
      <Text style={[estilos.insigniaTexto, { color }]}>{etiqueta(estado)}</Text>
    </View>
  );
};

export const Kpi: React.FC<{ etiqueta: string; valor: string | number }> = ({ etiqueta: texto, valor }) => (
  <View style={estilos.kpi}>
    <Text style={estilos.kpiValor}>{valor}</Text>
    <Text style={estilos.kpiEtiqueta}>{texto}</Text>
  </View>
);

type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export const Boton: React.FC<{
  texto: string;
  onPress: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
}> = ({ texto, onPress, variante = 'secundario', deshabilitado, cargando }) => (
  <TouchableOpacity
    style={[
      estilos.boton,
      variante === 'primario' && estilos.botonPrimario,
      variante === 'peligro' && estilos.botonPeligro,
      (deshabilitado || cargando) && estilos.botonDeshabilitado,
    ]}
    onPress={onPress}
    disabled={deshabilitado || cargando}
    activeOpacity={0.8}
  >
    {cargando ? (
      <ActivityIndicator size="small" color={Colors.white} />
    ) : (
      <Text style={[estilos.botonTexto, variante === 'peligro' && { color: Colors.error }]}>{texto}</Text>
    )}
  </TouchableOpacity>
);

export const Campo: React.FC<TextInputProps & { etiqueta: string }> = ({ etiqueta: texto, style, ...props }) => (
  <View style={{ marginBottom: Spacing.sm }}>
    <Text style={estilos.campoEtiqueta}>{texto}</Text>
    <TextInput placeholderTextColor={Colors.textDim} style={[estilos.campo, style]} {...props} />
  </View>
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
    <View style={estilos.selector}>
      {opciones.map((opcion) => (
        <TouchableOpacity
          key={opcion.valor}
          style={[estilos.opcion, opcion.valor === valor && estilos.opcionActiva]}
          onPress={() => onChange(opcion.valor)}
          activeOpacity={0.8}
        >
          <Text style={[estilos.opcionTexto, opcion.valor === valor && { color: Colors.white }]}>{opcion.texto}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export const Aviso: React.FC<{ tipo: 'error' | 'exito' | 'info'; texto: string }> = ({ tipo, texto }) => (
  <View
    style={[
      estilos.aviso,
      tipo === 'error' && { backgroundColor: Colors.errorBg, borderColor: Colors.error },
      tipo === 'exito' && { backgroundColor: Colors.successBg, borderColor: Colors.success },
    ]}
  >
    <Text style={estilos.avisoTexto}>{texto}</Text>
  </View>
);

export const Vacio: React.FC<{ texto: string }> = ({ texto }) => <Text style={estilos.vacio}>{texto}</Text>;

// Pide un motivo de al menos LONGITUD_MINIMA_MOTIVO caracteres antes de confirmar.
export const MotivoModal: React.FC<{
  visible: boolean;
  titulo: string;
  ayuda?: string;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}> = ({ visible, titulo, ayuda, onCancelar, onConfirmar }) => {
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={estilos.fondoModal}>
        <View style={estilos.modal}>
          <Titulo>{titulo}</Titulo>
          <Text style={estilos.ayuda}>
            {ayuda || `Escribe el motivo (mínimo ${LONGITUD_MINIMA_MOTIVO} caracteres). Queda en el historial.`}
          </Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            multiline
            numberOfLines={3}
            placeholder="Motivo"
            placeholderTextColor={Colors.textDim}
            style={[estilos.campo, { minHeight: 80, textAlignVertical: 'top' }]}
          />
          <View style={estilos.fila}>
            <Boton texto="Cancelar" onPress={() => { setMotivo(''); onCancelar(); }} />
            <Boton texto="Confirmar" variante="primario" deshabilitado={!valido} cargando={enviando} onPress={() => void confirmar()} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  titulo: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  texto: {
    color: Colors.text,
    fontSize: 14,
  },
  textoSuave: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  filaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insignia: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  insigniaTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpi: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  kpiValor: {
    color: Colors.greenEv,
    fontSize: 22,
    fontWeight: '900',
  },
  kpiEtiqueta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  boton: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  botonPrimario: {
    backgroundColor: Colors.greenEv,
    borderColor: Colors.greenEv,
  },
  botonPeligro: {
    borderColor: Colors.error,
  },
  botonDeshabilitado: {
    opacity: 0.45,
  },
  botonTexto: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  campoEtiqueta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  campo: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    color: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  selector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  opcion: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  opcionActiva: {
    backgroundColor: Colors.greenEv,
    borderColor: Colors.greenEv,
  },
  opcionTexto: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  aviso: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  avisoTexto: {
    color: Colors.text,
    fontSize: 13,
  },
  vacio: {
    color: Colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGreen,
    padding: Spacing.lg,
  },
  ayuda: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  separador: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
});
