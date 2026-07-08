import pandas as pd
import json
import os
import re

# 1. Mencari file data
file_input = None
for file in os.listdir('.'):
    if 'tematikbjb_webgis' in file.lower():
        file_input = file
        break

if not file_input:
    print("❌ ERROR: Tidak ada file 'tematikbjb_webgis' di folder ini!")
    exit()

file_output = 'tempat_ibadah.geojson'
geojson = {
    "type": "FeatureCollection",
    "features": []
}

kategori_valid = ['muslim', 'christian_protestant', 'christian', 'christian_evangelical']

# 2. DAFTAR HITAM KATA GENERIK
kata_generik_banned = [
    '', 'nan', 'null', 'unknown', '-',
    'mushalla', 'musholla', 'mushola', 'musola', 'musala', 
    'langgar', 'surau', 
    'mesjid', 'masjid', 'mosque', 
    'gereja', 'church'
]

print(f"🔍 Membaca file: '{file_input}'")
print(f"🧹 Membersihkan titik tanpa nama spesifik (Langgar, Musala, dll)...")

try:
    if file_input.endswith('.xlsx'):
        df = pd.read_excel(file_input, engine='openpyxl')
    elif file_input.endswith('.xls') and not file_input.endswith('.csv'):
        try:
            df = pd.read_excel(file_input, engine='xlrd')
        except Exception:
            df = pd.read_csv(file_input, encoding='utf-8')
    else:
        df = pd.read_csv(file_input, encoding='utf-8')
except Exception as e:
    try:
        df = pd.read_csv(file_input, encoding='latin-1')
    except Exception:
        print(f"❌ Gagal membaca file: {e}")
        exit()

df.columns = [str(col).strip() for col in df.columns]

count_kategori_skipped = 0
count_nama_unclear_skipped = 0

for index, row in df.iterrows():
    tipe_raw = str(row['type_tematik']).strip() if pd.notna(row['type_tematik']) else ""
    nama_raw = str(row['nama']).strip() if pd.notna(row['nama']) else ""
    x_lng = row['X']
    y_lat = row['Y']
    
    if tipe_raw.lower() not in kategori_valid:
        count_kategori_skipped += 1
        continue
        
    if pd.isna(x_lng) or pd.isna(y_lat):
        continue
        
    nama_bersih = re.sub(r'^\d+\.\s*', '', nama_raw).strip()
    nama_bersih = re.sub(r'^\d+\s*', '', nama_bersih).strip()
    
    nama_lower = nama_bersih.lower()
    
    # 3. LOGIKA FILTERING SUPER KETAT
    if (nama_lower in kata_generik_banned) or ("(tanpa nama)" in nama_lower):
        count_nama_unclear_skipped += 1
        continue

    try:
        lng = float(x_lng)
        lat = float(y_lat)
        tipe_rapi = tipe_raw.replace('_', ' ').title()
        
        feature = {
            "type": "Feature",
            "properties": {
                "nama": nama_bersih,
                "tipe": tipe_rapi
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat]
            }
        }
        geojson["features"].append(feature)
    except ValueError:
        continue

with open(file_output, 'w', encoding='utf-8') as out:
    json.dump(geojson, out, indent=4, ensure_ascii=False)

print(f"\n====================================================")
print(f"🔥 PROSES CLEANING SELESAI SECARA ABSOLUT!")
print(f"✅ Titik valid (memiliki nama spesifik): {len(geojson['features'])} objek")
print(f"🗑️ Dibuang (nama generik/tanpa nama): {count_nama_unclear_skipped} baris")
print(f"====================================================")