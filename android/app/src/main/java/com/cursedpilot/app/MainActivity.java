package com.cursedpilot.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavLlmPlugin.class);   // NavYeo's on-phone language model
        super.onCreate(savedInstanceState);
    }
}
