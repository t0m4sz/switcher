#!/bin/sh
SOX=/lms/Bin/x86_64-linux/sox
FLAC=/lms/Bin/x86_64-linux/flac
LOG=/config/logs/lms_convert.log
# Custom: phase=-L bw=-b 95 gain=-1 dither=dither -f high-shibata
SR="$1"
BD="$2"
CH="$3"
FILE="$4"
START="${5:-0}"

log_action() {
    echo "$(date "+%Y-%m-%d %H:%M:%S") | SR=$SR BD=$BD | START=$START | ACTION=$1 | FILE=$FILE" >> "$LOG"
}

# --- GRUPA 44100 Hz ---
if [ "$SR" -eq 44100 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_44100"
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        log_action "BIT_REDUCTION_44100"
        $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        gain -1 dither -f high-shibata trim "$START"
    fi
    exit 0
fi

# --- GRUPA 48000 Hz ---
if [ "$SR" -eq 48000 ]; then
    if [ "$BD" -le 16 ]; then
        log_action "PASSTHROUGH_16_48000"
        $SOX -q "$FILE" -t flac -b 16 -C 0 - trim "$START"
    else
        log_action "RESAMPLE_48000_TO_44100"
        $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        rate -v -L -b 95 44100 \
        gain -1 dither -f high-shibata trim "$START"
    fi
    exit 0
fi

# --- GRUPA WYSOKIE SR ---
if [ "$SR" -eq 88200 ] || [ "$SR" -eq 176400 ] || [ "$SR" -eq 96000 ] || [ "$SR" -eq 192000 ]; then
    log_action "RESAMPLE_TO_44100"
    $SOX --buffer 524288 -q "$FILE" \
        -t flac -b 16 -C 0 - \
        rate -v -L -b 95 44100 \
        gain -1 dither -f high-shibata trim "$START"
    exit 0
fi
exit 0
