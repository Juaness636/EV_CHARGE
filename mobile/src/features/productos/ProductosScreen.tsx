// Catálogo de productos con búsqueda, filtro por categoría, orden, detalle y compra.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listarMetodosPago, type MetodoPago } from '../../api/metodosPago.api';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { ANCHO_MAXIMO_CONTENIDO, BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../../theme/spacing';
import { pesos } from '../../utils/formato';
import { emitir } from '../../utils/eventos';
import { BarraSuperior } from '../../components/BarraSuperior';
import { ModalPago } from '../../components/ModalPago';
import { notificar } from '../../components/Notificaciones';
import { trasCerrarModal } from '../../components/capas';
import { AppModal, Boton, CampoSelect, CampoTexto, Chips, Icono, Vacio } from '../../components/ui';
import { Presionable } from '../../components/ui/Presionable';
import { Aparecer, Resplandor } from '../../components/animacion';
import { Cuadricula, TextoDegradado, estiloVidrio } from '../../components/efectos';
import { catalogoProductos, categoriasProducto, type CategoriaKey, type ProductoCatalogo } from './productos.data';

type Orden = 'relevancia' | 'precio-menor' | 'precio-mayor' | 'nombre';

export function ProductosScreen() {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { usuario } = useAuth();
  const { abrirAuth } = useUI();
  const params = useLocalSearchParams<{ categoria?: string }>();

  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<'Todas' | CategoriaKey>('Todas');
  const [orden, setOrden] = useState<Orden>('relevancia');
  const [detalle, setDetalle] = useState<ProductoCatalogo | null>(null);
  const [compra, setCompra] = useState<ProductoCatalogo | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);

  useEffect(() => {
    if (params.categoria && categoriasProducto.includes(params.categoria as CategoriaKey)) setCategoria(params.categoria as CategoriaKey);
  }, [params.categoria]);

  const productos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const resultado = catalogoProductos.filter((p) => {
      const porCategoria = categoria === 'Todas' || p.categoria === categoria;
      const porTexto = !texto || [p.nombre, p.desc, p.categoria, p.tipo, p.conector].some((v) => v.toLowerCase().includes(texto));
      return porCategoria && porTexto;
    });
    return [...resultado].sort((a, b) =>
      orden === 'precio-menor' ? a.monto - b.monto : orden === 'precio-mayor' ? b.monto - a.monto : orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es') : 0);
  }, [busqueda, categoria, orden]);

  const seleccionarCategoria = (valor: 'Todas' | CategoriaKey) => {
    setCategoria(valor);
    router.setParams({ categoria: valor === 'Todas' ? undefined : valor });
  };

  const iniciarCompra = async (producto: ProductoCatalogo) => {
    const veniaDeDetalle = detalle !== null;
    setDetalle(null);
    const abrir = (accion: () => void) => (veniaDeDetalle ? trasCerrarModal(accion) : accion());
    if (!usuario) return abrir(() => abrirAuth('login', 'Inicia sesión para continuar con la compra.'));
    const metodos = await listarMetodosPago().catch(() => [] as MetodoPago[]);
    setMetodosPago(metodos);
    abrir(() => setCompra(producto));
  };

  const anchoContenido = Math.min(width, ANCHO_MAXIMO_CONTENIDO);
  const columnas = Math.max(1, Math.min(3, Math.floor(anchoContenido / 340)));

  const escritorio = width >= BREAKPOINT_ESCRITORIO;

  const cabecera = (
    <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
      <View style={[s.portada, escritorio && { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl }]}>
        <LinearGradient
          colors={colors.modo === 'dark' ? ['#0f2a09', '#0a140b', colors.bg2] : ['#dff3d4', '#eef6ea', colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Cuadricula paso={36} />
        <Resplandor diametro={420} intensidad={1.3} style={{ top: -160, right: -120 }} />
        <Aparecer><Text style={s.eyebrow}>Tienda EV Charge</Text></Aparecer>
        <Aparecer retraso={100}>
          <Text style={[s.titulo, escritorio && { fontSize: 40, lineHeight: 46 }]}>
            {categoria === 'Todas' ? 'Equipa tu ' : 'Productos de '}
            <TextoDegradado style={[s.titulo, escritorio && { fontSize: 40, lineHeight: 46 }]}>{categoria === 'Todas' ? 'movilidad eléctrica' : categoria.toLowerCase()}</TextoDegradado>
          </Text>
        </Aparecer>
        <Aparecer retraso={180}><Text style={s.sub}>Cargadores, llantas, baterías y cables seleccionados para vehículos eléctricos, con instalación y garantía en Colombia.</Text></Aparecer>
        <Aparecer retraso={260}>
          <View style={s.ventajas}>
            {[['truck-fast', 'Envío a todo el país'], ['screwdriver-wrench', 'Instalación certificada'], ['shield-halved', 'Garantía oficial']].map(([icono, texto]) => (
              <View key={texto} style={[s.ventaja, estiloVidrio(colors, 10)]}>
                <Icono name={icono} size={12} color={colors.primary} />
                <Text style={s.ventajaTexto}>{texto}</Text>
              </View>
            ))}
          </View>
        </Aparecer>
      </View>
      <View style={[{ gap: Spacing.md }, escritorio && { flexDirection: 'row', alignItems: 'flex-end' }]}>
        <View style={escritorio ? { flex: 1 } : undefined}>
          <CampoTexto icono="magnifying-glass" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar productos..." accessibilityLabel="Buscar productos" />
        </View>
        <View style={escritorio ? { width: 260 } : { maxWidth: 320 }}>
          <CampoSelect
            etiqueta="Ordenar"
            valor={orden}
            onChange={(v) => setOrden(v as Orden)}
            opciones={[
              { valor: 'relevancia', etiqueta: 'Más relevantes' },
              { valor: 'precio-menor', etiqueta: 'Precio: menor a mayor' },
              { valor: 'precio-mayor', etiqueta: 'Precio: mayor a menor' },
              { valor: 'nombre', etiqueta: 'Nombre: A-Z' },
            ]}
          />
        </View>
      </View>
      <Chips
        valor={categoria}
        onChange={seleccionarCategoria}
        opciones={[{ valor: 'Todas', etiqueta: 'Todas', icono: 'border-all' }, ...categoriasProducto.map((c) => ({ valor: c, etiqueta: c, icono: iconoCategoria[c] }))]}
      />
      <Text style={s.conteo}>{productos.length} {productos.length === 1 ? 'producto' : 'productos'}</Text>
    </View>
  );

  return (
    <View style={s.pantalla}>
      <BarraSuperior derecha={<Boton titulo={width >= 600 ? 'Abrir mapa' : 'Mapa'} icono="location-dot" pequeno onPress={() => router.push('/mapa')} />} />
      <FlatList
        key={columnas}
        data={productos}
        numColumns={columnas}
        keyExtractor={(p) => p.nombre}
        ListHeaderComponent={cabecera}
        contentContainerStyle={[s.lista, { maxWidth: ANCHO_MAXIMO_CONTENIDO }]}
        columnWrapperStyle={columnas > 1 ? { gap: 14 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={
          <View>
            <Vacio texto="No encontramos productos con esos filtros." icono="box-open" />
            <Boton titulo="Limpiar filtros" variante="outline" onPress={() => { setBusqueda(''); seleccionarCategoria('Todas'); }} style={{ alignSelf: 'center' }} />
          </View>
        }
        ListFooterComponent={<Text style={s.pie}>© {new Date().getFullYear()} EV Charge · Productos para movilidad eléctrica</Text>}
        renderItem={({ item, index }) => (
          <Aparecer key={`${categoria}-${busqueda}-${orden}-${item.nombre}`} retraso={Math.min(index, 8) * 70} style={{ flex: 1 / columnas }}>
          <Presionable style={s.tarjeta} elevarAlPasar escalaPresion={0.98} onPress={() => setDetalle(item)} accessibilityLabel={`Ver ${item.nombre}`}>
            <View style={s.imagenCaja}>
              <Image source={item.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
              <LinearGradient colors={['transparent', 'transparent', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
              <View style={[s.badge, { left: 12 }]}><Text style={s.badgeTexto}>{item.etiqueta}</Text></View>
              <View style={[s.badge, s.badgeVidrio, { right: 12 }]}><Text style={[s.badgeTexto, { color: '#fff' }]}>{item.categoria}</Text></View>
              <View style={s.potenciaFlotante}>
                <Icono name="bolt" size={11} color={colors.neon} />
                <Text style={s.potenciaTexto}>{item.potencia}</Text>
              </View>
            </View>
            <View style={{ padding: Spacing.md, gap: 8, flex: 1 }}>
              <Text style={s.tipo}>{item.tipo}</Text>
              <Text style={s.nombre}>{item.nombre}</Text>
              <Text style={s.desc} numberOfLines={2}>{item.desc}</Text>
              <View style={s.destacadosFila}>
                {item.destacados.slice(0, 2).map((d) => (
                  <View key={d.texto} style={s.destacadoChip}>
                    <Icono name={d.icono} size={10} color={colors.primary} />
                    <Text style={s.destacadoChipTexto} numberOfLines={1}>{d.texto}</Text>
                  </View>
                ))}
              </View>
              <View style={s.precioFila}>
                <Text style={s.precio}>{pesos(item.monto)}</Text>
                <Text style={s.garantiaMini}><Icono name="shield-halved" size={10} color={colors.textDim} /> {item.garantia}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
                <Boton titulo="Ver ficha" variante="outline" pequeno onPress={() => setDetalle(item)} style={{ flex: 1 }} />
                <Boton titulo="Comprar" pequeno icono="cart-shopping" onPress={() => void iniciarCompra(item)} style={{ flex: 1 }} />
              </View>
            </View>
          </Presionable>
          </Aparecer>
        )}
      />

      <AppModal visible={!!detalle} onClose={() => setDetalle(null)} titulo={detalle?.nombre} anchoMaximo={escritorio ? 980 : 560}>
        {detalle && (
          <View style={[{ gap: Spacing.lg }, escritorio && { flexDirection: 'row', alignItems: 'flex-start' }]}>
            <View style={[{ gap: Spacing.md }, escritorio && { flex: 1.1 }]}>
              <Aparecer desde="escala" duracion={500}>
                <View style={s.detalleImagen}>
                  <Image source={detalle.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
                  <View style={[s.badge, { left: 12 }]}><Text style={s.badgeTexto}>{detalle.etiqueta}</Text></View>
                </View>
              </Aparecer>
              <View style={s.destacadosGrid}>
                {detalle.destacados.map((d, i) => (
                  <Aparecer key={d.texto} retraso={120 + i * 70} style={s.destacadoCaja}>
                    <View style={s.destacadoIcono}><Icono name={d.icono} size={14} color={colors.primary} /></View>
                    <Text style={s.destacadoTexto}>{d.texto}</Text>
                  </Aparecer>
                ))}
              </View>
            </View>
            <View style={[{ gap: Spacing.md }, escritorio && { flex: 1 }]}>
              <View style={{ gap: 6 }}>
                <Text style={s.tipo}>{detalle.tipo} · {detalle.categoria}</Text>
                <Text style={s.desc}>{detalle.detalle}</Text>
              </View>
              <View style={s.fichaCaja}>
                <Text style={s.fichaTitulo}><Icono name="list-check" size={12} color={colors.primary} />  Especificaciones técnicas</Text>
                {detalle.especificaciones.map(([etiqueta, valor], i) => (
                  <View key={etiqueta} style={[s.fichaFila, i % 2 === 0 && { backgroundColor: colors.primarySoft }]}>
                    <Text style={s.fichaEtiqueta}>{etiqueta}</Text>
                    <Text style={s.fichaValor}>{valor}</Text>
                  </View>
                ))}
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[s.fichaTitulo, { paddingHorizontal: 0 }]}><Icono name="box-open" size={12} color={colors.primary} />  En la caja</Text>
                {detalle.incluye.map((x) => (
                  <View key={x} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Icono name="circle-check" size={13} color={colors.primary} style={{ marginTop: 3 }} />
                    <Text style={[s.desc, { flex: 1 }]}>{x}</Text>
                  </View>
                ))}
              </View>
              <View style={s.compraCaja}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fichaEtiqueta}>Precio</Text>
                  <Text style={[s.precio, { fontSize: 24 }]}>{pesos(detalle.monto)}</Text>
                  <Text style={s.garantiaMini}><Icono name="shield-halved" size={10} color={colors.textDim} /> Garantía: {detalle.garantia}</Text>
                </View>
                <Boton titulo="Comprar ahora" icono="cart-shopping" onPress={() => void iniciarCompra(detalle)} />
              </View>
            </View>
          </View>
        )}
      </AppModal>

      <ModalPago
        visible={!!compra}
        tipo="producto"
        tituloItem={compra?.nombre ?? ''}
        monto={compra?.monto ?? 0}
        metodosGuardados={metodosPago}
        onCerrar={() => setCompra(null)}
        onExito={() => {
          notificar({ tipo: 'success', titulo: 'Compra completada', mensaje: `La compra de ${compra?.nombre} fue aprobada correctamente.` });
          emitir('notificaciones-actualizadas');
        }}
      />
    </View>
  );
}

const iconoCategoria: Record<CategoriaKey, string> = {
  Cargadores: 'charging-station',
  Llantas: 'circle-notch',
  'Baterías': 'car-battery',
  'Cables y conectores': 'plug',
};

const crearEstilos = (c: Palette) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.bg },
  lista: { padding: Spacing.md, paddingBottom: 100, width: '100%', alignSelf: 'center' },
  portada: { borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: 10, borderWidth: 1, borderColor: c.primaryBorder },
  eyebrow: { color: c.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.6 },
  titulo: { color: c.text, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  sub: { color: c.textMuted, fontSize: 14.5, lineHeight: 21, maxWidth: 620 },
  ventajas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  ventaja: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  ventajaTexto: { color: c.text, fontSize: 12, fontWeight: '700' },
  conteo: { color: c.textDim, fontSize: 12.5, fontWeight: '700' },
  tarjeta: { flex: 1, backgroundColor: c.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  imagenCaja: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#050806', overflow: 'hidden' },
  badge: { position: 'absolute', top: 12, backgroundColor: c.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeVidrio: { backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  badgeTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  potenciaFlotante: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(57,255,20,0.35)' },
  potenciaTexto: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  tipo: { color: c.primary, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2 },
  nombre: { color: c.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  desc: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  destacadosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  destacadoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.primarySoft, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, maxWidth: '100%' },
  destacadoChipTexto: { color: c.text, fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
  precio: { color: c.text, fontSize: 20, fontWeight: '900' },
  garantiaMini: { color: c.textDim, fontSize: 11.5, fontWeight: '700' },
  detalleImagen: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#050806', borderWidth: 1, borderColor: c.primaryBorder },
  destacadosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destacadoCaja: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cardElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, padding: 10 },
  destacadoIcono: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  destacadoTexto: { color: c.text, fontSize: 12.5, fontWeight: '700', flex: 1, lineHeight: 17 },
  fichaCaja: { borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden', paddingTop: 10 },
  fichaTitulo: { color: c.text, fontSize: 14, fontWeight: '800', paddingHorizontal: 12, paddingBottom: 6 },
  fichaFila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  fichaEtiqueta: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
  fichaValor: { color: c.text, fontSize: 12.5, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  compraCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', backgroundColor: c.cardElevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.primaryBorder, padding: Spacing.md },
  pie: { color: c.textDim, textAlign: 'center', fontSize: 12, marginTop: Spacing.xl },
});
