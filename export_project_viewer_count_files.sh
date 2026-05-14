#!/bin/bash

OUTPUT_FILE="project_viewer_count_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "BLOCKCHAIN PROJECT VIEWER COUNT FILE EXPORT" >> "$OUTPUT_FILE"
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
echo "================ BACKEND FILE TREE ================" >> "$OUTPUT_FILE"
find blockchain-api/src -maxdepth 4 -type f | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ FRONTEND DASHBOARD/API FILE TREE ================" >> "$OUTPUT_FILE"
find blockchain-test-ui/src/app -type f \( \
  -iname "*dashboard*" -o \
  -iname "*api*" -o \
  -iname "*service*" -o \
  -iname "*route*" -o \
  -iname "*layout*" -o \
  -iname "*sidebar*" \
\) | sort >> "$OUTPUT_FILE"

add_file "blockchain-api/src/server.js"
add_file "blockchain-api/src/config/database.js"
add_file "blockchain-api/src/routes/index.js"

echo "" >> "$OUTPUT_FILE"
echo "================ POSSIBLE BACKEND ROUTES ================" >> "$OUTPUT_FILE"
find blockchain-api/src/routes -type f -name "*.js" -print | sort | while read file; do
  add_file "$file"
done

echo "" >> "$OUTPUT_FILE"
echo "================ POSSIBLE FRONTEND SERVICES ================" >> "$OUTPUT_FILE"
find blockchain-test-ui/src/app -type f \( -iname "*service.ts" -o -iname "*api*.ts" \) -print | sort | while read file; do
  add_file "$file"
done

echo "" >> "$OUTPUT_FILE"
echo "================ POSSIBLE DASHBOARD FILES ================" >> "$OUTPUT_FILE"
find blockchain-test-ui/src/app -type f -iname "*dashboard*" -print | sort | while read file; do
  add_file "$file"
done

echo ""
echo "DONE: $OUTPUT_FILE created successfully."
echo "Send this file content to ChatGPT."
