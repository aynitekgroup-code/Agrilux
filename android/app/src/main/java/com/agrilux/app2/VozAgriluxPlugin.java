package com.agrilux.app2;

import android.speech.tts.TextToSpeech;
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
        int idioma = voz.setLanguage(new Locale("es", "PE"));
        if (idioma == TextToSpeech.LANG_MISSING_DATA || idioma == TextToSpeech.LANG_NOT_SUPPORTED) {
            idioma = voz.setLanguage(new Locale("es"));
        }
        if (idioma == TextToSpeech.LANG_MISSING_DATA || idioma == TextToSpeech.LANG_NOT_SUPPORTED) {
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
