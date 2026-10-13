// Catálogo de productos con búsqueda, filtro por categoría, orden, detalle y compra.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listarMetodosPago, type MetodoPago } from '../../api/metodosPago.api';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { ANCHO_MAXIMO_CONTENIDO, Radius, Spacing } from '../../theme/spacing';
import { pesos } from '../../utils/formato';
import { emitir } from '../../utils/eventos';
import { BarraSuperior } from '../../components/BarraSuperior';
import { ModalPago } from '../../components/ModalPago';
import { notificar } from '../../components/Notificaciones';
import { trasCerrarModal } from '../../components/capas';
import { AppModal, Boton, CampoSelect, CampoTexto, Chips, Icono, Vacio } from '../../components/ui';
import { Presionable } from '../../components/ui/Presionable';
import { Aparecer, Respirar } from '../../components/animacion';
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

  const cabecera = (
    <View style={{ gap: Spacing.md, marginBottom: Spacing.md }}>
      <View style={{ gap: 6 }}>
        <Text style={s.eyebrow}>Catálogo EV Charge</Text>
        <Text style={s.titulo}>{categoria === 'Todas' ? 'Productos para movilidad eléctrica' : `Productos de ${categoria}`}</Text>
        <Text style={s.sub}>Encuentra cargadores, accesorios y soluciones para tu vehículo eléctrico.</Text>
      </View>
      <CampoTexto icono="magnifying-glass" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar productos..." accessibilityLabel="Buscar productos" />
      <Chips
        valor={categoria}
        onChange={seleccionarCategoria}
        opciones={[{ valor: 'Todas', etiqueta: 'Todas' }, ...categoriasProducto.map((c) => ({ valor: c, etiqueta: c }))]}
      />
      <View style={{ maxWidth: 320 }}>
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
          <Presionable style={s.tarjeta} elevarAlPasar escalaPresion={0.98} onPress={() => setDetalle(item)}>
            <View style={s.imagenCaja}>
              <View style={s.brillo} />
              <Respirar duracion={5000} escala={0.05}>
                <Image source={item.img} style={s.imagenTarjeta} contentFit="contain" transition={400} />
              </Respirar>
              <View style={[s.badge, { left: 10 }]}><Text style={s.badgeTexto}>{item.etiqueta}</Text></View>
              <View style={[s.badge, s.badgeCategoria, { right: 10 }]}><Text style={[s.badgeTexto, { color: colors.text }]}>{item.categoria}</Text></View>
            </View>
            <View style={{ padding: Spacing.md, gap: 6, flex: 1 }}>
              <Text style={s.tipo}>{item.tipo}</Text>
              <Text style={s.nombre}>{item.nombre}</Text>
              <Text style={s.desc}>{item.desc}</Text>
              <View style={s.infoFila}>
                <Text style={s.info}><Icono name="bolt" size={11} color={colors.primary} /> {item.potencia}</Text>
                <Text style={s.info}><Icono name="plug" size={11} color={colors.primary} /> {item.conector}</Text>
              </View>
              <Text style={s.precio}>{pesos(item.monto)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
                <Boton titulo="Ver detalles" variante="outline" pequeno onPress={() => setDetalle(item)} style={{ flex: 1 }} />
                <Boton titulo="Comprar" pequeno icono="cart-shopping" onPress={() => void iniciarCompra(item)} style={{ flex: 1 }} />
              </View>
            </View>
          </Presionable>
          </Aparecer>
        )}
      />

      <AppModal visible={!!detalle} onClose={() => setDetalle(null)} titulo={detalle?.nombre} anchoMaximo={560}>
        {detalle && (
          <>
            <View style={[s.imagenCaja, { height: 240 }]}>
              <View style={[s.brillo, { width: 200, height: 200, borderRadius: 100 }]} />
              <Aparecer desde="escala" duracion={500} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Image source={detalle.img} style={s.imagen} contentFit="contain" transition={300} />
              </Aparecer>
            </View>
            <Text style={s.tipo}>{detalle.tipo}</Text>
            <Text style={s.desc}>{detalle.desc}</Text>
            <View style={s.infoFila}>
              <Text style={s.info}><Icono name="bolt" size={11} color={colors.primary} /> {detalle.potencia}</Text>
              <Text style={s.info}><Icono name="plug" size={11} color={colors.primary} /> {detalle.conector}</Text>
            </View>
            <Text style={[s.precio, { fontSize: 22 }]}>{pesos(detalle.monto)}</Text>
            <Boton titulo="Comprar ahora" icono="cart-shopping" onPress={() => void iniciarCompra(detalle)} bloque />
          </>
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

const crearEstilos = (c: Palette) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.bg },
  lista: { padding: Spacing.md, paddingBottom: 100, width: '100%', alignSelf: 'center' },
  eyebrow: { color: c.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  titulo: { color: c.text, fontSize: 26, fontWeight: '900' },
  sub: { color: c.textMuted, fontSize: 14.5 },
  tarjeta: { flex: 1, backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  brillo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: c.primary, opacity: c.modo === 'dark' ? 0.18 : 0.12 },
  imagenTarjeta: { width: 220, height: 160 },
  imagenCaja: { height: 190, backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, overflow: 'hidden' },
  imagen: { width: '80%', height: '85%' },
  badge: { position: 'absolute', top: 10, backgroundColor: c.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeCategoria: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  badgeTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tipo: { color: c.primary, fontSize: 11.5, fontWeight: '800', letterSpacing: 1 },
  nombre: { color: c.text, fontSize: 16.5, fontWeight: '800' },
  desc: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  infoFila: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  info: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
  precio: { color: c.text, fontSize: 18, fontWeight: '900', marginVertical: 6 },
  pie: { color: c.textDim, textAlign: 'center', fontSize: 12, marginTop: Spacing.xl },
});
