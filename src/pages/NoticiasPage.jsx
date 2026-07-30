import { useAuth } from '../lib/AuthContext';
import NoticiasDiarias from '../components/NoticiasDiarias';

export default function NoticiasPage() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Noticias del Día</h1>
          <p className="text-gray-500 text-sm mt-1">
            Información agrícola actualizada para ti
          </p>
        </div>

        {/* Noticias */}
        <NoticiasDiarias 
          ubicacion={user?.ubicacion}
          cultivo={null}
        />

        {/* Info */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-semibold text-blue-800 text-sm mb-2">
            ℹ️ Fuentes de información
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• <strong>SENASA:</strong> Alertas fitosanitarias oficiales</li>
            <li>• <strong>INIA:</strong> Publicaciones técnicas e investigación</li>
            <li>• <strong>Minagri:</strong> Convocatorias y noticias del sector</li>
            <li>• <strong>Medios agrícolas:</strong> Noticias de actualidad</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
