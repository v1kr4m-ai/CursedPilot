// NavYeo's on-phone language model: a small GGUF (Qwen2.5 0.5B Instruct) run by llama.cpp. It does one job: read what was said and answer in a short fixed
// shape (a grammar forces it), so it can turn free speech into a request the app's own calculators work out. Greedy decoding, so the same words give the
// same answer. The fixed instructions at the front of every prompt are kept in the KV cache between calls: only the new words are read each time.
#include <jni.h>
#include <string>
#include <cstdio>
#include <vector>
#include <mutex>
#include <atomic>
#include <algorithm>
#include <android/log.h>
#include <sys/time.h>

#include "llama.h"
#include "ggml-backend.h"

#define TAG "NavLlm"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

struct Inst {
    llama_model* model = nullptr;
    llama_context* ctx = nullptr;
    const llama_vocab* vocab = nullptr;
    std::vector<llama_token> cached;   // the tokens now in the KV cache, in order
    std::atomic<bool> stop{false};
    std::mutex mu;
    int n_batch = 512;
    std::string state_path;            // the read instructions saved to a file, so a later load need not read them again
};

static std::once_flag g_init;
// the CPU code is a set of libraries, one per processor family, in the app's library folder: the best one for this phone is loaded
static void ensure_backend(const std::string& lib_dir) { std::call_once(g_init, [&]() { ggml_backend_load_all_from_path(lib_dir.c_str()); llama_backend_init(); }); }
static long now_ms() { struct timeval tv; gettimeofday(&tv, nullptr); return tv.tv_sec * 1000L + tv.tv_usec / 1000L; }

static std::string to_std(JNIEnv* env, jstring s) {
    if (!s) return "";
    const char* c = env->GetStringUTFChars(s, nullptr);
    std::string r(c ? c : "");
    if (c) env->ReleaseStringUTFChars(s, c);
    return r;
}

static void throw_java(JNIEnv* env, const std::string& msg) {
    env->ThrowNew(env->FindClass("java/lang/RuntimeException"), msg.c_str());
}

// The conversation in the model's own chat format; ChatML (which Qwen uses) when the file has no usable template.
static std::string format_chat(const Inst* inst, const std::string& system, const std::string& user) {
    llama_chat_message msgs[2] = { {"system", system.c_str()}, {"user", user.c_str()} };
    const char* tmpl = llama_model_chat_template(inst->model, nullptr);
    if (tmpl) {
        std::vector<char> buf((system.size() + user.size()) * 2 + 512);
        int32_t n = llama_chat_apply_template(tmpl, msgs, 2, true, buf.data(), (int32_t) buf.size());
        if (n > (int32_t) buf.size()) {
            buf.resize(n);
            n = llama_chat_apply_template(tmpl, msgs, 2, true, buf.data(), (int32_t) buf.size());
        }
        if (n > 0) return std::string(buf.data(), n);
    }
    return "<|im_start|>system\n" + system + "<|im_end|>\n<|im_start|>user\n" + user + "<|im_end|>\n<|im_start|>assistant\n";
}

extern "C"
JNIEXPORT jlong JNICALL
Java_com_cursedpilot_app_NavLlmNative_load(JNIEnv* env, jclass, jstring path, jint threads, jstring lib_dir, jstring state_path) {
    ensure_backend(to_std(env, lib_dir));
    const std::string p = to_std(env, path);
    auto* inst = new Inst();
    std::string error;
    try {
        llama_model_params mp = llama_model_default_params();
        mp.n_gpu_layers = 0;
        inst->model = llama_model_load_from_file(p.c_str(), mp);
        if (!inst->model) throw std::runtime_error("the model file could not be read (missing, damaged, or not a GGUF this version supports)");
        inst->vocab = llama_model_get_vocab(inst->model);
        llama_context_params cp = llama_context_default_params();
        cp.n_ctx = 2048;
        cp.n_batch = (uint32_t) inst->n_batch;
        cp.n_threads = threads > 0 ? threads : 4;
        cp.n_threads_batch = cp.n_threads;
        inst->ctx = llama_init_from_model(inst->model, cp);
        if (!inst->ctx) throw std::runtime_error("not enough memory for the model");
        inst->state_path = to_std(env, state_path);
        if (!inst->state_path.empty()) {   // the instructions as read last time: the first answer is then as quick as the others
            std::vector<llama_token> saved(llama_n_ctx(inst->ctx));
            size_t count = 0;
            const long t0 = now_ms();
            if (llama_state_load_file(inst->ctx, inst->state_path.c_str(), saved.data(), saved.size(), &count)) { saved.resize(count); inst->cached = saved; LOGI("instructions restored: %zu tokens in %ld ms", count, now_ms() - t0); }
            else { llama_memory_clear(llama_get_memory(inst->ctx), true); remove(inst->state_path.c_str()); }
        }
        LOGI("model ready: %.0f MB, n_ctx %u, threads %d", llama_model_size(inst->model) / 1048576.0, llama_n_ctx(inst->ctx), cp.n_threads);
    } catch (const std::exception& e) { error = e.what(); }
    if (!error.empty()) {
        if (inst->ctx) llama_free(inst->ctx);
        if (inst->model) llama_model_free(inst->model);
        delete inst;
        throw_java(env, error);
        return 0;
    }
    return reinterpret_cast<jlong>(inst);
}

