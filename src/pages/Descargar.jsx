import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'aynitek.group@gmail.com';

export default function Descargar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [apkInfo, setApkInfo] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileRef = useRef(null);

  const siteUrl = window.location.origin;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(siteUrl + '/descargar')}&bgcolor=ffffff&color=1a6b3c`;

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) setIsAdmin(true);
    });

    fetchApkInfo();

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const fetchApkInfo = async () => {
    try {
      const { data } = await supabase.storage.from('apk').list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
      if (data && data.length > 0) {
        const file = data[0];
        const { data: urlData } = supabase.storage.from('apk').getPublicUrl(file.name);
        setApkInfo({ name: file.name, size: file.metadata?.size, url: urlData?.publicUrl, created: file.created_at });
      }
    } catch (e) { console.warn('No APK available:', e); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.apk')) { setUploadError('Solo se permiten archivos .apk'); return; }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadProgress(0);

    try {
      const fileName = `agrilux-${Date.now()}.apk`;
      const { error: uploadErr } = await supabase.storage
        .from('apk')
        .upload(fileName, file, { contentType: 'application/vnd.android.package-archive', upsert: false });

      if (uploadErr) throw uploadErr;

      setUploadProgress(100);
      setUploadSuccess(`APK subido: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      fetchApkInfo();
    } catch (err) {
      setUploadError(`Error: ${err.message}`);
    }
    setUploading(false);
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Tamaño desconocido';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <header className="bg-white/80 backdrop-blur sticky top-0 z-10 border-b border-green-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 bg-[#1a6b3c] rounded-xl flex items-center justify-center text-white font-black text-lg">A</span>
            <span className="font-black text-[#1a6b3c] text-lg tracking-tight">AGRILUX</span>
          </a>
          <a href="/" className="text-sm text-gray-500 hover:text-[#1a6b3c] font-medium">← Volver a la app</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">Descarga Agrilux</h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
            Instala Agrilux sin necesidad de Google Play ni App Store. Elige el método que prefieras.
          </p>
          {isStandalone && (
            <div className="mt-4 inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
              ✅ Ya tienes Agrilux instalado
            </div>
          )}
        </div>

        {/* Admin: subir APK */}
        {isAdmin && (
          <div className="mb-10 bg-white rounded-[24px] shadow-sm border-2 border-dashed border-blue-200 p-6 md:p-7">
            <h2 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2">
              🛠️ Panel de administrador — Subir APK
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Genera el APK en Android Studio (<b>Build → Generate Signed Bundle / APK → APK</b>) y súbelo aquí.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <label className="flex-1 w-full">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".apk"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition
                    ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
                >
                  {uploading ? (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-sm text-blue-600 font-medium">Subiendo APK...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl mb-1">📤</p>
                      <p className="text-sm font-bold text-gray-700">Toca para seleccionar archivo .apk</p>
                      <p className="text-xs text-gray-400 mt-1">O arrastra el APK aquí</p>
                    </>
                  )}
                </div>
              </label>
            </div>
            {uploadError && <p className="text-red-500 text-sm mt-2 font-medium">❌ {uploadError}</p>}
            {uploadSuccess && <p className="text-green-600 text-sm mt-2 font-medium">✅ {uploadSuccess}</p>}
            {apkInfo && (
              <div className="mt-4 bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700">APK actual: {apkInfo.name}</p>
                  <p className="text-xs text-gray-400">{formatSize(apkInfo.size)} • Subido: {new Date(apkInfo.created).toLocaleDateString('es-PE')}</p>
                </div>
                {apkInfo.url && (
                  <a href={apkInfo.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline font-medium">Probar ↓</a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* PWA */}
          <div className="bg-white rounded-[24px] shadow-sm border border-green-100 p-6 md:p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#1a6b3c] text-white text-xs font-black px-4 py-1.5 rounded-bl-2xl">RECOMENDADO</div>
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-xl mb-4">🌐</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Instalar como App (PWA)</h2>
            <p className="text-xs font-bold text-green-600 mb-3">Android • iPhone • Windows • Mac</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              No ocupa casi espacio, se actualiza sola y funciona sin Play Store. Es la forma oficial.
            </p>

            {deferredPrompt ? (
              <button
                onClick={handleInstallPWA}
                className="w-full bg-[#1a6b3c] hover:bg-[#14522e] text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 mb-4"
              >
                📲 Instalar ahora
              </button>
            ) : isStandalone ? (
              <div className="w-full bg-green-50 border border-green-200 text-green-700 font-bold py-3.5 rounded-2xl text-center text-sm mb-4">
                Ya instalada ✓
              </div>
            ) : (
              <div className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl text-center text-sm mb-4 opacity-90">
                {isIOS ? 'Usa el botón de abajo ↓' : 'Busca "Instalar app" en el menú ⋮ del navegador'}
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-3">
              <p className="font-black text-gray-700 text-xs tracking-widest">CÓMO INSTALAR:</p>
              {isIOS ? (
                <ol className="list-decimal list-inside space-y-1.5 text-gray-600 leading-relaxed">
                  <li>Abre esta página en <b>Safari</b></li>
                  <li>Toca el botón <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-200 rounded text-xs">⎙</span> <b>Compartir</b> (abajo)</li>
                  <li>Elige <b>"Agregar a pantalla de inicio"</b> → <b>Agregar</b></li>
                </ol>
              ) : isAndroid ? (
                <ol className="list-decimal list-inside space-y-1.5 text-gray-600 leading-relaxed">
                  <li>Abre esta página en <b>Chrome</b></li>
                  <li>Toca el menú <b>⋮</b> (arriba a la derecha)</li>
                  <li>Toca <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b></li>
                </ol>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-gray-700">📱 Android (Chrome):</p>
                    <p className="text-gray-500">Menú ⋮ → Instalar app</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">🍎 iPhone (Safari):</p>
                    <p className="text-gray-500">Compartir ⎙ → Agregar a pantalla de inicio</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">💻 PC (Chrome/Edge):</p>
                    <p className="text-gray-500">Ícono "Instalar" en la barra de direcciones</p>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">Requiere HTTPS y funciona offline. ~2MB</p>
          </div>

          {/* APK */}
          <div className="bg-white rounded-[24px] shadow-sm border border-amber-100 p-6 md:p-7 flex flex-col">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-xl mb-4">📦</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Descargar APK directo</h2>
            <p className="text-xs font-bold text-amber-600 mb-3">Solo Android</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Archivo para instalar manualmente. Útil si tu celular no deja instalar PWA o tienes internet limitado para compartir por WhatsApp.
            </p>

            {apkInfo?.url ? (
              <a
                href={apkInfo.url}
                download
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 mb-4 text-center"
              >
                ⬇️ Descargar APK ({formatSize(apkInfo.size)})
              </a>
            ) : (
              <div className="w-full bg-gray-100 text-gray-400 font-bold py-3.5 rounded-2xl text-center text-sm mb-4">
                APK no disponible aún
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm space-y-2">
              <p className="font-black text-amber-800 text-xs tracking-widest">INSTRUCCIONES:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-amber-900/70 leading-relaxed">
                <li>Descarga el APK y ábrelo</li>
                <li>Si te sale "Instalar apps desconocidas", toca <b>Permitir / Configuración → Permitir</b></li>
                <li>Toca <b>Instalar</b> → <b>Abrir</b></li>
              </ol>
              <p className="text-xs text-amber-700/60 pt-2 border-t border-amber-100">
                El APK no se actualiza solo. Vuelve a esta página para descargar nuevas versiones.
              </p>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">com.agrilux.app2 • Android 6.0+</p>
          </div>
        </div>

        {/* QR */}
        <div className="bg-white rounded-[24px] shadow-sm border border-green-100 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <img
            src={qrUrl}
            alt="QR para descargar Agrilux"
            width={220}
            height={220}
            className="w-[200px] h-[200px] md:w-[180px] md:h-[180px] rounded-2xl border border-green-100 shrink-0"
            loading="lazy"
          />
          <div className="text-center md:text-left">
            <h3 className="text-lg font-black text-gray-900 mb-2">Comparte con un QR</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Imprime este QR en volantes, carteles o muéstralo en reuniones. Al escanearlo abre esta página y el agricultor elige PWA o APK.
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition"
              >
                Descargar QR (PNG)
              </a>
              <button
                onClick={() => {
                  if (navigator.share) navigator.share({ title: 'Agrilux', text: 'Instala Agrilux sin Play Store', url: siteUrl + '/descargar' });
                  else navigator.clipboard.writeText(siteUrl + '/descargar');
                }}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              >
                Compartir link
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-mono break-all">{siteUrl}/descargar</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10 bg-white rounded-[24px] border border-gray-100 p-6 md:p-7">
          <h3 className="font-black text-gray-900 mb-4">Preguntas frecuentes</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-bold text-gray-800">¿Es seguro instalar fuera de Play Store?</p>
              <p className="text-gray-500 mt-1">Sí. La PWA es solo tu web con HTTPS. El APK es generado por ti y firmado con tu keystore. Android solo advierte porque no viene de Google.</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">¿Funciona sin internet?</p>
              <p className="text-gray-500 mt-1">La PWA cachea la interfaz. Diagnóstico y datos requieren conexión, pero la app abre offline.</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">¿En iPhone puedo usar APK?</p>
              <p className="text-gray-500 mt-1">No. En iPhone solo PWA (Safari → Compartir → Agregar a inicio). Apple no permite APK.</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">¿Cómo actualizo?</p>
              <p className="text-gray-500 mt-1"><b>PWA:</b> automática al abrir la app. <b>APK:</b> descarga e instala de nuevo el nuevo APK (no borra datos).</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        Agrilux © 2026 • Agricultura Inteligente • <a href="/privacy" className="underline hover:text-gray-600">Privacidad</a>
      </footer>
    </div>
  );
}
