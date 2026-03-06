// ═══════════════════════════════════════════════════
// Quick Add IA — Ajout rapide via prompt IA
// Flow: Choix type → Prompt copié → Colle retour → Parse → Création
// ═══════════════════════════════════════════════════

(function () {
    let _qaType = '';      // 'prospect' | 'company' | 'candidate'
    let _qaMode = '';      // 'single' | 'multiple'
    let _qaParsed = null;  // parsed result

    // ─── Open / Close ───
    window.openQuickAddModal = function () {
        const m = document.getElementById('modalQuickAdd');
        if (!m) return;
        _qaType = '';
        _qaMode = '';
        _qaParsed = null;
        document.getElementById('qaStep1').style.display = '';
        document.getElementById('qaStep2Prompt').style.display = 'none';
        document.getElementById('qaStep3Paste').style.display = 'none';
        document.getElementById('qaStep4Preview').style.display = 'none';
        document.querySelectorAll('.qa-card').forEach(c => c.classList.remove('active'));
        m.classList.add('active');
    };

    window.closeQuickAddModal = function () {
        const m = document.getElementById('modalQuickAdd');
        if (m) m.classList.remove('active');
    };

    // ─── Step 1: pick type ───
    window.qaPickType = function (type) {
        _qaType = type;
        document.querySelectorAll('.qa-card').forEach(c => c.classList.remove('active'));
        document.querySelector(`.qa-card[data-type="${type}"]`)?.classList.add('active');
    };

    // ─── Step 2: copy prompt → show instructions ───
    window.qaStartSingle = function () {
        if (!_qaType) { showToast('⚠️ Sélectionnez un type d\'abord', 'warning'); return; }
        _qaMode = 'single';
        _copyPrompt(_qaType, false);
        _showStep2();
    };

    window.qaStartMultiple = function () {
        if (!_qaType) { showToast('⚠️ Sélectionnez un type d\'abord', 'warning'); return; }
        _qaMode = 'multiple';
        _copyPrompt(_qaType, true);
        _showStep2();
    };

    function _showStep2() {
        const labels = { prospect: 'Prospect', company: 'Entreprise', candidate: 'Candidat' };
        document.getElementById('qaStep1').style.display = 'none';
        document.getElementById('qaStep2Prompt').style.display = '';
        document.getElementById('qaPromptInfo').innerHTML =
            `Prompt <strong>${labels[_qaType]}</strong> (${_qaMode === 'single' ? 'un seul' : 'plusieurs'}) copié !`;
    }

    // ─── Step 3: paste area ───
    window.qaGoToPaste = function () {
        document.getElementById('qaStep2Prompt').style.display = 'none';
        document.getElementById('qaStep3Paste').style.display = '';
        document.getElementById('qaPasteTextarea').value = '';
        document.getElementById('qaPasteTextarea').focus();
    };

    window.qaBackToStep1 = function () {
        document.getElementById('qaStep2Prompt').style.display = 'none';
        document.getElementById('qaStep3Paste').style.display = 'none';
        document.getElementById('qaStep4Preview').style.display = 'none';
        document.getElementById('qaStep1').style.display = '';
    };

    // ─── Parse pasted content ───
    window.qaParse = function () {
        const raw = document.getElementById('qaPasteTextarea').value.trim();
        if (!raw) { showToast('⚠️ Collez le retour de l\'IA', 'warning'); return; }

        let parsed = null;

        // Try JSON first
        try {
            const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/);
            let jsonStr = jsonMatch ? jsonMatch[1].trim() : raw;

            // Make JSON parsing more tolerant to common copy/paste issues:
            // - Zero-width chars (U+200B..U+200D) and BOM (U+FEFF)
            // - Extra text before/after JSON
            // - Trailing commas
            jsonStr = String(jsonStr)
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/,\s*([}\]])/g, '$1')
                .trim();

            if (jsonStr && jsonStr[0] !== '{' && jsonStr[0] !== '[') {
                const first = Math.min(
                    jsonStr.indexOf('{') === -1 ? Infinity : jsonStr.indexOf('{'),
                    jsonStr.indexOf('[') === -1 ? Infinity : jsonStr.indexOf('[')
                );
                const last = Math.max(jsonStr.lastIndexOf('}'), jsonStr.lastIndexOf(']'));
                if (first !== Infinity && last !== -1 && last > first) {
                    jsonStr = jsonStr.slice(first, last + 1).trim();
                }
            }

            parsed = JSON.parse(jsonStr);
        } catch (e) {
            // Fallback: parse KEY: value text format
            parsed = _parseTextFormat(raw, _qaType);
        }

        if (!parsed) {
            showToast('⚠️ Format non reconnu. Vérifiez le retour IA.', 'warning');
            return;
        }

        // Normalize to array
        if (!Array.isArray(parsed)) parsed = [parsed];

        _qaParsed = parsed;
        _renderPreview(parsed);
    };

    // ─── Text parser (KEY: value) ───
    function _parseTextFormat(text, type) {
        const fieldMaps = {
            prospect: {
                'NOM': 'name', 'FONCTION': 'fonction', 'ENTREPRISE': '_company_name',
                'TELEPHONE': 'telephone', 'EMAIL': 'email', 'LINKEDIN': 'linkedin',
                'TAGS': 'tags', 'METIER': 'fixedMetier', 'PERTINENCE': 'pertinence',
                'NOTES': 'notes', 'SECTEUR': 'sector'
            },
            company: {
                'NOM': 'groupe', 'GROUPE': 'groupe', 'SITE': 'site',
                'TELEPHONE': 'phone', 'SECTEUR': 'industry', 'TAGS': 'tags',
                'NOTES': 'notes', 'EFFECTIF': 'size', 'ADRESSE': 'address',
                'VILLE': 'city', 'SITE_WEB': 'website', 'LINKEDIN': 'linkedin'
            },
            candidate: {
                'NOM': 'name', 'ROLE': 'role', 'LOCALISATION': 'location',
                'ANNEES_EXPERIENCE': 'years_experience', 'SENIORITE': 'seniority',
                'TECH': 'tech', 'SKILLS': 'skills', 'LINKEDIN': 'linkedin',
                'SOURCE': 'source', 'NOTES': 'notes', 'SECTEUR': 'sector',
                'DISPONIBILITE': '_dispo', 'TJM_ESTIME': '_tjm',
                'PARCOURS': '_parcours', 'TELEPHONE': 'phone', 'EMAIL': 'email'
            }
        };
        const map = fieldMaps[type] || {};
        const obj = {};
        const lines = text.split('\n');
        let currentKey = null, currentValue = '';

        for (const line of lines) {
            const match = line.match(/^([A-ZÀ-Ü_]+)\s*:\s*(.*)$/);
            if (match) {
                if (currentKey) _assignParsedField(obj, currentKey, currentValue, map);
                currentKey = match[1].trim();
                currentValue = match[2].trim();
            } else if (currentKey) {
                currentValue += '\n' + line;
            }
        }
        if (currentKey) _assignParsedField(obj, currentKey, currentValue, map);

        if (Object.keys(obj).length === 0) return null;
        return obj;
    }

    function _assignParsedField(obj, rawKey, rawValue, map) {
        const key = rawKey.toUpperCase().replace(/\s+/g, '_');
        const field = map[key];
        if (!field) return;
        const val = rawValue.trim();
        if (!val || val === '[À TROUVER]' || val === '[INCONNU]' || val === '[VIDE]') return;

        if (field === 'tags' || field === 'skills') {
            obj[field] = val.split(',').map(t => t.trim()).filter(Boolean);
        } else if (field === 'years_experience') {
            const n = parseInt(val);
            obj[field] = isNaN(n) ? null : n;
        } else if (field === 'pertinence') {
            const n = parseInt(val);
            obj[field] = (n >= 1 && n <= 5) ? String(n) : val;
        } else if (field.startsWith('_')) {
            // Append to notes
            obj.notes = (obj.notes || '') + '\n' + rawKey + ': ' + val;
        } else {
            obj[field] = val;
        }
    }

    // ─── Preview ───
    function _renderPreview(items) {
        document.getElementById('qaStep3Paste').style.display = 'none';
        document.getElementById('qaStep4Preview').style.display = '';
        const labels = { prospect: 'Prospect', company: 'Entreprise', candidate: 'Candidat' };
        document.getElementById('qaPreviewTitle').textContent =
            `✅ ${items.length} ${labels[_qaType]}(s) détecté(s)`;

        const container = document.getElementById('qaPreviewList');
        container.innerHTML = items.map((item, i) => {
            const name = item.name || item.groupe || item.nom || `#${i + 1}`;
            const sub = _qaType === 'prospect' ? (item.fonction || item.role || '') :
                        _qaType === 'company' ? (item.site || item.city || '') :
                        (item.role || item.tech || '');
            const tags = item.tags || item.skills || [];
            const tagsHtml = Array.isArray(tags)
                ? tags.slice(0, 6).map(t => `<span class="chip" style="font-size:11px;padding:2px 8px;">${_esc(t)}</span>`).join('')
                : '';

            return `<div class="card" style="padding:12px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${_esc(name)}</strong>
                        ${sub ? `<span class="muted" style="margin-left:8px;">${_esc(sub)}</span>` : ''}
                    </div>
                    <label style="font-size:12px;cursor:pointer;">
                        <input type="checkbox" class="qa-item-check" data-index="${i}" checked> Créer
                    </label>
                </div>
                ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
            </div>`;
        }).join('');
    }

    function _esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function _resolveCompanyIdForItem(item) {
        const companyName = item._company_name || item.entreprise || item.company || '';
        if (!companyName || typeof data === 'undefined') return 0;
        const found = data.companies.find(c =>
            (c.groupe || '').toLowerCase().includes(companyName.toLowerCase()) ||
            companyName.toLowerCase().includes((c.groupe || '').toLowerCase())
        );
        return found ? found.id : 0;
    }

    // ─── Create all ───
    window.qaCreateAll = async function () {
        if (!_qaParsed || _qaParsed.length === 0) return;

        const checks = document.querySelectorAll('.qa-item-check');
        const selectedIndices = new Set();
        checks.forEach(ch => { if (ch.checked) selectedIndices.add(parseInt(ch.dataset.index)); });

        let items = _qaParsed.filter((_, i) => selectedIndices.has(i));
        if (items.length === 0) { showToast('⚠️ Aucun élément sélectionné', 'warning'); return; }

        if (_qaType === 'prospect') {
            const prospectsToCheck = items.map(item => ({
                name: item.name || item.nom || '',
                email: (item.email || '').trim(),
                telephone: (item.telephone || item.phone || '').trim(),
                linkedin: (item.linkedin || '').trim(),
                company_id: _resolveCompanyIdForItem(item) || null
            }));
            try {
                const res = await fetch('/api/prospects/check-duplicates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prospects: prospectsToCheck })
                });
                if (res.ok) {
                    const json = await res.json();
                    const dupList = json.duplicate_indexes || [];
                    if (dupList.length > 0) {
                        const duplicateIndexSet = new Set(dupList.map(d => d.index));
                        const msg = dupList.length === 1
                            ? '1 prospect semble déjà exister (même email, téléphone ou LinkedIn). Ne pas l\'ajouter ?'
                            : dupList.length + ' prospects semblent déjà exister (même email, téléphone ou LinkedIn). Ne pas les ajouter ?';
                        const skipDuplicates = confirm(msg + '\n\nCliquez OK pour ne pas ajouter les doublons, Annuler pour tout ajouter quand même.');
                        if (skipDuplicates) {
                            items = items.filter((_, i) => !duplicateIndexSet.has(i));
                        }
                    }
                }
            } catch (e) {
                console.warn('Check duplicates before add:', e);
            }
        }

        let created = 0, errors = 0;

        for (const item of items) {
            try {
                if (_qaType === 'prospect') await _createProspect(item);
                else if (_qaType === 'company') await _createCompany(item);
                else if (_qaType === 'candidate') await _createCandidate(item);
                created++;
            } catch (e) {
                console.error('QA create error:', e);
                errors++;
            }
        }

        showToast(`✅ ${created} créé(s)${errors > 0 ? ` — ${errors} erreur(s)` : ''}`, created > 0 ? 'success' : 'warning');
        closeQuickAddModal();

        // Refresh data
        if (_qaType === 'prospect' || _qaType === 'company') {
            try { await saveToServerAsync(); } catch (e) { }
            if (typeof filterProspects === 'function') filterProspects();
            if (typeof refreshCompaniesUI === 'function') refreshCompaniesUI();
        }
        if (_qaType === 'candidate' && window.location.pathname === '/sourcing') {
            if (typeof loadCandidates === 'function') loadCandidates();
        }
    };

    // ─── Create functions ───
    async function _createProspect(item) {
        let companyId = 0;
        const companyName = item._company_name || item.entreprise || item.company || '';
        if (companyName && typeof data !== 'undefined') {
            const found = data.companies.find(c =>
                (c.groupe || '').toLowerCase().includes(companyName.toLowerCase()) ||
                companyName.toLowerCase().includes((c.groupe || '').toLowerCase())
            );
            if (found) {
                companyId = found.id;
            } else {
                // Auto-create company
                const newC = {
                    id: Math.max(...data.companies.map(c => c.id), 0) + 1,
                    groupe: companyName, site: '', phone: 'Non disponible', notes: '', tags: []
                };
                data.companies.push(newC);
                companyId = newC.id;
            }
        }

        const newP = {
            id: Math.max(...data.prospects.map(p => p.id), 0) + 1,
            name: item.name || item.nom || '',
            company_id: companyId,
            fonction: item.fonction || item.function || '',
            telephone: item.telephone || item.phone || '',
            email: item.email || '',
            linkedin: item.linkedin || '',
            pertinence: item.pertinence || '',
            statut: item.statut || '',
            lastContact: new Date().toISOString().slice(0, 10),
            notes: (item.notes || '').trim(),
            callNotes: [],
            nextFollowUp: '',
            priority: 2,
            pushEmailSentAt: '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            template_id: null,
            fixedMetier: item.fixedMetier || item.metier || '',
        };
        data.prospects.push(newP);
    }

    async function _createCompany(item) {
        if (typeof data !== 'undefined') {
            const newC = {
                id: Math.max(...data.companies.map(c => c.id), 0) + 1,
                groupe: item.groupe || item.name || item.nom || '',
                site: item.site || item.localisation || '',
                phone: item.phone || item.telephone || 'Non disponible',
                notes: (item.notes || '').trim(),
                tags: Array.isArray(item.tags) ? item.tags : [],
            };
            data.companies.push(newC);
        }
    }

    async function _createCandidate(item) {
        const skills = Array.isArray(item.skills) ? item.skills :
                       (item.skills ? item.skills.split(',').map(s => s.trim()).filter(Boolean) : []);

        let yearsExp = item.years_experience;
        if (yearsExp === undefined || yearsExp === null) {
            // Try to parse from seniority text
            const sen = (item.seniority || item.seniorite || '').toLowerCase();
            if (sen.includes('junior') || sen.includes('0-2')) yearsExp = 1;
            else if (sen.includes('confirmé') || sen.includes('3-5')) yearsExp = 4;
            else if (sen.includes('senior') || sen.includes('6-10')) yearsExp = 8;
            else if (sen.includes('expert') || sen.includes('10+') || sen.includes('15')) yearsExp = 12;
            // Try to extract a number
            else { const m = sen.match(/(\d+)/); if (m) yearsExp = parseInt(m[1]); }
        }

        await fetch('/api/candidates/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: item.name || item.nom || '',
                role: item.role || '',
                location: item.location || item.localisation || '',
                seniority: item.seniority || item.seniorite || '',
                years_experience: yearsExp || null,
                tech: item.tech || '',
                linkedin: item.linkedin || '',
                source: item.source || 'ia_quickadd',
                status: item.status || 'a_sourcer',
                notes: (item.notes || '').trim(),
                skills: skills,
                sector: item.sector || item.secteur || '',
                phone: item.phone || item.telephone || '',
                email: item.email || '',
            })
        });
    }

    // ═══════════════════════════════════════════════════
    // PROMPT GENERATORS
    // ═══════════════════════════════════════════════════

    function _copyPrompt(type, multiple) {
        const prompt = multiple ? _buildMultiPrompt(type) : _buildSinglePrompt(type);
        navigator.clipboard.writeText(prompt).then(() => {
            showToast('🤖 Prompt copié ! Collez-le dans votre IA favorite.', 'success', 4000);
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = prompt; ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('🤖 Prompt copié !', 'success', 3000);
        });
    }

    function _buildSinglePrompt(type) {
        const jsonFormats = {
            prospect: `{
  "name": "Prénom Nom",
  "fonction": "Titre exact du poste",
  "entreprise": "Nom de l'entreprise",
  "telephone": "Numéro direct",
  "email": "email@pro.com",
  "linkedin": "https://linkedin.com/in/...",
  "tags": ["tag1", "tag2", "tag3"],
  "metier": "Métier principal (Électronique / Logiciel embarqué / Mécanique / Systèmes / Automatisme / Robotique / Validation / Chef de projet / Direction technique)",
  "pertinence": "1 à 5",
  "secteur": "automobile, aéronautique, défense...",
  "notes": "Résumé 3-5 lignes: contexte équipe, projets, besoins"
}`,
            company: `{
  "groupe": "Nom du groupe",
  "site": "Localisation / ville du site",
  "phone": "Téléphone standard",
  "industry": "Secteur principal",
  "tags": ["tag1", "tag2", "tag3"],
  "size": "Effectif du site",
  "city": "Ville",
  "website": "https://...",
  "notes": "Résumé activité du site, projets, besoins"
}`,
            candidate: `{
  "name": "Prénom Nom",
  "role": "Titre de poste cible",
  "location": "Ville + mobilité",
  "years_experience": 5,
  "tech": "Technologies principales",
  "skills": ["skill1", "skill2", "skill3"],
  "linkedin": "https://linkedin.com/in/...",
  "sector": "automobile, aéronautique, défense...",
  "phone": "Numéro si trouvé",
  "email": "email@pro.com",
  "notes": "Résumé: parcours, points forts, disponibilité, TJM estimé"
}`
        };

        const contexts = {
            prospect: `un PROSPECT (= un manager / responsable / décideur chez un client potentiel) pour une ESN spécialisée en systèmes embarqués, électronique et ingénierie autour de Lyon`,
            company: `une ENTREPRISE cliente/cible pour une ESN spécialisée en systèmes embarqués, électronique et ingénierie autour de Lyon`,
            candidate: `un CANDIDAT (= ingénieur / consultant potentiel à recruter) pour une ESN spécialisée en systèmes embarqués, électronique et ingénierie`
        };

        return `Tu es un assistant de prospection B2B spécialisé en ingénierie (systèmes embarqués, électronique, robotique, logiciel).

Je dois créer la fiche de ${contexts[type]} dans mon CRM.

Recherche toutes les informations disponibles sur cette personne/entité à partir des documents, liens ou informations que je te fournis.

══════ TAGS TECHNIQUES STANDARDS ══════
AUTOSAR, C/C++, RTOS, Linux embarqué, FPGA, VHDL, Verilog, Python, Java, C#, .NET, ARM, Microcontrôleur, PCB, Altium, KiCad, Yocto, QNX, FreeRTOS, VxWorks, CAN, LIN, Ethernet, TCP/IP, SPI, I2C, UART, JTAG, Modbus, ISO 26262, DO-178, IEC 61508, ADAS, Lidar, Radar, Vision, IA/ML, ROS, Matlab/Simulink, LabVIEW, Banc de test, Qualification, Validation, Electronique analogique, Electronique numérique, Puissance, RF, Mécatronique, CAO mécanique, Catia, SolidWorks, Gestion de projet, Agilité, V-cycle

══════ FORMAT DE SORTIE (JSON strict) ══════
Retourne UNIQUEMENT un objet JSON valide dans ce format :

${jsonFormats[type]}

Pas de markdown, pas de commentaires, juste le JSON.`;
    }

    function _buildMultiPrompt(type) {
        const jsonFormats = {
            prospect: `[
  { "name": "...", "fonction": "...", "entreprise": "...", "telephone": "...", "email": "...", "linkedin": "...", "tags": [...], "metier": "...", "pertinence": "1-5", "notes": "..." },
  ...
]`,
            company: `[
  { "groupe": "...", "site": "...", "phone": "...", "industry": "...", "tags": [...], "size": "...", "notes": "..." },
  ...
]`,
            candidate: `[
  { "name": "...", "role": "...", "location": "...", "years_experience": 5, "skills": [...], "linkedin": "...", "sector": "...", "notes": "..." },
  ...
]`
        };

        const contexts = {
            prospect: `des PROSPECTS (managers / responsables / décideurs)`,
            company: `des ENTREPRISES clientes/cibles`,
            candidate: `des CANDIDATS (ingénieurs / consultants)`
        };

        return `Tu es un assistant de prospection B2B spécialisé en ingénierie (systèmes embarqués, électronique, robotique, logiciel).

Je dois créer les fiches de ${contexts[type]} dans mon CRM pour une ESN spécialisée en systèmes embarqués, électronique et ingénierie autour de Lyon.

À partir des documents, liens ou informations que je te fournis, extrais toutes les fiches possibles.

══════ TAGS TECHNIQUES STANDARDS ══════
AUTOSAR, C/C++, RTOS, Linux embarqué, FPGA, VHDL, Verilog, Python, Java, C#, ARM, Microcontrôleur, PCB, Altium, KiCad, Yocto, QNX, FreeRTOS, VxWorks, CAN, LIN, Ethernet, TCP/IP, SPI, I2C, UART, ISO 26262, DO-178, ADAS, Lidar, Radar, Vision, IA/ML, ROS, Matlab/Simulink, LabVIEW, Banc de test, Validation, Electronique analogique, Electronique numérique, Puissance, RF, Mécatronique, CAO mécanique, Catia, SolidWorks, Gestion de projet, Agilité, V-cycle

══════ FORMAT DE SORTIE (JSON array strict) ══════
Retourne UNIQUEMENT un array JSON valide :

${jsonFormats[type]}

Pas de markdown, pas de commentaires, juste le JSON array.`;
    }

    // ─── Auto-open candidate modal if ?add=1 on sourcing page ───
    if (window.location.pathname === '/sourcing' && new URLSearchParams(window.location.search).get('add') === '1') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(function () {
                if (typeof openCandidateModal === 'function') openCandidateModal(false);
            }, 600);
        });
    }

})();
