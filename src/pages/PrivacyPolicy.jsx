export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: 9 de agosto de 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Información que recopilamos</h2>
            <p>Agrilux recopila la siguiente información para mejorar su experiencia:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Ubicación GPS:</strong> Para提供 recomendaciones climáticas y agrícolas precisas según su zona.</li>
              <li><strong>Datos de cultivo:</strong> Información sobre sus plantaciones, cultivos y actividades agrícolas que usted registra voluntariamente.</li>
              <li><strong>Datos de cuenta:</strong> Nombre y dirección de correo electrónico al registrarse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Uso de la información</h2>
            <p>Utilizamos su información para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Proveer recomendaciones personalizadas de cultivo.</li>
              <li>Mostrar información climática relevante a su ubicación.</li>
              <li>Mejorar los servicios y funcionalidades de la aplicación.</li>
              <li>Enviar notificaciones relacionadas con sus cultivos (solo si usted lo autoriza).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Servicios de terceros</h2>
            <p>Utilizamos los siguientes servicios de terceros que pueden recopilar información:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Firebase (Google):</strong> Para autenticación, base de datos y análisis de uso.</li>
              <li><strong>Google Maps:</strong> Para mostrar mapas y procesar ubicación GPS.</li>
              <li><strong>Servidores SQL:</strong> Para almacenar datos de forma segura.</li>
            </ul>
            <p className="mt-2">Estos servicios están sujetos a sus propias políticas de privacidad.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Almacenamiento y seguridad</h2>
            <p>Sus datos se almacenan de forma segura en servidores protegidos. Implementamos medidas de seguridad técnicas y organizativas para proteger su información contra acceso no autorizado, alteración, divulgación o destrucción.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Sus derechos</h2>
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Acceder a sus datos personales.</li>
              <li>Solicitar la eliminación de sus datos.</li>
              <li>Solicitar la corrección de datos inexactos.</li>
              <li>Oponerse al procesamiento de sus datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Retención de datos</h2>
            <p>Conservaremos sus datos mientras su cuenta esté activa o mientras sean necesarios para proveer los servicios. Si solicita la eliminación de su cuenta, eliminaremos sus datos personales de nuestros sistemas.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Cambios en esta política</h2>
            <p>Nos reservamos el derecho de actualizar esta política de privacidad. Los cambios serán publicados en esta página con una fecha de actualización revisada.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Contacto</h2>
            <p>Si tiene preguntas sobre esta política de privacidad o sobre el tratamiento de sus datos, puede contactarnos a través de:</p>
            <p className="mt-2 font-medium">Correo electrónico: aynitek.group@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
