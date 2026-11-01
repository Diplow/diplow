"""
Serveur local pour recevoir les transcripts YouTube depuis le navigateur.
Lancer avec : python transcript_server.py

Le JS dans le navigateur envoie le transcript via fetch() POST.
Le serveur écrit le fichier directement dans le même dossier.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os

# Le serveur écrit les fichiers dans son propre dossier
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

class TranscriptHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body)

        filename = data.get('filename', 'transcript.md')
        content = data.get('content', '')

        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        response = json.dumps({
            'status': 'ok',
            'filepath': filepath,
            'chars': len(content)
        })

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response.encode('utf-8'))
        print(f"[OK] {filename} ({len(content)} chars)")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Silence les logs HTTP standards

if __name__ == '__main__':
    port = 8765
    server = HTTPServer(('0.0.0.0', port), TranscriptHandler)
    print(f"Transcript server on http://localhost:{port}")
    print(f"Fichiers écrits dans : {OUTPUT_DIR}")
    print("En attente de transcripts... (Ctrl+C pour arrêter)")
    server.serve_forever()
