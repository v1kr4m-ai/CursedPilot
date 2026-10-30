cmake_minimum_required(VERSION 3.22.1)

project("navyeo-llm")

# llama.cpp is vendored under ./llama.cpp (MIT licence, see llama.cpp/LICENSE), pruned to what a library user needs: ggml, src, include, cmake.
# CPU only: no GPU backend, so the build needs nothing beyond the Android NDK.
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)

# The CPU code is built several times, once for each family of processor (on a phone: plain ARMv8, then with dot-product, half-precision and int8
# matrix instructions), and the fastest one the phone's own processor supports is picked when the model is loaded. A baseline-only build leaves the
# newer instructions unused and reads the instructions several times slower.
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS ON CACHE BOOL "" FORCE)

add_subdirectory(llama.cpp)

add_library(${PROJECT_NAME} SHARED navyeo-llm.cpp)

target_include_directories(${PROJECT_NAME} PRIVATE llama.cpp/include llama.cpp/ggml/include)

target_link_libraries(${PROJECT_NAME} android log llama ggml)

# Support 16 KB page sizes (Android 15 devices)
target_link_options(${PROJECT_NAME} PRIVATE "-Wl,-z,max-page-size=16384")
