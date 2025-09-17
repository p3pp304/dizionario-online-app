import os
from flask import Flask, request, jsonify, render_template
from sqlalchemy import create_engine, text

app = Flask(__name__)

# --- CONFIGURAZIONE DATABASE ---
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    raise ValueError("ERRORE: La variabile DATABASE_URL non è stata trovata! Configurala nel launch.json.")

engine = create_engine(DB_URL, connect_args={"connect_timeout": 15})

# --- FUNZIONE DI SETUP DEL DATABASE (MODIFICATA) ---
def setup_database():
    try:
        with engine.connect() as conn:
            # MODIFICATO: Aggiunta la colonna 'note' alla definizione della tabella.
            # Questo assicura che se la tabella viene creata da zero, avrà la colonna corretta.
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS vocaboli (
                    id SERIAL PRIMARY KEY,
                    parola VARCHAR(255) UNIQUE NOT NULL,
                    definizione TEXT,
                    pos VARCHAR(50),
                    espressione TEXT,
                    sinonimi TEXT[],
                    contrari TEXT[],
                    note TEXT 
                );
            """))
            conn.commit()
            print("✅ Database e tabella 'vocaboli' pronti.")
    except Exception as e:
        print(f"❌ IMPOSSIBILE CONFIGURARE IL DATABASE: {e}")
        raise

# --- API e ROUTE ---

# Route per servire la pagina principale (HTML)
@app.route('/')
def index():
    return render_template('index.html')

# API per ottenere la lista completa dei vocaboli
@app.route('/api/vocaboli', methods=['GET'])
def get_vocaboli():
    vocaboli_organizzati = {}
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM vocaboli ORDER BY parola ASC"))
        for row in result.mappings():
            parola = row['parola']
            prima_lettera = parola[0].upper()
            if prima_lettera not in vocaboli_organizzati:
                vocaboli_organizzati[prima_lettera] = {}
            # Questa parte ora includerà automaticamente la nuova colonna 'note' se presente
            dati_puliti = {k: v for k, v in row.items() if v is not None and k not in ['id', 'parola']}
            vocaboli_organizzati[prima_lettera][parola] = dati_puliti
    return jsonify(vocaboli_organizzati)

# --- NUOVA API PER L'INSERIMENTO DI MASSA (BULK) ---
# --- API PER L'INSERIMENTO DI MASSA (CON CONTROLLO PASSWORD) ---
@app.route('/api/add_vocaboli_bulk', methods=['POST'])
def add_vocaboli_bulk():
    # 1. Leggi la password segreta dal server (Render/launch.json)
    SECRET_KEY = os.environ.get('INSERT_KEY')
    if not SECRET_KEY:
        return jsonify({'success': False, 'message': 'Errore di configurazione del server.'}), 500

    # 2. Prendi i dati inviati dal front-end
    data = request.json
    chiave_inserita = data.get('chiave', '')
    vocaboli_da_aggiungere = data.get('vocaboli', [])

    # 3. VERIFICA LA PASSWORD
    if chiave_inserita != SECRET_KEY:
        return jsonify({'success': False, 'message': 'Password di inserimento non corretta!'}), 403

    # 4. Se la password è corretta, procedi
    if not vocaboli_da_aggiungere:
        return jsonify({'success': False, 'message': 'Nessun vocabolo da aggiungere.'}), 400

    conteggio_successi = 0
    try:
        with engine.connect() as conn:
            trans = conn.begin() 
            for voce in vocaboli_da_aggiungere:
                parola = voce.get('parola', '').strip().capitalize()
                if not parola:
                    continue 

                note_extra_items = {k: v for k, v in voce.items() if k not in ['parola', 'definizione', 'pos', 'espressione', 'sinonimi', 'contrari']}
                note_extra_string = "; ".join([f"{k.replace('_', ' ').capitalize()}: {v}" for k, v in note_extra_items.items() if v])

                stmt = text("""
                    INSERT INTO vocaboli (parola, definizione, pos, espressione, sinonimi, contrari, note)
                    VALUES (:parola, :definizione, :pos, :espressione, :sinonimi, :contrari, :note)
                    ON CONFLICT (parola) DO UPDATE SET
                        definizione = EXCLUDED.definizione, pos = EXCLUDED.pos,
                        espressione = EXCLUDED.espressione, sinonimi = EXCLUDED.sinonimi,
                        contrari = EXCLUDED.contrari, note = EXCLUDED.note;
                """)
                conn.execute(stmt, {
                    'parola': parola,
                    'definizione': voce.get('definizione'),
                    'pos': voce.get('pos'),
                    'espressione': voce.get('espressione'),
                    'sinonimi': voce.get('sinonimi'),
                    'contrari': voce.get('contrari'),
                    'note': note_extra_string if note_extra_string else None
                })
                conteggio_successi += 1
            
            trans.commit()
            
        return jsonify({'success': True, 'message': f"{conteggio_successi} vocaboli aggiunti/aggiornati!"})
    except Exception as e:
        print(f"❌ ERRORE DATABASE DURANTE INSERIMENTO BULK: {e}")
        return jsonify({'success': False, 'message': 'Errore interno del server.'}), 500
# --- AVVIO DELL'APPLICAZIONE ---
if __name__ == '__main__':
    setup_database()
    app.run(host='0.0.0.0', port=5000, debug=True)