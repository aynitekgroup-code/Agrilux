package com.agrilux.app2;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VozAgriluxPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
