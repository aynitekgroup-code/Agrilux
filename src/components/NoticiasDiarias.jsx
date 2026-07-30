import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle, Sprout, Building2, Newspaper, Filter, ChevronDown } from 'lucide-react';

const TIPO_COLORS = {
  'alerta_fitosanitaria': 'bg-red-100 text-red-800 border-red-200',
  'alerta_climatica': 'bg-orange-100 text-orange-800 border-orange-200',
  'cuarentena': 'bg-red-200 text-red-900 border-red-300',
  'brote': 'bg-red-150 text-red-800 border-red-250',
  'convocatoria': 'bg-blue-100 text-blue-800 border-blue-200',
  'financiamiento': 'bg-green-100 text-green-800 border-green-200',
  'tecnologia': 'bg-purple-100 text-purple-800 border-purple-200',
  'mercado': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'noticia': 'bg-gray-100 text-gray-800 border-gray-200',
  'investigacion': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'publicacion_tecnica': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'capacitacion': 'bg-pink-100 text-pink-800 border-pink-200',
  'regulacion': 'bg-amber-100 text-amber-800 border-amber-200',
  'vigilancia': 'bg-teal-100 text-teal-800 border-teal-200',
  'recomendacion': 'bg-lime-100 text-lime-800 border-lime-200'
};

const TIPO_LABELS = {
  'alerta_fitosanitaria': 'Alerta Plaga',
  'alerta_climatica': 'Alerta Clima',
  'cuarentena': 'Cuarentena',
  'brote': 'Brote',
  'convocatoria': 'Convocatoria',
  'financiamiento': 'Financiamiento',
  'tecnologia': 'Tecnología',
  'mercado': 'Mercado',
  'noticia': 'Noticia',
  'investigacion': 'Investigación',
  'publicacion_tecnica': 'Publicación',
  'capacitacion': 'Capacitación',
  'regulacion': 'Regulación',
  'vigilancia': 'Vigilancia',
  'recomendacion': 'Recomendación'
};

const FUENTE_ICONS = {
  'SENASA': '🔬',
  'INIA': '🧪',
  'Ministerio de Agricultura': '🏛️',
  'AgroPerú': '📰',
  'Rural': '🌾',
  'La República': '📰',
  'El Comercio': '📰',
  'Gestión': '📰'
};

export default function NoticiasDiarias({ ubicacion, cultivo }) {
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchNews = async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (ubicacion?.region) params.append('region', ubicacion.region);
      if (cultivo) params.append('cultivo', cultivo);
      if (force) params.append('force', 'true');
      
      const response = await fetch(`/api/daily-news?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener noticias');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setNoticias(data.noticias);
        setStats(data.stats);
        setLastUpdate(new Date());
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [ubicacion, cultivo]);

  const filteredNoticias = filtroTipo === 'todos' 
    ? noticias 
    : noticias.filter(n => n.tipo === filtroTipo);

  const formatFecha = (fecha) => {
    const date = new Date(fecha);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Hace minutos';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-PE', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading && noticias.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Noticias Agrícolas</h3>
            <p className="text-sm text-gray-500">Cargando información del día...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Noticias Agrícolas</h3>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchNews(true)}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Noticias Agrícolas</h3>
              <p className="text-xs text-gray-500">
                {lastUpdate ? `Actualizado ${formatFecha(lastUpdate)}` : 'Hoy'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span>{stats.total} noticias</span>
            {stats.porFuente && Object.entries(stats.porFuente).slice(0, 3).map(([fuente, count]) => (
              <span key={fuente}>• {count} {fuente}</span>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 bg-gray-50 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filtroTipo === 'todos'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Todos
            </button>
            {Object.entries(stats?.porTipo || {}).map(([tipo, count]) => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filtroTipo === tipo
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {TIPO_LABELS[tipo] || tipo} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* News List */}
      <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {filteredNoticias.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Sprout className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay noticias disponibles</p>
            <button
              onClick={() => fetchNews(true)}
              className="mt-2 text-sm text-green-600 hover:underline"
            >
              Actualizar
            </button>
          </div>
        ) : (
          filteredNoticias.map((noticia, index) => (
            <div
              key={index}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => noticia.enlace && window.open(noticia.enlace, '_blank')}
            >
              <div className="flex items-start gap-3">
                {/* Icono de fuente */}
                <div className="text-2xl flex-shrink-0">
                  {FUENTE_ICONS[noticia.fuente] || '📰'}
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Tipo badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
                      TIPO_COLORS[noticia.tipo] || TIPO_COLORS['noticia']
                    }`}>
                      {TIPO_LABELS[noticia.tipo] || noticia.tipo}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFecha(noticia.fecha)}
                    </span>
                  </div>
                  
                  {/* Título */}
                  <h4 className="font-medium text-gray-800 line-clamp-2 mb-1">
                    {noticia.titulo}
                  </h4>
                  
                  {/* Resumen */}
                  {noticia.resumen && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {noticia.resumen}
                    </p>
                  )}
                  
                  {/* Fuente y enlace */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                      {noticia.fuente}
                    </span>
                    {noticia.enlace && (
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredNoticias.length > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => fetchNews(true)}
            className="w-full py-2 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
          >
            Actualizar noticias
          </button>
        </div>
      )}
    </div>
  );
}
