package com.agrilux.app2;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "VozAgrilux")
public class VozAgriluxPlugin extends Plugin {
    private TextToSpeech voz;

    @PluginMethod
    public void hablar(PluginCall call) {
        String texto = call.getString("texto", "").trim();
        if (texto.isEmpty()) { call.reject("No hay texto para leer."); return; }
        getActivity().runOnUiThread(() -> {
            if (voz != null) { reproducir(call, texto); return; }
            voz = new TextToSpeech(getContext(), estado -> {
                if (estado != TextToSpeech.SUCCESS) { voz = null; call.reject("El motor de voz no está disponible."); return; }
                reproducir(call, texto);
            });
        });
    }

    private void reproducir(PluginCall call, String texto) {
        Voice preferida = null;
        int mejor = -1;
        if (voz.getVoices() != null) {
            for (Voice candidata : voz.getVoices()) {
                Locale locale = candidata.getLocale();
                if (locale == null || !"es".equalsIgnoreCase(locale.getLanguage()) || (candidata.getFeatures() != null && candidata.getFeatures().contains("notInstalled"))) continue;
                int prioridad = (candidata.isNetworkConnectionRequired() ? 0 : 10) + ("PE".equalsIgnoreCase(locale.getCountry()) ? 3 : "MX".equalsIgnoreCase(locale.getCountry()) ? 2 : 1);
                if (prioridad > mejor) { preferida = candidata; mejor = prioridad; }
            }
        }
        if (preferida == null || voz.setVoice(preferida) == TextToSpeech.ERROR
                || voz.getVoice() == null || voz.getVoice().getLocale() == null
                || !"es".equalsIgnoreCase(voz.getVoice().getLocale().getLanguage())) {
            call.reject("Instala una voz en español en los ajustes de texto a voz."); return;
        }
        voz.setSpeechRate(0.9f);
        if (voz.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "agrilux-ubicacion") == TextToSpeech.ERROR) {
            call.reject("No se pudo iniciar el audio."); return;
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (voz != null) { voz.stop(); voz.shutdown(); voz = null; }
        super.handleOnDestroy();
    }
}
