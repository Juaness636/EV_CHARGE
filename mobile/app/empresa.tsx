import React from 'react';
import { RutaProtegida } from '../src/components/RutaProtegida';
import { EmpresaScreen } from '../src/features/empresa/EmpresaScreen';

export default function Empresa() {
  return (
    <RutaProtegida rol="empresa">
      <EmpresaScreen />
    </RutaProtegida>
  );
}