extern "C"
JNIEXPORT jbyteArray JNICALL
Java_com_cursedpilot_app_NavLlmNative_complete(JNIEnv* env, jclass, jlong handle, jstring jsystem, jstring juser, jstring jgrammar, jint max_tokens, jfloat temperature) {
    auto* inst = reinterpret_cast<Inst*>(handle);
    if (!inst || !inst->ctx) { throw_java(env, "the model is not loaded"); return nullptr; }
    std::lock_guard<std::mutex> lock(inst->mu);
    inst->stop = false;
    const std::string system = to_std(env, jsystem), user = to_std(env, juser), grammar = to_std(env, jgrammar);
    llama_sampler* smpl = nullptr;
    std::string out, error;
    try {
        const std::string prompt = format_chat(inst, system, user);
        int32_t need = -llama_tokenize(inst->vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
        std::vector<llama_token> tokens(need > 0 ? need : 0);
        int32_t n = llama_tokenize(inst->vocab, prompt.c_str(), (int32_t) prompt.size(), tokens.data(), (int32_t) tokens.size(), true, true);
        if (n < 0) throw std::runtime_error("the words could not be read");
        tokens.resize(n);
        const uint32_t n_ctx = llama_n_ctx(inst->ctx);
        if ((uint32_t) n + 8 >= n_ctx) throw std::runtime_error("the request is too long for the model");

        // keep what the cache already has in common with this prompt (the fixed instructions), read only the rest
        llama_memory_t mem = llama_get_memory(inst->ctx);
        size_t common = 0;
        while (common < inst->cached.size() && common < tokens.size() && inst->cached[common] == tokens[common]) common++;
        if (common >= tokens.size()) common = tokens.size() - 1;   // at least one token is read, to have something to sample from
        if (!llama_memory_seq_rm(mem, 0, (llama_pos) common, -1)) { llama_memory_clear(mem, true); common = 0; }
        inst->cached.resize(common);
        const size_t reused = common;
        const long tr = now_ms();
        for (size_t pos = common; pos < tokens.size();) {
            if (inst->stop) throw std::runtime_error("stopped");   // a long prompt can be interrupted between its chunks
            const int32_t chunk = (int32_t) std::min<size_t>((size_t) inst->n_batch, tokens.size() - pos);
            llama_batch b = llama_batch_get_one(tokens.data() + pos, chunk);
            if (llama_decode(inst->ctx, b) != 0) { llama_memory_clear(mem, true); inst->cached.clear(); throw std::runtime_error("reading the words failed"); }
            for (int32_t i = 0; i < chunk; i++) inst->cached.push_back(tokens[pos + i]);
            pos += chunk;
        }

        LOGI("read %zu new tokens in %ld ms (%zu kept)", tokens.size() - reused, now_ms() - tr, reused);
        // a long new read means the instructions were read afresh: keep them for the next load
        if (tokens.size() - reused > 200 && !inst->state_path.empty())
            if (!llama_state_save_file(inst->ctx, inst->state_path.c_str(), inst->cached.data(), inst->cached.size())) remove(inst->state_path.c_str());

        llama_sampler_chain_params sp = llama_sampler_chain_default_params();
        smpl = llama_sampler_chain_init(sp);
        if (!grammar.empty()) {
            llama_sampler* g = llama_sampler_init_grammar(inst->vocab, grammar.c_str(), "root");
            if (!g) throw std::runtime_error("the answer grammar is not valid");
            llama_sampler_chain_add(smpl, g);
        }
        if (temperature > 0.0f) {
            llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
            llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
        } else {
            llama_sampler_chain_add(smpl, llama_sampler_init_greedy());
        }

        const int limit = max_tokens > 0 ? max_tokens : 120;
        const long t0 = now_ms();
        int made = 0;
        while (made < limit && !inst->stop) {
            // llama_sampler_sample also accepts the token (it moves the grammar on): it must not be accepted again here
            llama_token tok = llama_sampler_sample(smpl, inst->ctx, -1);
            if (llama_vocab_is_eog(inst->vocab, tok)) break;
            char piece[256];
            int32_t len = llama_token_to_piece(inst->vocab, tok, piece, sizeof(piece), 0, false);
            if (len > 0) out.append(piece, len);
            llama_token next[1] = { tok };
            llama_batch nb = llama_batch_get_one(next, 1);
            if (llama_decode(inst->ctx, nb) != 0) { llama_memory_clear(mem, true); inst->cached.clear(); throw std::runtime_error("the model stopped while answering"); }
            inst->cached.push_back(tok);
            made++;
            if (inst->cached.size() + 4 >= n_ctx) break;
        }
        LOGI("answered in %ld ms, %d tokens, %zu cached", now_ms() - t0, made, inst->cached.size());
    } catch (const std::exception& e) { error = e.what(); }
    if (smpl) llama_sampler_free(smpl);
    if (!error.empty()) { throw_java(env, error); return nullptr; }
    jbyteArray arr = env->NewByteArray((jsize) out.size());
    env->SetByteArrayRegion(arr, 0, (jsize) out.size(), reinterpret_cast<const jbyte*>(out.data()));
    return arr;
}

extern "C"
JNIEXPORT void JNICALL
Java_com_cursedpilot_app_NavLlmNative_stop(JNIEnv*, jclass, jlong handle) {
    auto* inst = reinterpret_cast<Inst*>(handle);
    if (inst) inst->stop = true;
}

extern "C"
JNIEXPORT void JNICALL
Java_com_cursedpilot_app_NavLlmNative_release(JNIEnv*, jclass, jlong handle) {
    auto* inst = reinterpret_cast<Inst*>(handle);
    if (!inst) return;
    inst->stop = true;
    std::lock_guard<std::mutex> lock(inst->mu);
    if (inst->ctx) llama_free(inst->ctx);
    if (inst->model) llama_model_free(inst->model);
    delete inst;
}
