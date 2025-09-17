document.addEventListener('DOMContentLoaded', () => {

    // === 1. SELEZIONE DEGLI ELEMENTI (definiti una sola volta) ===
    const dictionarySection = document.getElementById('dictionary-section');
    const bulkAddForm = document.getElementById('bulk-add-form');
    const bulkMessageArea = document.getElementById('bulk-message-area');
    const bulkInput = document.getElementById('bulk-input');
    const alphabetIndex = document.getElementById('alphabet-index');
    
    // Elementi del Pop-up
    const modalOverlay = document.getElementById('password-modal');
    const modalConfirmButton = document.getElementById('modal-confirm-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalInsertKey = document.getElementById('modal-insert-key');

    // Funzione di utilità per mostrare messaggi (con auto-chiusura)
    function showMessage(text, type) {
        if (!bulkMessageArea) return;
        bulkMessageArea.textContent = text;
        bulkMessageArea.className = `message ${type}`;
        bulkMessageArea.style.display = 'block';
        setTimeout(() => {
            bulkMessageArea.style.display = 'none';
        }, 4000); // Nasconde il messaggio dopo 4 secondi
    }

    // === 2. GESTIONE DEL DIZIONARIO E DELL'INDICE ===
    
    // === FUNZIONE PER GENERARE L'INDICE DINAMICO (CORRETTA) ===
    function generateLetterIndex(letterePresenti) {
        if (!alphabetIndex) return;
        alphabetIndex.innerHTML = ''; // Pulisce l'indice
        
        const alfabetoCompleto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        alfabetoCompleto.forEach(lettera => {
            const link = document.createElement('a');
            link.href = `#letter-${lettera}`;
            link.textContent = lettera;

            // === QUESTA È LA LOGICA "DINAMICA" FONDAMENTALE ===
            // Controlla se la lettera corrente dell'alfabeto è presente
            // nella lista delle lettere che abbiamo ricevuto dal database.
            if (!letterePresenti.includes(lettera)) {
                // Se non è presente, aggiungi la classe CSS 'disabled'.
                link.classList.add('disabled');
            }
            // =======================================================
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetElement = document.getElementById(`letter-${lettera}`);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            alphabetIndex.appendChild(link);
        });
    }

    // Funzione principale per caricare e visualizzare il dizionario
    async function loadDictionary() {
        try {
            const response = await fetch('/api/vocaboli');
            const vocaboli = await response.json();
            
            dictionarySection.innerHTML = '';
            const availableLetters = Object.keys(vocaboli);
            
            if (availableLetters.length === 0) {
                dictionarySection.innerHTML = '<p>Il dizionario è ancora vuoto. Aggiungi una lista!</p>';
                if(alphabetIndex) alphabetIndex.innerHTML = '';
                return;
            }
            
            availableLetters.sort().forEach(letter => {
                const letterHeader = document.createElement('h2');
                letterHeader.className = 'section-letter';
                letterHeader.textContent = letter;
                letterHeader.id = `letter-${letter}`;
                dictionarySection.appendChild(letterHeader);
                
                Object.keys(vocaboli[letter]).sort().forEach(word => {
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
                });
            });
            
            generateLetterIndex(availableLetters);

        } catch (error) {
            console.error('Errore nel caricamento del dizionario:', error);
            showMessage('Impossibile caricare il dizionario. Server non attivo?', 'error');
        }
    }

    // === 3. GESTIONE DEL POP-UP E DELL'INVIO DATI ===
    
    // Funzioni per mostrare/nascondere il pop-up
    function showPasswordModal() {
        if (!modalOverlay) return;
        modalOverlay.style.display = 'flex';
        setTimeout(() => modalOverlay.classList.add('visible'), 10);
        modalInsertKey.focus();
    }
    function hidePasswordModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('visible');
        setTimeout(() => {
            modalOverlay.style.display = 'none';
            modalInsertKey.value = '';
        }, 300); // Attende la fine dell'animazione di chiusura
    }

    // Event listener per il pulsante principale "Aggiungi la Lista"
    console.log("Sto per aggiungere l'listener al form:", bulkAddForm);
    bulkAddForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const testoCompleto = bulkInput.value.trim();
        if (!testoCompleto) {
            showMessage('La casella di testo è vuota.', 'error');
            return;
        }
        showPasswordModal(); // Apre il pop-up
    });

    // Event listener per il pulsante "Conferma" nel pop-up
    modalConfirmButton.addEventListener('click', async () => {
        const chiaveInserita = modalInsertKey.value;
        const testoCompleto = bulkInput.value.trim();
        
        if (!chiaveInserita) {
            alert('Per favore, inserisci la password.');
            modalInsertKey.focus();
            return;
        }
        
        const righe = testoCompleto.split('\n').filter(r => r.trim());
        const vocaboliDaInviare = [];
        
        // La tua logica di parsing (è corretta, quindi la mantengo)
        righe.forEach(riga => {
            const parti = riga.split('|').map(p => p.trim());
            if (parti.length < 2) return;
            const nuovoVocabolo = {};
            const matchParola = parti[0].match(/^(.*?)\s*\((.*?)\)$/);
            if (!matchParola) return;
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
        });
        
        if (vocaboliDaInviare.length === 0) {
            showMessage('Nessun vocabolo valido trovato. Controlla il formato.', 'error');
            hidePasswordModal();
            return;
        }

        showMessage(`Invio di ${vocaboliDaInviare.length} vocaboli...`, 'success');
        hidePasswordModal();

        try {
            const response = await fetch('/api/add_vocaboli_bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vocaboli: vocaboliDaInviare, chiave: chiaveInserita })
            });
            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                bulkInput.value = '';
                loadDictionary(); // Ricarica tutto per mostrare i nuovi dati
            } else {
                showMessage(result.message, 'error');
            }
        } catch (error) {
            showMessage('Errore di comunicazione con il server.', 'error');
        }
    });
    
    // Event listener per chiudere il pop-up
    modalCancelButton.addEventListener('click', hidePasswordModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) hidePasswordModal();
    });

    // === 4. PRIMO CARICAMENTO ===
    loadDictionary();
});