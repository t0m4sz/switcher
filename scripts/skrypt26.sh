#!/bin/sh
SOX=/lms/Bin/x86_64-linux/sox
FLAC=/lms/Bin/x86_64-linux/flac
LOG=/config/logs/lms_convert.log
# Improved-e-weighted, Intermediate, 95%
SR="$1"
BD="$2"
CH="$3"
FILE="$4"
START="${5:-0}" # Jesli 5-ty argument jest pusty, zacznij od 0

# Funkcja uproszczonego logowania
log_action() {
    echo "$(date "+%Y-%m-%d %H:%M:%S") | SR=$SR BD=$BD | START=$START | ACTION=$1 | FILE=$FILE" >> "$LOG"
}

# --- GRUPA 44100 Hz ---
if [ "$SR" -eq 44100 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_44100_DECOMPRESS_FLAC0"
        # Rozpakowanie do FLAC 0 (brak kompresji), wymuszenie 16 bit w dla DAC
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        # log_action "BIT_REDUCTION_44100"
        # $SOX -q "$FILE" -t flac -b 16 -C 0 - dither -f gesemann trim "$START"

        log_action "BIT_REDUCTION_44100"
        $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        gain -2 dither -f improved-e-weighted trim "$START"
    fi
    exit 0
fi

# --- GRUPA 48000 Hz ---
if [ "$SR" -eq 48000 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_48000_DECOMPRESS_FLAC0"
        # Rozpakowanie do FLAC 0 (brak kompresji), wymuszenie 16 bit w dla DAC
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        # log_action "BIT_REDUCTION_48000"
        # $SOX -q "$FILE" -t flac -b 16 -C 0 - dither -f gesemann trim "$START"

        log_action "RESAMPLE_TO_48000_16BIT"
        $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        rate -v -I -b 95 44100 \
        gain -2 dither -f improved-e-weighted trim "$START"        
    fi
    exit 0
fi

# --- GRUPA WYSOKIE SR (Resampling) ---
if [ "$SR" -eq 88200 ] || [ "$SR" -eq 176400 ] || [ "$SR" -eq 96000 ] || [ "$SR" -eq 192000 ]; then
    log_action "RESAMPLE_TO_48000_16BIT"
    $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        rate -v -I -b 95 44100 \
        gain -2 dither -f improved-e-weighted trim "$START"        
    exit 0
fi
exit 0