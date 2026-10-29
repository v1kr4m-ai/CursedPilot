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

# the x86_64 build is only for the emulator, whose CPU has AVX2; the phone's arm64 build keeps the safe baseline
if (ANDROID_ABI STREQUAL "x86_64")
  set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
  set(GGML_AVX2 ON CACHE BOOL "" FORCE)
  set(GGML_FMA ON CACHE BOOL "" FORCE)
  set(GGML_F16C ON CACHE BOOL "" FORCE)
  set(GGML_BMI2 ON CACHE BOOL "" FORCE)
endif()

add_subdirectory(llama.cpp)

add_library(${PROJECT_NAME} SHARED navyeo-llm.cpp)

target_include_directories(${PROJECT_NAME} PRIVATE llama.cpp/include llama.cpp/ggml/include)

target_link_libraries(${PROJECT_NAME} android log llama ggml)

# Support 16 KB page sizes (Android 15 devices)
target_link_options(${PROJECT_NAME} PRIVATE "-Wl,-z,max-page-size=16384")
