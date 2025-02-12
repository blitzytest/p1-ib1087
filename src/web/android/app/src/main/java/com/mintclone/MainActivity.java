package com.mintclone;

import com.facebook.react.ReactActivity;  // v0.71.0
import com.facebook.react.defaults.DefaultReactActivityDelegate;  // v0.71.0
import androidx.biometric.BiometricPrompt;  // v1.2.0
import androidx.biometric.BiometricManager;  // v1.2.0
import java.util.concurrent.Executor;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

/**
 * MainActivity serves as the entry point for the Mint Clone React Native application.
 * Handles initialization, lifecycle management, and biometric authentication integration.
 */
public class MainActivity extends ReactActivity {

    private BiometricPrompt biometricPrompt;
    private BiometricManager biometricManager;
    private Executor executor;

    /**
     * Default constructor for MainActivity.
     * Initializes React Native components and biometric authentication.
     */
    public MainActivity() {
        super();
        initializeBiometricAuth();
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "MintClone";
    }

    /**
     * Creates and returns a ReactActivityDelegate instance for managing React Native functionality.
     */
    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName()
        );
    }

    /**
     * Initializes the biometric authentication components and configurations.
     */
    private void initializeBiometricAuth() {
        biometricManager = BiometricManager.from(this);
        executor = ContextCompat.getMainExecutor(this);

        BiometricPrompt.AuthenticationCallback authCallback = new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                // Authentication successful - proceed with app access
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                // Handle authentication errors
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                // Handle failed authentication attempt
            }
        };

        biometricPrompt = new BiometricPrompt(this, executor, authCallback);
    }

    /**
     * Checks if biometric authentication is available on the device.
     * @return boolean indicating if biometric authentication can be used
     */
    private boolean checkBiometricAvailability() {
        int canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        
        return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /**
     * Displays the biometric authentication prompt to the user.
     */
    private void showBiometricPrompt() {
        if (!checkBiometricAvailability()) {
            return;
        }

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Biometric Authentication")
            .setSubtitle("Log in using your biometric credential")
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build();

        biometricPrompt.authenticate(promptInfo);
    }

    /**
     * Custom executor for running biometric operations on the main thread.
     */
    private static class MainThreadExecutor implements Executor {
        private final Handler handler = new Handler(Looper.getMainLooper());

        @Override
        public void execute(Runnable command) {
            handler.post(command);
        }
    }
}