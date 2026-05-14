#!/bin/bash

OUTPUT_FILE="project_viewer_count_missing_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "PROJECT VIEWER COUNT - MISSING FRONTEND FILES" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

add_file () {
  FILE_PATH="$1"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "FILE: $FILE_PATH" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  if [ -f "$FILE_PATH" ]; then
    sed -n '1,500p' "$FILE_PATH" >> "$OUTPUT_FILE"
  else
    echo "NOT FOUND: $FILE_PATH" >> "$OUTPUT_FILE"
  fi
}

echo "" >> "$OUTPUT_FILE"
echo "================ APP CORE FILE TREE ================" >> "$OUTPUT_FILE"
find blockchain-test-ui/src/app -maxdepth 3 -type f \( \
  -iname "app.component.*" -o \
  -iname "app.config.*" -o \
  -iname "main.ts" -o \
  -iname "app.routes.ts" \
\) | sort >> "$OUTPUT_FILE"

add_file "blockchain-test-ui/src/main.ts"
add_file "blockchain-test-ui/src/app/app.component.ts"
add_file "blockchain-test-ui/src/app/app.component.html"
add_file "blockchain-test-ui/src/app/app.config.ts"
add_file "blockchain-test-ui/src/app/app.routes.ts"

echo ""
echo "DONE: $OUTPUT_FILE created successfully."
echo "Send this file content to ChatGPT."
