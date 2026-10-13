import React from 'react';
import { RutaProtegida } from '../src/components/RutaProtegida';
import { AdminScreen } from '../src/features/admin/AdminScreen';

export default function Admin() {
  return (
    <RutaProtegida rol="admin">
      <AdminScreen />
    </RutaProtegida>
  );
}
