#!/bin/bash

# Имя выходного файла
OUTPUT_FILE="combined_code.txt"

# Очищаем файл
> "$OUTPUT_FILE"

# Список нужных файлов (относительно текущей директории)
FILES=(
    "renderer/app.js"
    "renderer/index.html"
    "utils/arduino.js"
    "config.js"
    "main.js"
    "package-lock.json"
    "package.json"
    "preload.js"
)

# Обрабатываем каждый файл
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "=== $file ===" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo -e "\n\n" >> "$OUTPUT_FILE"
        echo "✅ Добавлен: $file"
    else
        echo "❌ Файл не найден: $file"
    fi
done

echo "🎉 Готово! Все файлы объединены в $OUTPUT_FILE"