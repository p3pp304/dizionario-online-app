// Esegui il nostro codice solo quando l'intera pagina HTML è stata caricata e pronta.
document.addEventListener('DOMContentLoaded', () => {
    
    // === 1. SELEZIONE DEGLI ELEMENTI HTML ===
    const dictionarySection = document.getElementById('dictionary-section');
    const bulkAddForm = document.getElementById('bulk-add-form');
    const bulkMessageArea = document.getElementById('bulk-message-area');
    const bulkInput = document.getElementById('bulk-input');
    const letterIndex = document.getElementById('letter-index');

    // Funzione di utilità per mostrare messaggi all'utente
    function showBulkMessage(text, type) {
        bulkMessageArea.textContent = text;
        bulkMessageArea.className = `message ${type}`;
    }

    // === FUNZIONE PER GENERARE L'INDICE DELLE LETTERE (CON LOGICA DI SCORRIMENTO CORRETTA) ===
    function generateLetterIndex(letters) {
        letterIndex.innerHTML = ''; // Pulisce l'indice esistente
        
        letters.sort().forEach(letter => {
            const link = document.createElement('a');
            link.href = `#letter-${letter}`;
            link.textContent = letter;
            
            // --- INIZIO DELLA CORREZIONE ---
            // Gestisce lo scorrimento in modo più affidabile.
            link.addEventListener('click', (e) => {
                e.preventDefault(); // Impedisce il salto brusco del link.
                const targetId = `letter-${letter}`;
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    // Usiamo scrollIntoView(), che gestisce automaticamente lo scorrimento
                    // all'interno del contenitore scrollabile più vicino (il nostro .container).
                    targetElement.scrollIntoView({
                        behavior: 'smooth', // Per un'animazione fluida
                        block: 'start'      // Allinea la parte superiore dell'elemento con la parte superiore del contenitore
                    });
                }
            });
            // --- FINE DELLA CORREZIONE ---
            
            letterIndex.appendChild(link);
        });
    }

    // === 2. FUNZIONE PER CARICARE E VISUALIZZARE L'INTERO DIZIONARIO (MODIFICATA) ===
    async function loadDictionary() {
        try {
            const response = await fetch('/api/vocaboli');
            const vocaboli = await response.json();
            
            dictionarySection.innerHTML = '';
            letterIndex.innerHTML = ''; // Svuota anche l'indice
            
            const availableLetters = Object.keys(vocaboli);
            
            if (availableLetters.length === 0) {
                dictionarySection.innerHTML = '<p>Il dizionario è ancora vuoto. Aggiungi una lista!</p>';
                return;
            }
            
            // Itera su ogni lettera in ordine alfabetico.
            for (const letter of availableLetters.sort()) {
                const letterHeader = document.createElement('h2');
                letterHeader.className = 'section-letter';
                letterHeader.textContent = letter;
                letterHeader.id = `letter-${letter}`; // Aggiunge un ID per il collegamento
                dictionarySection.appendChild(letterHeader);
                
                // Itera su ogni parola di quella lettera.
                for (const word of Object.keys(vocaboli[letter]).sort()) {
                    const data = vocaboli[letter][word];
                    
                    const vocaboloDiv = document.createElement('div');
                    vocaboloDiv.className = 'vocabolo';

                    let html = `<p class="main-line">${word} (${data.pos || ''}) - ${data.definizione || ''}</p>`;
                    let detailsHtml = '';
                    if (data.espressione) detailsHtml += `<div><strong>Espressione:</strong> ${data.espressione}</div>`;
                    if (data.sinonimi) detailsHtml += `<div><strong>Sinonimi:</strong> ${data.sinonimi.join(', ')}</div>`;
                    if (data.contrari) detailsHtml += `<div><strong>Contrari:</strong> ${data.contrari.join(', ')}</div>`;
                    if (data.note) detailsHtml += `<div><strong>Note:</strong> ${data.note.replace(/; /g, '<br>')}</div>`;
                    
                    if (detailsHtml) {
                        html += `<div class="details">${detailsHtml}</div>`;
                    }
                    
                    vocaboloDiv.innerHTML = html;
                    dictionarySection.appendChild(vocaboloDiv);
                }
            }
            
            // Genera l'indice delle lettere dopo aver caricato il dizionario
            generateLetterIndex(availableLetters);

        } catch (error) {
            console.error('Errore nel caricamento del dizionario:', error);
            showBulkMessage('Impossibile caricare il dizionario. Il server è attivo?', 'error');
        }
    }

    // === 3. GESTIONE DELL'INVIO DELLA LISTA (FORM DI INSERIMENTO MASSA) ===
    bulkAddForm.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        const testoCompleto = bulkInput.value.trim();
        if (!testoCompleto) {
            showBulkMessage('La casella di testo è vuota.', 'error');
            return;
        }

        const righe = testoCompleto.split('\n').filter(r => r.trim());
        const vocaboliDaInviare = [];

        for (const riga of righe) {
            const parti = riga.split('|').map(p => p.trim());
            if (parti.length < 2) continue;

            const nuovoVocabolo = {};

            const matchParola = parti[0].match(/^(.*?)\s*\((.*?)\)$/);
            if (!matchParola) continue; 
            nuovoVocabolo.parola = matchParola[1].trim();
            nuovoVocabolo.pos = matchParola[2].trim();
            nuovoVocabolo.definizione = parti[1];

            for (let i = 2; i < parti.length; i++) {
                const matchExtra = parti[i].match(/^(.*?):\s*(.*)$/);
                if (matchExtra) {
                    let chiave = matchExtra[1].trim().toLowerCase().replace(/\s+/g, '_');
                    const valore = matchExtra[2].trim();

                    if (chiave === 'sinonimo') chiave = 'sinonimi';
                    if (chiave === 'contrario') chiave = 'contrari';
                    
                    if (['sinonimi', 'contrari', 'coniugazione'].includes(chiave)) {
                        nuovoVocabolo[chiave] = valore.split(/, | \/ /).map(s => s.trim()).filter(Boolean);
                    } else {
                        nuovoVocabolo[chiave] = valore;
                    }
                }
            }
            vocaboliDaInviare.push(nuovoVocabolo);
        }

        if (vocaboliDaInviare.length === 0) {
            showBulkMessage('Nessun vocabolo valido trovato. Controlla il formato.', 'error');
            return;
        }

        showBulkMessage(`Invio di ${vocaboliDaInviare.length} vocaboli al database...`, 'success');

        try {
            const response = await fetch('/api/add_vocaboli_bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vocaboli: vocaboliDaInviare })
            });
            const result = await response.json();

            if (result.success) {
                showBulkMessage(result.message, 'success');
                bulkInput.value = '';
                loadDictionary();
            } else {
                showBulkMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Errore durante l\'invio:', error);
            showBulkMessage('Errore di comunicazione con il server.', 'error');
        }
    });

    // === 4. PRIMO CARICAMENTO ===
    loadDictionary();
});