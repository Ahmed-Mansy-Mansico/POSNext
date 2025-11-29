#!/bin/bash

# Script to download country flags from flagcdn.com
# Downloads flags as PNG files (20px width) for the countries we need

FLAGS_DIR="public/flags"
FLAG_WIDTH="w20"

# Create flags directory if it doesn't exist
mkdir -p "$FLAGS_DIR"

# Country codes we need (ISO 3166-1 alpha-2)
countries=("sa" "ae" "kw" "qa" "om" "bh" "lb" "jo" "eg" "ma" "us" "gb" "fr" "de" "it" "es" "in" "cn" "jp" "kr" "au" "za")

echo "Starting flag downloads..."
echo "================================"

success=0
failed=0

for country in "${countries[@]}"; do
    url="https://flagcdn.com/${FLAG_WIDTH}/${country}.png"
    output="${FLAGS_DIR}/${country}.png"
    
    echo -n "Downloading ${country}... "
    
    if curl -s -f -o "$output" "$url"; then
        echo "✓"
        ((success++))
    else
        echo "✗"
        ((failed++))
        [ -f "$output" ] && rm "$output"
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.1
done

echo "================================"
echo "Download Summary:"
echo "✓ Successfully downloaded: $success flags"
if [ $failed -gt 0 ]; then
    echo "✗ Failed: $failed flags"
fi
echo "================================"
echo ""
echo "Flags saved to: $FLAGS_DIR"

