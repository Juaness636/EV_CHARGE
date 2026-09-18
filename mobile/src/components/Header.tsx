// Header superior móvil de EV Charge
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useAuth } from '../context/AuthContext';
import type { Notificacion } from '../types';

interface HeaderProps {
  onOpenAuth: (tab: 'login' | 'registro') => void;
  onOpenMap?: () => void;
  notificaciones?: Notificacion[];
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAuth,
  onOpenMap,
  notificaciones = [],
}) => {
  const { usuario, logout } = useAuth();
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  const unreadCount = notificaciones.filter((n) => !n.leida).length;

  return (
    <View style={styles.header}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandTitle}>
          EV <Text style={styles.brandAccent}>CHARGE</Text>
        </Text>
      </View>

      {/* Botones de acción */}
      <View style={styles.actions}>
        {usuario ? (
          <View style={styles.userSection}>
            {/* Campana de notificaciones */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setNotifModalOpen(true)}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="bell" size={16} color={Colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón Salir */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => void logout()}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="right-from-bracket" size={13} color={Colors.error} />
              <Text style={styles.logoutText}>Salir</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => onOpenAuth('login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.regBtn}
              onPress={() => onOpenAuth('registro')}
              activeOpacity={0.8}
            >
              <Text style={styles.regBtnText}>Registro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botón rápido para mapa */}
        {onOpenMap && (
          <TouchableOpacity
            style={styles.mapQuickBtn}
            onPress={onOpenMap}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="location-dot" size={14} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Notificaciones */}
      <Modal
        visible={notifModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setNotifModalOpen(false)}
        >
          <View style={styles.notifCard} onStartShouldSetResponder={() => true}>
            <View style={styles.notifHeader}>
              <View style={styles.notifHeaderTitleRow}>
                <FontAwesome6 name="bell" size={16} color={Colors.greenEv} />
                <Text style={styles.notifHeaderTitle}>Notificaciones</Text>
              </View>
              <TouchableOpacity onPress={() => setNotifModalOpen(false)}>
                <FontAwesome6 name="xmark" size={18} color={Colors.textDim} />
              </TouchableOpacity>
            </View>

            {notificaciones.length === 0 ? (
              <View style={styles.emptyNotif}>
                <Text style={styles.emptyNotifText}>No tienes notificaciones pendientes.</Text>
              </View>
            ) : (
              notificaciones.map((n) => (
                <View key={n.id} style={styles.notifItem}>
                  <Text style={styles.notifItemTitle}>{n.titulo}</Text>
                  <Text style={styles.notifItemMessage}>{n.mensaje}</Text>
                </View>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    zIndex: 100,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandAccent: {
    color: Colors.greenEv,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.greenEv,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loginBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgCard,
  },
  loginBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  regBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.greenEv,
  },
  regBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  mapQuickBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.greenDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  notifCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGreen,
    padding: Spacing.md,
    maxHeight: '70%',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  notifHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifHeaderTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyNotif: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyNotifText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  notifItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifItemTitle: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  notifItemMessage: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
