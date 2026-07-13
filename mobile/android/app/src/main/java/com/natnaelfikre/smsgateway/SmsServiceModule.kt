package com.natnaelfikre.smsgateway

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsServiceModule"

    @ReactMethod
    fun startService(apiBaseUrl: String, deviceToken: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SmsForegroundService::class.java).apply {
                action = SmsForegroundService.ACTION_START
                putExtra(SmsForegroundService.EXTRA_API_URL, apiBaseUrl)
                putExtra(SmsForegroundService.EXTRA_DEVICE_TOKEN, deviceToken)
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SmsForegroundService::class.java).apply {
                action = SmsForegroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }
}
