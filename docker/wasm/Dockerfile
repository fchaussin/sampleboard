# syntax=docker/dockerfile:1
# Build FROM-SOURCE de l'encodeur OGG/Opus WASM (M9, exigence F-Droid) : rejoue la cible
# `dist/encoderWorker.min.js` du Makefile d'opus-recorder v8.0.5 — la SEULE consommée par
# l'app (src/engine/encoder.ts) — avec une toolchain emscripten ÉPINGLÉE. Les sous-modules
# (libopus v1.3.1, speexdsp 1.2.0) sont fixés par SHA dans le tag v8.0.5 lui-même.
# Sortie : l'étage `artifact` ne contient que l'artefact (docker build --output).
FROM emscripten/emsdk:3.1.26 AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends autoconf automake libtool pkg-config \
  && rm -rf /var/lib/apt/lists/*

ARG OPUS_RECORDER_REF=v8.0.5
RUN git clone --branch ${OPUS_RECORDER_REF} --depth 1 \
  https://github.com/chris-rudmin/opus-recorder.git /build
WORKDIR /build
# SHA des sous-modules enregistrés dans le tag (gitlab.xiph.org) — pas de branche flottante.
RUN git submodule update --init

# Mêmes recettes que le Makefile upstream (cibles $(LIBOPUS_OBJ) et $(LIBSPEEXDSP_OBJ)).
RUN cd opus && ./autogen.sh \
  && emconfigure ./configure --disable-extra-programs --disable-doc --disable-intrinsics \
     --disable-rtcd --disable-stack-protector \
  && emmake make -j"$(nproc)"
RUN cd speexdsp && ./autogen.sh \
  && emconfigure ./configure --disable-examples --disable-neon \
  && emmake make -j"$(nproc)"

# Cible $(LIBOPUS_ENCODER_MIN) du Makefile upstream, à l'identique (WASM inliné, SINGLE_FILE).
RUN mkdir -p dist && emcc -o dist/encoderWorker.min.js \
  -O3 -s NO_DYNAMIC_EXECUTION=1 -s NO_FILESYSTEM=1 \
  -s BINARYEN_ASYNC_COMPILATION=0 -s SINGLE_FILE=1 \
  -s EXPORTED_FUNCTIONS="['_malloc','_free','_opus_encoder_create','_opus_encode_float','_opus_encoder_ctl','_opus_encoder_destroy','_speex_resampler_init','_speex_resampler_process_interleaved_float','_speex_resampler_destroy']" \
  --post-js src/encoderWorker.js \
  opus/.libs/libopus.a speexdsp/libspeexdsp/.libs/libspeexdsp.a

FROM scratch AS artifact
COPY --from=build /build/dist/encoderWorker.min.js /
