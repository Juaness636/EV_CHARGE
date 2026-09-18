// Pantalla Principal (HomeScreen) de EV Charge Móvil
import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { CategoriesSection } from '../components/CategoriesSection';
import { ServicesSection } from '../components/ServicesSection';
import { AboutSection } from '../components/AboutSection';
import { StatsSection } from '../components/StatsSection';
import { ContactSection } from '../components/ContactSection';
import { FaqSection } from '../components/FaqSection';
import { FooterSection } from '../components/FooterSection';
import { AuthModal } from '../components/AuthModal';
import { MapPreviewModal } from '../components/MapPreviewModal';
import { useAuth } from '../context/AuthContext';
import { listarNotificaciones } from '../api/notificaciones.api';
import type { Notificacion } from '../types';

export const HomeScreen: React.FC = () => {
  const { usuario } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  // Estados de modales
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'registro'>('login');
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Notificaciones
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  const cargarNotificaciones = async () => {
    if (!usuario) {
      setNotificaciones([]);
      return;
    }
    try {
      const data = await listarNotificaciones();
      setNotificaciones(data);
    } catch {
      // Si el backend no responde, dejamos lista vacía
      setNotificaciones([]);
    }
  };

  useEffect(() => {
    void cargarNotificaciones();
  }, [usuario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarNotificaciones();
    setRefreshing(false);
  };

  const handleOpenAuth = (tab: 'login' | 'registro') => {
    setAuthTab(tab);
    setAuthModalVisible(true);
  };

  const handleLearnMore = () => {
    // Scroll hacia la sección Quiénes somos
    scrollViewRef.current?.scrollTo({ y: 800, animated: true });
  };

  const handleScrollToContact = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <View style={styles.screen}>
      {/* Header fijo */}
      <Header
        onOpenAuth={handleOpenAuth}
        onOpenMap={() => setMapModalVisible(true)}
        notificaciones={notificaciones}
      />

      {/* Contenido scrolleable del Home */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.greenEv}
            colors={[Colors.greenEv]}
          />
        }
      >
        {/* 1. Hero Section con Orbes de Neón */}
        <HeroSection
          onNavigateMap={() => setMapModalVisible(true)}
          onLearnMore={handleLearnMore}
        />

        {/* 2. Categorías de Productos */}
        <CategoriesSection />

        {/* 3. Servicios Principales */}
        <ServicesSection />

        {/* 4. Quiénes Somos (SENA ADSO) */}
        <AboutSection onContactPress={handleScrollToContact} />

        {/* 5. Estadísticas en Números */}
        <StatsSection />

        {/* 6. Formulario de Contacto */}
        <ContactSection />

        {/* 7. Preguntas Frecuentes (Acordeón) */}
        <FaqSection />

        {/* 8. Pie de Página */}
        <FooterSection />
      </ScrollView>

      {/* Modal de Autenticación */}
      <AuthModal
        visible={authModalVisible}
        initialTab={authTab}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => void cargarNotificaciones()}
      />

      {/* Modal de Mapa Interactivo (react-native-maps) */}
      <MapPreviewModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
