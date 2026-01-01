package ru.fotomix.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import ru.fotomix.plugins.CameraAccessPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(CameraAccessPlugin::class.java)
    }
}
