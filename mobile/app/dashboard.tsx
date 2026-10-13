import React from 'react';
import { RutaProtegida } from '../src/components/RutaProtegida';
import { DashboardScreen } from '../src/features/dashboard/DashboardScreen';

export default function Dashboard() {
  return (
    <RutaProtegida rol="usuario">
      <DashboardScreen />
    </RutaProtegida>
  );
}
