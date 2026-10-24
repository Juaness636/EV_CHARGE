// Fotos de una estación propia en el panel de empresa.
// El backend solo acepta fotos de estaciones de la propia empresa (404 para las ajenas).
import React from 'react';
import { eliminarFotoEstacion, subirFotoEstacion, type EstacionEmpresa } from '../../api/empresa.api';
import { EditorFotos } from '../../components/EditorFotos';
import { useEmpresa } from './componentes';

export const FotosEstacion: React.FC<{ estacion: EstacionEmpresa; onCambio: (e: EstacionEmpresa) => void }> = ({
  estacion,
  onCambio,
}) => {
  const { puedeOperar } = useEmpresa();
  return (
    <EditorFotos
      fotos={estacion.fotos || []}
      puedeEditar={puedeOperar}
      onSubir={async (foto) => onCambio(await subirFotoEstacion(estacion.id, foto))}
      onQuitar={async (foto) => onCambio(await eliminarFotoEstacion(estacion.id, foto.id))}
    />
  );
};
