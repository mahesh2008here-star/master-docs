package com.masterdocs.reader;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
