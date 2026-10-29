package com.cursedpilot.app;

/** The JNI side of NavYeo's on-phone language model (see cpp/navyeo-llm.cpp). */
final class NavLlmNative {
    static {
        System.loadLibrary("navyeo-llm");
    }

    private NavLlmNative() {}

    /** Loads a GGUF model; throws RuntimeException with a plain message when it cannot. */
    static native long load(String path, int threads);

    /** One reply: `system` and `user` in the model's chat format, output held to `grammar` (GBNF, root rule "root") when it is not empty. UTF-8 bytes. */
    static native byte[] complete(long handle, String system, String user, String grammar, int maxTokens, float temperature);

    static native void stop(long handle);

    static native void release(long handle);
}
