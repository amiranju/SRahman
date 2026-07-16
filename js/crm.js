/**
 * Portfolio Content Management System (CMS) Logic
 * Auto-detects local workspace files, supports photo uploading into photo/ folder, and direct disk saving.
 */

// Application State
const CMSState = {
    dirHandle: null,
    files: {}, // filename -> content string
    pendingAvatarFile: null, // { filename, relPath, blob }
    modified: new Set(),
    data: {
        components: {
            name: '',
            role: '',
            institution: '',
            avatar: '',
            socials: []
        },
        index: {
            about: [],
            keyAreas: [],
            education: [],
            conferences: [],
            awards: [],
            affiliations: []
        },
        publications: {
            items: [],
            note: ''
        },
        projects: {
            current: [],
            past: []
        },
        fieldworks: {
            heading: '',
            description: ''
        },
        teaching: {
            experiences: [],
            trainings: []
        },
        contact: {
            intro: '',
            email: ''
        }
    }
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEventListeners();
    autoLoadWorkspaceFiles();
});

// Sidebar Navigation Tabs
function initNavigation() {
    const navItems = document.querySelectorAll('.cms-nav .nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            if (!tabId) return;

            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const activePane = document.getElementById(`tab-${tabId}`);
            if (activePane) {
                activePane.classList.add('active');
                document.getElementById('page-title-text').innerText = item.innerText.trim();
            }
        });
    });
}

function initEventListeners() {
    // Save Button
    document.getElementById('btn-save-all').addEventListener('click', saveAllFiles);

    // Live Preview Modal
    document.getElementById('btn-preview').addEventListener('click', openPreviewModal);
    document.getElementById('btn-close-preview').addEventListener('click', closePreviewModal);

    // Modal Background Overlay Clicks
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

// Handle Profile Photo File Selection
function handleAvatarFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const relPath = `photo/${file.name}`;
    
    // Immediate thumbnail preview
    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('avatar-preview-img').src = evt.target.result;
    };
    reader.readAsDataURL(file);

    // Update text input & state
    document.getElementById('sidebar-avatar').value = relPath;
    CMSState.pendingAvatarFile = {
        filename: file.name,
        relPath: relPath,
        blob: file
    };

    showToast(`Selected new photo: ${relPath}. Click "Save All Changes" to save to disk!`, 'success');
}

// ----------------------------------------------------
// 1. AUTOMATIC WORKSPACE FILE DISCOVERY & LOADING
// ----------------------------------------------------
async function autoLoadWorkspaceFiles() {
    const targetFiles = [
        'index.html',
        'publications.html',
        'projects.html',
        'fieldworks.html',
        'teaching.html',
        'contact.html',
        'js/components.js'
    ];

    let loadedCount = 0;

    for (const relPath of targetFiles) {
        try {
            const response = await fetch(`./${relPath}`, { cache: 'no-cache' });
            if (response.ok) {
                const text = await response.text();
                CMSState.files[relPath] = { content: text };
                loadedCount++;
            }
        } catch (e) {
            // file:// cross-origin restriction in modern browsers
        }
    }

    if (loadedCount > 0) {
        parseAllFiles();
        renderAllForms();
        updateWorkspaceStatus(true, 'HTTP Auto-Detected');
        showToast('Local workspace loaded automatically!', 'success');
    } else {
        updateWorkspaceStatus(false);
        showLocalFileNotice();
    }
}

function showLocalFileNotice() {
    const banner = document.getElementById('local-file-banner');
    if (banner) {
        banner.style.display = 'block';
    }
}

async function requestDirectoryAccess() {
    if (!('showDirectoryPicker' in window)) {
        showToast('Your browser does not support local directory access. Please use Chrome, Edge, or Brave.', 'error');
        return;
    }

    try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        CMSState.dirHandle = dirHandle;
        
        await readWorkspaceFromDirHandle(dirHandle);

        const banner = document.getElementById('local-file-banner');
        if (banner) banner.style.display = 'none';

        updateWorkspaceStatus(true, dirHandle.name);
        showToast(`Repository folder '${dirHandle.name}' connected! All files loaded.`, 'success');
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error selecting directory:', err);
            showToast('Failed to access folder: ' + err.message, 'error');
        }
    }
}

async function readWorkspaceFromDirHandle(dirHandle) {
    const targetFiles = [
        'index.html',
        'publications.html',
        'projects.html',
        'fieldworks.html',
        'teaching.html',
        'contact.html',
        'js/components.js'
    ];

    for (const relPath of targetFiles) {
        try {
            let fileHandle;
            if (relPath.includes('/')) {
                const parts = relPath.split('/');
                const subDir = await dirHandle.getDirectoryHandle(parts[0]);
                fileHandle = await subDir.getFileHandle(parts[1]);
            } else {
                fileHandle = await dirHandle.getFileHandle(relPath);
            }

            const file = await fileHandle.getFile();
            const text = await file.text();
            CMSState.files[relPath] = { content: text };
        } catch (e) {
            console.warn(`Could not load ${relPath} from handle:`, e);
        }
    }

    parseAllFiles();
    renderAllForms();
}

function updateWorkspaceStatus(connected, detail = '') {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    if (connected) {
        dot.classList.add('connected');
        text.innerText = `Workspace Ready ${detail ? '(' + detail + ')' : ''}`;
    } else {
        dot.classList.remove('connected');
        text.innerText = 'Local File Access Required';
    }
}

// ----------------------------------------------------
// 2. PARSING LOGIC (DOM Parser)
// ----------------------------------------------------
function parseAllFiles() {
    const parser = new DOMParser();

    // 2.1 Parse js/components.js
    if (CMSState.files['js/components.js']) {
        const jsText = CMSState.files['js/components.js'].content;
        const sidebarMatch = jsText.match(/sidebar\.innerHTML\s*=\s*`([\s\S]*?)`;/);
        if (sidebarMatch) {
            const sidebarHtml = sidebarMatch[1];
            const doc = parser.parseFromString(sidebarHtml, 'text/html');

            const nameEl = doc.querySelector('h1');
            const roleEl = doc.querySelector('p');
            const imgEl = doc.querySelector('img');

            if (nameEl) CMSState.data.components.name = nameEl.innerText.trim();
            if (roleEl) CMSState.data.components.role = roleEl.innerHTML.trim();
            if (imgEl) CMSState.data.components.avatar = imgEl.getAttribute('src') || '';

            const socialLinks = [];
            doc.querySelectorAll('ul li a').forEach(a => {
                const icon = a.querySelector('i');
                const iconClass = icon ? icon.className.replace(/\b(w-6|text-brand-green)\b/g, '').trim() : 'fas fa-link';
                const href = a.getAttribute('href') || '#';
                const label = a.innerText.trim();
                socialLinks.push({ label, href, iconClass });
            });
            CMSState.data.components.socials = socialLinks;
        }
    }

    // 2.2 Parse index.html
    if (CMSState.files['index.html']) {
        const doc = parser.parseFromString(CMSState.files['index.html'].content, 'text/html');

        const aboutSec = doc.getElementById('about');
        if (aboutSec) {
            CMSState.data.index.about = Array.from(aboutSec.querySelectorAll('p')).map(p => p.innerHTML.trim());
        }

        const keySec = doc.getElementById('key-areas');
        if (keySec) {
            CMSState.data.index.keyAreas = Array.from(keySec.querySelectorAll('li')).map(li => {
                return li.innerText.replace(/^[\s\S]*?\s/, '').trim();
            });
        }

        const eduSec = doc.getElementById('education');
        if (eduSec) {
            CMSState.data.index.education = Array.from(eduSec.querySelectorAll('.pt-4')).map(item => {
                const title = item.querySelector('.font-semibold')?.innerText.trim() || '';
                const meta = item.querySelector('.text-emerald-700')?.innerText.trim() || '';
                const paras = Array.from(item.querySelectorAll('p')).map(p => p.innerHTML.trim());
                return { title, meta, paragraphs: paras };
            });
        }

        const confSec = doc.getElementById('conferences');
        if (confSec) {
            CMSState.data.index.conferences = Array.from(confSec.querySelectorAll('.pt-4')).map(item => {
                const title = item.querySelector('.font-semibold')?.innerText.trim() || '';
                const desc = item.querySelector('p')?.innerHTML.trim() || '';
                return { title, description: desc };
            });
        }

        const awardsSec = doc.getElementById('awards');
        if (awardsSec) {
            CMSState.data.index.awards = Array.from(awardsSec.querySelectorAll('li')).map(li => li.innerHTML.trim());
        }

        const affSec = doc.getElementById('affiliations');
        if (affSec) {
            CMSState.data.index.affiliations = Array.from(affSec.querySelectorAll('li')).map(li => li.innerHTML.trim());
        }
    }

    // 2.3 Parse publications.html
    if (CMSState.files['publications.html']) {
        const doc = parser.parseFromString(CMSState.files['publications.html'].content, 'text/html');
        const pubSec = doc.getElementById('publications');
        if (pubSec) {
            CMSState.data.publications.items = Array.from(pubSec.querySelectorAll('.pt-4')).map(item => {
                const title = item.querySelector('.font-semibold')?.innerText.trim() || '';
                const meta = item.querySelector('.text-emerald-700')?.innerText.trim() || '';
                return { title, meta };
            });

            const noteEl = pubSec.querySelector('p em');
            if (noteEl) CMSState.data.publications.note = noteEl.innerText.trim();
        }
    }

    // 2.4 Parse projects.html
    if (CMSState.files['projects.html']) {
        const doc = parser.parseFromString(CMSState.files['projects.html'].content, 'text/html');
        const projSec = doc.getElementById('projects');
        if (projSec) {
            CMSState.data.projects.current = [];
            CMSState.data.projects.past = [];

            let currentCategory = 'current';
            Array.from(projSec.children).forEach(child => {
                if (child.tagName === 'H2') {
                    if (child.innerText.toLowerCase().includes('past')) {
                        currentCategory = 'past';
                    } else {
                        currentCategory = 'current';
                    }
                } else if (child.classList && child.classList.contains('space-y-6')) {
                    const items = Array.from(child.querySelectorAll('.pt-4'));
                    items.forEach(item => {
                        const title = item.querySelector('.font-semibold')?.innerText.trim() || '';
                        const meta = item.querySelector('.text-emerald-700')?.innerText.trim() || '';
                        const desc = item.querySelector('p')?.innerHTML.trim() || '';
                        
                        const projectObj = { title, meta, description: desc };
                        if (currentCategory === 'current') {
                            CMSState.data.projects.current.push(projectObj);
                        } else {
                            CMSState.data.projects.past.push(projectObj);
                        }
                    });
                }
            });
        }
    }

    // 2.5 Parse fieldworks.html
    if (CMSState.files['fieldworks.html']) {
        const doc = parser.parseFromString(CMSState.files['fieldworks.html'].content, 'text/html');
        const fwSec = doc.getElementById('field-works');
        if (fwSec) {
            const h2 = fwSec.querySelector('h2');
            const p = fwSec.querySelector('p');
            if (h2) CMSState.data.fieldworks.heading = h2.innerText.trim();
            if (p) CMSState.data.fieldworks.description = p.innerHTML.trim();
        }
    }

    // 2.6 Parse teaching.html
    if (CMSState.files['teaching.html']) {
        const doc = parser.parseFromString(CMSState.files['teaching.html'].content, 'text/html');
        const teachSec = doc.getElementById('teaching');
        if (teachSec) {
            CMSState.data.teaching.experiences = [];
            CMSState.data.teaching.trainings = [];

            let currentCategory = 'experiences';
            Array.from(teachSec.children).forEach(child => {
                if (child.tagName === 'H2') {
                    if (child.innerText.toLowerCase().includes('training')) {
                        currentCategory = 'trainings';
                    } else {
                        currentCategory = 'experiences';
                    }
                } else if (child.classList && child.classList.contains('space-y-6')) {
                    const items = Array.from(child.querySelectorAll('.pt-4, .pt-2'));
                    items.forEach(item => {
                        const title = item.querySelector('.font-semibold')?.innerText.trim() || '';
                        const meta = item.querySelector('.text-emerald-700')?.innerText.trim() || '';
                        
                        if (currentCategory === 'experiences') {
                            const bullets = Array.from(item.querySelectorAll('ul li')).map(li => li.innerHTML.trim());
                            const pText = item.querySelector('p')?.innerHTML.trim() || '';
                            CMSState.data.teaching.experiences.push({ title, meta, bullets, description: pText });
                        } else {
                            const desc = item.querySelector('p')?.innerHTML.trim() || '';
                            CMSState.data.teaching.trainings.push({ title, meta, description: desc });
                        }
                    });
                }
            });
        }
    }

    // 2.7 Parse contact.html
    if (CMSState.files['contact.html']) {
        const doc = parser.parseFromString(CMSState.files['contact.html'].content, 'text/html');
        const contactSec = doc.getElementById('contact');
        if (contactSec) {
            const pIntro = contactSec.querySelector('p');
            if (pIntro) CMSState.data.contact.intro = pIntro.innerHTML.trim();

            const emailLink = contactSec.querySelector('a[href^="mailto:"]');
            if (emailLink) CMSState.data.contact.email = emailLink.innerText.trim();
        }
    }
}

// ----------------------------------------------------
// 3. RENDER UI FORMS
// ----------------------------------------------------
function renderAllForms() {
    renderStats();
    renderSidebarForm();
    renderHomeForm();
    renderPublicationsForm();
    renderProjectsForm();
    renderFieldworksForm();
    renderTeachingForm();
    renderContactForm();
}

function renderStats() {
    document.getElementById('stat-publications').innerText = CMSState.data.publications.items.length;
    document.getElementById('stat-projects').innerText = CMSState.data.projects.current.length + CMSState.data.projects.past.length;
    document.getElementById('stat-education').innerText = CMSState.data.index.education.length;
}

// Render Settings & Sidebar Form
function renderSidebarForm() {
    const c = CMSState.data.components;
    document.getElementById('sidebar-name').value = c.name || '';
    document.getElementById('sidebar-role').value = c.role.replace(/<br\s*\/?>/gi, '\n') || '';
    document.getElementById('sidebar-avatar').value = c.avatar || '';

    const imgPreview = document.getElementById('avatar-preview-img');
    if (imgPreview) {
        imgPreview.src = c.avatar || 'photo/profile.jpg';
    }

    const socialsContainer = document.getElementById('sidebar-socials-list');
    socialsContainer.innerHTML = '';

    c.socials.forEach((social, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">Link #${idx + 1}: ${social.label}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeSocial(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Label</label>
                <input type="text" class="form-control" value="${social.label}" onchange="updateSocial(${idx}, 'label', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">URL / Href</label>
                <input type="text" class="form-control" value="${social.href}" onchange="updateSocial(${idx}, 'href', this.value)">
            </div>
            <div class="form-group">
                <label class="form-label">Icon Class (FontAwesome)</label>
                <input type="text" class="form-control" value="${social.iconClass}" onchange="updateSocial(${idx}, 'iconClass', this.value)">
            </div>
        `;
        socialsContainer.appendChild(div);
    });
}

function updateSocial(index, key, value) {
    CMSState.data.components.socials[index][key] = value;
}

function removeSocial(index) {
    CMSState.data.components.socials.splice(index, 1);
    renderSidebarForm();
}

function addSocialLink() {
    CMSState.data.components.socials.push({
        label: 'New Link',
        href: '#',
        iconClass: 'fas fa-link'
    });
    renderSidebarForm();
}

// Render Home Form
function renderHomeForm() {
    const aboutList = document.getElementById('home-about-list');
    aboutList.innerHTML = '';
    CMSState.data.index.about.forEach((para, idx) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <label class="form-label">Paragraph #${idx + 1}</label>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeAboutPara(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <textarea class="form-control" rows="3" onchange="updateAboutPara(${idx}, this.value)">${para}</textarea>
        `;
        aboutList.appendChild(div);
    });

    const keyContainer = document.getElementById('home-key-areas');
    keyContainer.value = CMSState.data.index.keyAreas.join('\n');

    const eduList = document.getElementById('home-education-list');
    eduList.innerHTML = '';
    CMSState.data.index.education.forEach((edu, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${edu.title || 'Degree'}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeEducation(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Degree & Year</label>
                <input type="text" class="form-control" value="${edu.title}" onchange="CMSState.data.index.education[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Institution & Country</label>
                <input type="text" class="form-control" value="${edu.meta}" onchange="CMSState.data.index.education[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Details / Topics (One line per entry)</label>
                <textarea class="form-control" rows="2" onchange="updateEduParas(${idx}, this.value)">${edu.paragraphs ? edu.paragraphs.join('\n') : ''}</textarea>
            </div>
        `;
        eduList.appendChild(div);
    });

    const confList = document.getElementById('home-conferences-list');
    confList.innerHTML = '';
    CMSState.data.index.conferences.forEach((conf, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${conf.title || 'Conference'}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeConference(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Conference Title</label>
                <input type="text" class="form-control" value="${conf.title}" onchange="CMSState.data.index.conferences[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Presentation Details & Location</label>
                <textarea class="form-control" rows="2" onchange="CMSState.data.index.conferences[${idx}].description = this.value">${conf.description}</textarea>
            </div>
        `;
        confList.appendChild(div);
    });

    document.getElementById('home-awards').value = CMSState.data.index.awards.join('\n');
    document.getElementById('home-affiliations').value = CMSState.data.index.affiliations.join('\n');
}

function updateAboutPara(idx, val) { CMSState.data.index.about[idx] = val; }
function removeAboutPara(idx) { CMSState.data.index.about.splice(idx, 1); renderHomeForm(); }
function addAboutPara() { CMSState.data.index.about.push('New paragraph text...'); renderHomeForm(); }

function updateEduParas(idx, text) {
    CMSState.data.index.education[idx].paragraphs = text.split('\n').filter(l => l.trim() !== '');
}
function removeEducation(idx) { CMSState.data.index.education.splice(idx, 1); renderHomeForm(); }
function addEducationItem() {
    CMSState.data.index.education.push({ title: 'New Degree (Year)', meta: 'University, Country', paragraphs: [] });
    renderHomeForm();
}

function removeConference(idx) { CMSState.data.index.conferences.splice(idx, 1); renderHomeForm(); }
function addConferenceItem() {
    CMSState.data.index.conferences.push({ title: 'Conference Name', description: 'Presentation details...' });
    renderHomeForm();
}

// Render Publications Form
function renderPublicationsForm() {
    const container = document.getElementById('publications-list');
    container.innerHTML = '';

    CMSState.data.publications.items.forEach((pub, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">Article #${idx + 1}</span>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary btn-icon-only" onclick="movePublication(${idx}, -1)"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-sm btn-secondary btn-icon-only" onclick="movePublication(${idx}, 1)"><i class="fas fa-arrow-down"></i></button>
                    <button class="btn btn-sm btn-danger btn-icon-only" onclick="removePublication(${idx})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Article Title</label>
                <input type="text" class="form-control" value="${pub.title}" onchange="CMSState.data.publications.items[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Authors & Journal Metadata</label>
                <input type="text" class="form-control" value="${pub.meta}" onchange="CMSState.data.publications.items[${idx}].meta = this.value">
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('publications-note').value = CMSState.data.publications.note || '';
}

function removePublication(idx) { CMSState.data.publications.items.splice(idx, 1); renderPublicationsForm(); renderStats(); }
function movePublication(idx, dir) {
    const arr = CMSState.data.publications.items;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[targetIdx];
    arr[targetIdx] = temp;
    renderPublicationsForm();
}
function addPublicationItem() {
    CMSState.data.publications.items.unshift({ title: 'New Article Title', meta: 'Author, A. B. 2025. Journal Name, 12, 100.' });
    renderPublicationsForm();
    renderStats();
}

// Render Projects Form
function renderProjectsForm() {
    const currContainer = document.getElementById('projects-current-list');
    currContainer.innerHTML = '';
    CMSState.data.projects.current.forEach((proj, idx) => {
        currContainer.appendChild(createProjectCard(proj, idx, 'current'));
    });

    const pastContainer = document.getElementById('projects-past-list');
    pastContainer.innerHTML = '';
    CMSState.data.projects.past.forEach((proj, idx) => {
        pastContainer.appendChild(createProjectCard(proj, idx, 'past'));
    });
}

function createProjectCard(proj, idx, cat) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div class="item-card-header">
            <span class="item-card-title">${proj.title || 'Project Title'}</span>
            <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeProject('${cat}', ${idx})"><i class="fas fa-trash"></i></button>
        </div>
        <div class="form-group">
            <label class="form-label">Project Name</label>
            <input type="text" class="form-control" value="${proj.title}" onchange="CMSState.data.projects.${cat}[${idx}].title = this.value">
        </div>
        <div class="form-group">
            <label class="form-label">Role & Funder Metadata</label>
            <input type="text" class="form-control" value="${proj.meta}" onchange="CMSState.data.projects.${cat}[${idx}].meta = this.value">
        </div>
        <div class="form-group">
            <label class="form-label">Short Description (Optional)</label>
            <textarea class="form-control" rows="2" onchange="CMSState.data.projects.${cat}[${idx}].description = this.value">${proj.description || ''}</textarea>
        </div>
    `;
    return div;
}

function removeProject(cat, idx) {
    CMSState.data.projects[cat].splice(idx, 1);
    renderProjectsForm();
    renderStats();
}
function addProjectItem(cat) {
    CMSState.data.projects[cat].unshift({ title: 'New Project Title', meta: 'Role: Principal Investigator | Funded by: Cell', description: '' });
    renderProjectsForm();
    renderStats();
}

// Render Fieldworks Form
function renderFieldworksForm() {
    document.getElementById('fieldworks-heading').value = CMSState.data.fieldworks.heading || 'Field Works';
    document.getElementById('fieldworks-desc').value = CMSState.data.fieldworks.description || '';
}

// Render Teaching Form
function renderTeachingForm() {
    const expContainer = document.getElementById('teaching-experiences-list');
    expContainer.innerHTML = '';
    CMSState.data.teaching.experiences.forEach((exp, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${exp.title}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeTeachingExp(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Position Title & Dates</label>
                <input type="text" class="form-control" value="${exp.title}" onchange="CMSState.data.teaching.experiences[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Institution / Location</label>
                <input type="text" class="form-control" value="${exp.meta}" onchange="CMSState.data.teaching.experiences[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Bullet Duties (One line per bullet, optional)</label>
                <textarea class="form-control" rows="3" onchange="updateTeachingBullets(${idx}, this.value)">${exp.bullets ? exp.bullets.join('\n') : ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Summary Paragraph (Optional)</label>
                <input type="text" class="form-control" value="${exp.description || ''}" onchange="CMSState.data.teaching.experiences[${idx}].description = this.value">
            </div>
        `;
        expContainer.appendChild(div);
    });

    const trainContainer = document.getElementById('teaching-trainings-list');
    trainContainer.innerHTML = '';
    CMSState.data.teaching.trainings.forEach((tr, idx) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="item-card-header">
                <span class="item-card-title">${tr.title}</span>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="removeTeachingTraining(${idx})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-group">
                <label class="form-label">Training Topic</label>
                <input type="text" class="form-control" value="${tr.title}" onchange="CMSState.data.teaching.trainings[${idx}].title = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Date & Funder</label>
                <input type="text" class="form-control" value="${tr.meta}" onchange="CMSState.data.teaching.trainings[${idx}].meta = this.value">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" rows="2" onchange="CMSState.data.teaching.trainings[${idx}].description = this.value">${tr.description || ''}</textarea>
            </div>
        `;
        trainContainer.appendChild(div);
    });
}

function updateTeachingBullets(idx, val) {
    CMSState.data.teaching.experiences[idx].bullets = val.split('\n').filter(b => b.trim() !== '');
}
function removeTeachingExp(idx) { CMSState.data.teaching.experiences.splice(idx, 1); renderTeachingForm(); }
function addTeachingExp() {
    CMSState.data.teaching.experiences.push({ title: 'Position Title', meta: 'Institution Name', bullets: [], description: '' });
    renderTeachingForm();
}

function removeTeachingTraining(idx) { CMSState.data.teaching.trainings.splice(idx, 1); renderTeachingForm(); }
function addTeachingTraining() {
    CMSState.data.teaching.trainings.push({ title: 'Training Topic', meta: 'Year | Funder', description: 'Summary of training...' });
    renderTeachingForm();
}

// Render Contact Form
function renderContactForm() {
    document.getElementById('contact-intro').value = CMSState.data.contact.intro || '';
    document.getElementById('contact-email').value = CMSState.data.contact.email || '';
}

// ----------------------------------------------------
// 4. SAVE & SERIALIZATION LOGIC
// ----------------------------------------------------
async function saveAllFiles() {
    try {
        syncFormValuesToState();

        // Write newly uploaded photo if pending
        if (CMSState.pendingAvatarFile && CMSState.dirHandle) {
            try {
                const photoDir = await CMSState.dirHandle.getDirectoryHandle('photo', { create: true });
                const imgHandle = await photoDir.getFileHandle(CMSState.pendingAvatarFile.filename, { create: true });
                const imgWritable = await imgHandle.createWritable();
                await imgWritable.write(CMSState.pendingAvatarFile.blob);
                await imgWritable.close();
                CMSState.pendingAvatarFile = null;
            } catch (imgErr) {
                console.error('Error saving image file:', imgErr);
            }
        }

        const generatedFiles = {
            'js/components.js': generateComponentsJs(),
            'index.html': generateIndexHtml(),
            'publications.html': generatePublicationsHtml(),
            'projects.html': generateProjectsHtml(),
            'fieldworks.html': generateFieldworksHtml(),
            'teaching.html': generateTeachingHtml(),
            'contact.html': generateContactHtml()
        };

        if (CMSState.dirHandle) {
            for (const [relPath, content] of Object.entries(generatedFiles)) {
                await writeFileHandle(relPath, content);
            }
            showToast('All static HTML, JS, and image files successfully saved to disk!', 'success');
            return;
        }

        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                CMSState.dirHandle = dirHandle;

                // Save pending photo
                if (CMSState.pendingAvatarFile) {
                    const photoDir = await CMSState.dirHandle.getDirectoryHandle('photo', { create: true });
                    const imgHandle = await photoDir.getFileHandle(CMSState.pendingAvatarFile.filename, { create: true });
                    const imgWritable = await imgHandle.createWritable();
                    await imgWritable.write(CMSState.pendingAvatarFile.blob);
                    await imgWritable.close();
                    CMSState.pendingAvatarFile = null;
                }

                for (const [relPath, content] of Object.entries(generatedFiles)) {
                    await writeFileHandle(relPath, content);
                }
                showToast('Files & images successfully updated directly on disk!', 'success');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }

        showToast('Saving changes... Downloading updated files.', 'info');
        for (const [relPath, content] of Object.entries(generatedFiles)) {
            downloadFile(relPath.split('/').pop(), content);
        }
    } catch (err) {
        console.error('Error saving files:', err);
        showToast('Save failed: ' + err.message, 'error');
    }
}

function syncFormValuesToState() {
    CMSState.data.components.name = document.getElementById('sidebar-name').value;
    CMSState.data.components.role = document.getElementById('sidebar-role').value;
    CMSState.data.components.avatar = document.getElementById('sidebar-avatar').value;

    const keyText = document.getElementById('home-key-areas').value;
    CMSState.data.index.keyAreas = keyText.split('\n').filter(k => k.trim() !== '');

    CMSState.data.index.awards = document.getElementById('home-awards').value.split('\n').filter(a => a.trim() !== '');
    CMSState.data.index.affiliations = document.getElementById('home-affiliations').value.split('\n').filter(a => a.trim() !== '');

    CMSState.data.publications.note = document.getElementById('publications-note').value;

    CMSState.data.fieldworks.heading = document.getElementById('fieldworks-heading').value;
    CMSState.data.fieldworks.description = document.getElementById('fieldworks-desc').value;

    CMSState.data.contact.intro = document.getElementById('contact-intro').value;
    CMSState.data.contact.email = document.getElementById('contact-email').value;
}

async function writeFileHandle(relPath, content) {
    if (!CMSState.dirHandle) return;
    let fileHandle;
    if (relPath.includes('/')) {
        const parts = relPath.split('/');
        const subDir = await CMSState.dirHandle.getDirectoryHandle(parts[0], { create: true });
        fileHandle = await subDir.getFileHandle(parts[1], { create: true });
    } else {
        fileHandle = await CMSState.dirHandle.getFileHandle(relPath, { create: true });
    }

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    CMSState.files[relPath] = { content: content };
}

function downloadFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// ----------------------------------------------------
// 5. HTML & JS CODE GENERATORS
// ----------------------------------------------------
const TAILWIND_HEAD = `    <!-- Google Fonts & FontAwesome -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Tailwind CSS v3 Play CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'brand-green': '#2e7d32',
                        'brand-light-green': '#4caf50',
                        'brand-bg': '#f1f8e9',
                        'brand-accent': '#e8f5e9',
                    },
                    fontFamily: {
                        heading: ['Montserrat', 'sans-serif'],
                        body: ['Inter', 'sans-serif'],
                    }
                }
            }
        }
    </script>`;

function generateComponentsJs() {
    const c = CMSState.data.components;
    const formattedRole = c.role.replace(/\n/g, '<br>');

    const socialsHtml = c.socials.map(s => {
        return `                <li><a href="${s.href}" target="_blank" class="flex items-center text-sm text-gray-700 hover:text-brand-green transition-colors"><i class="${s.iconClass} w-6 text-brand-green"></i> ${s.label}</a></li>`;
    }).join('\n');

    return `document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSidebar();
    initFooter();
});

function initNavigation() {
    const header = document.getElementById('header-placeholder');
    if (!header) return;

    const currentPage = window.location.pathname.split("/").pop() || 'index.html';

    const getNavClass = (page) => {
        const isActive = currentPage === page;
        return \`font-heading font-medium transition-colors duration-200 px-3 py-1.5 rounded-md \${
            isActive 
                ? 'text-brand-green bg-emerald-50 font-semibold' 
                : 'text-gray-700 hover:text-brand-green hover:bg-emerald-50/50'
        }\`;
    };

    header.innerHTML = \`
        <header class="bg-white shadow-sm fixed top-0 left-0 right-0 w-full z-50 border-b border-emerald-100">
            <div class="max-w-6xl mx-auto px-4 sm:px-6">
                <nav class="flex justify-between items-center h-16 relative">
                    <div class="flex items-center">
                        <a href="index.html" class="font-heading font-bold text-lg sm:text-xl text-brand-green hover:text-emerald-800 transition-colors">
                            ${c.name || 'Dr. Md. Saidur Rahman'}
                        </a>
                    </div>
                    
                    <button id="menu-toggle" class="md:hidden text-brand-green p-2 focus:outline-none hover:bg-emerald-50 rounded-md">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                    
                    <ul id="nav-menu" class="hidden md:flex items-center space-x-2 absolute md:relative top-16 md:top-0 left-0 right-0 bg-white md:bg-transparent shadow-md md:shadow-none p-4 md:p-0 border-b md:border-none border-emerald-100 flex-col md:flex-row space-y-2 md:space-y-0 w-full md:w-auto z-50">
                        <li><a href="index.html" class="\${getNavClass('index.html')}">Home</a></li>
                        <li><a href="publications.html" class="\${getNavClass('publications.html')}">Publications</a></li>
                        <li><a href="projects.html" class="\${getNavClass('projects.html')}">Projects</a></li>
                        <li><a href="fieldworks.html" class="\${getNavClass('fieldworks.html')}">Field Works</a></li>
                        <li><a href="teaching.html" class="\${getNavClass('teaching.html')}">Teaching</a></li>
                        <li><a href="contact.html" class="\${getNavClass('contact.html')}">Contact</a></li>
                        <li><a href="CV/CV_Saidur_Rahman_UK1.pdf" target="_blank" class="font-heading font-semibold text-white bg-brand-green hover:bg-emerald-800 transition-colors px-4 py-1.5 rounded-md inline-block shadow-sm">CV</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    \`;

    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('hidden');
            navMenu.classList.toggle('flex');
        });
    }
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar-placeholder');
    if (!sidebar) return;

    sidebar.innerHTML = \`
        <div class="bg-white rounded-xl shadow-md p-6 border border-emerald-100 text-center sticky top-24">
            <img src="${c.avatar || 'photo/profile.jpg'}" alt="${c.name || 'Profile'}" class="w-44 h-44 rounded-full border-4 border-white shadow-md mx-auto mb-5 object-cover">
            <h1 class="font-heading font-bold text-xl text-brand-green mb-2">${c.name || ''}</h1>
            <p class="text-sm text-gray-600 mb-6 leading-relaxed">${formattedRole}</p>
            
            <ul class="space-y-3 text-left border-t border-emerald-50 pt-5">
${socialsHtml}
            </ul>
        </div>
    \`;
}

function initFooter() {
    const footer = document.getElementById('footer-placeholder');
    if (!footer) return;

    footer.innerHTML = \`
        <footer class="bg-brand-green text-white text-center py-8 mt-16 border-t border-emerald-800">
            <div class="max-w-6xl mx-auto px-4 space-y-1">
                <p class="font-medium">&copy; \${new Date().getFullYear()} ${c.name || 'Dr. Md. Saidur Rahman'}. All rights reserved.</p>
                <p class="text-sm text-emerald-100 opacity-90">Professor, Khulna University, Bangladesh</p>
            </div>
        </footer>
    \`;
}
`;
}

function generateIndexHtml() {
    const idx = CMSState.data.index;

    const aboutParas = idx.about.map(p => `                        <p>${p}</p>`).join('\n');
    const keyList = idx.keyAreas.map(k => `                        <li class="flex items-center text-gray-700 bg-emerald-50/60 p-3 rounded-lg border border-emerald-100"><i class="fas fa-check-circle text-brand-green mr-3"></i> ${k}</li>`).join('\n');

    const eduHtml = idx.education.map(e => {
        let pContent = '';
        if (e.paragraphs && e.paragraphs.length > 0) {
            pContent = e.paragraphs.map(p => `                            <p class="text-gray-700 text-sm mt-1">${p}</p>`).join('\n');
        }
        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-lg text-gray-900 block">${e.title}</span>
                            <span class="text-sm text-emerald-700 font-medium italic block mb-2">${e.meta}</span>
${pContent}
                        </div>`;
    }).join('\n');

    const confHtml = idx.conferences.map(c => {
        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-gray-900 block">${c.title}</span>
                            <p class="text-gray-700 text-sm mt-1">${c.description}</p>
                        </div>`;
    }).join('\n');

    const awardsHtml = idx.awards.map(a => `                        <li class="text-gray-700 bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">${a}</li>`).join('\n');
    const affHtml = idx.affiliations.map(af => `                        <li class="text-gray-700">${af}</li>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Portfolio of Dr. Md. Saidur Rahman, Professor of Forestry and Wood Technology at Khulna University, Bangladesh. Specialist in mangrove ecology and management.">
    <meta name="keywords" content="Dr. Md. Saidur Rahman, Khulna University, Forestry, Mangrove Ecology, Remote Sensing, GIS, Carbon Inventory, Bangladesh">
    <meta name="author" content="${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}">
    <title>${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'} | Home</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-56 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');">
        <div class="max-w-6xl mx-auto px-4 sm:px-6"></div>
    </div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-20 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100 space-y-10">
                <section id="about">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">About Myself</h2>
                    <div class="space-y-4 text-gray-700 leading-relaxed text-justify">
${aboutParas}
                    </div>
                </section>

                <section id="key-areas">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Key Areas of Expertise</h2>
                    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
${keyList}
                    </ul>
                </section>

                <section id="education">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Education</h2>
                    <div class="space-y-6 divide-y divide-emerald-50">
${eduHtml}
                    </div>
                </section>

                <section id="conferences">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Conferences</h2>
                    <div class="space-y-6 divide-y divide-emerald-50">
${confHtml}
                    </div>
                </section>

                <section id="awards">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Awards, Scholarships and Prizes</h2>
                    <ul class="space-y-3">
${awardsHtml}
                    </ul>
                </section>

                <section id="affiliations">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Professional Affiliations</h2>
                    <ul class="space-y-3">
${affHtml}
                    </ul>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generatePublicationsHtml() {
    const pub = CMSState.data.publications;

    const itemsHtml = pub.items.map(p => {
        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-gray-900 block">${p.title}</span>
                            <span class="text-sm text-emerald-700 italic block mt-1">${p.meta}</span>
                        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Publications and Journal Articles of Dr. Md. Saidur Rahman. Specialist in mangrove ecology and remote sensing.">
    <title>Publications | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-44 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');"></div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-16 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100">
                <section id="publications">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Journal Articles</h2>
                    
                    <div class="space-y-6 divide-y divide-emerald-50 mb-8">
${itemsHtml}
                    </div>

                    <p class="text-xs text-gray-500 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100"><em>${pub.note || 'Note: This is a selected list of publications.'}</em></p>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateProjectsHtml() {
    const proj = CMSState.data.projects;

    const currHtml = proj.current.map(p => {
        const descHtml = p.description ? `\n                            <p class="text-gray-700 text-sm mt-2">${p.description}</p>` : '';
        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-gray-900 block text-lg">${p.title}</span>
                            <span class="text-sm text-emerald-700 italic block mt-1">${p.meta}</span>${descHtml}
                        </div>`;
    }).join('\n');

    const pastHtml = proj.past.map(p => {
        const descHtml = p.description ? `\n                            <p class="text-gray-700 text-sm mt-2">${p.description}</p>` : '';
        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-gray-900 block">${p.title}</span>
                            <span class="text-sm text-emerald-700 italic block mt-1">${p.meta}</span>${descHtml}
                        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Research projects and experiences of Dr. Md. Saidur Rahman. Focus on mangrove restoration and climate change adaptation.">
    <title>Projects | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-44 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');"></div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-16 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100 space-y-10">
                <section id="projects">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Current Research Projects</h2>
                    
                    <div class="space-y-6 divide-y divide-emerald-50 mb-10">
${currHtml}
                    </div>

                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Past Research Projects</h2>

                    <div class="space-y-6 divide-y divide-emerald-50">
${pastHtml}
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateFieldworksHtml() {
    const fw = CMSState.data.fieldworks;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Field works and ecological surveys conducted by Dr. Md. Saidur Rahman.">
    <title>Field Works | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-44 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');"></div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-16 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100">
                <section id="field-works">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">${fw.heading || 'Field Works'}</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">${fw.description || 'Information about field works, ecological surveys, and site visits will be updated soon.'}</p>
                    
                    <div class="h-72 bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-xl flex items-center justify-center text-emerald-600 font-medium">
                        <span class="flex items-center gap-2"><i class="fas fa-images"></i> Gallery coming soon...</span>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateTeachingHtml() {
    const t = CMSState.data.teaching;

    const expHtml = t.experiences.map(e => {
        let listItems = '';
        if (e.bullets && e.bullets.length > 0) {
            listItems = `\n                            <ul class="list-disc list-inside space-y-2 text-gray-700 text-sm pl-2">\n` + e.bullets.map(b => `                                <li>${b}</li>`).join('\n') + `\n                            </ul>`;
        }
        let descP = e.description ? `\n                            <p class="text-gray-700 text-sm mt-2">${e.description}</p>` : '';

        return `                        <div class="pt-4 first:pt-0">
                            <span class="font-semibold text-gray-900 block text-lg">${e.title}</span>
                            <span class="text-sm text-emerald-700 italic block mt-1 mb-3">${e.meta}</span>${listItems}${descP}
                        </div>`;
    }).join('\n');

    const trainHtml = t.trainings.map(tr => {
        let descP = tr.description ? `\n                            <p class="text-gray-700 text-sm mt-2">${tr.description}</p>` : '';
        return `                        <div class="pt-2">
                            <span class="font-semibold text-gray-900 block text-lg">${tr.title}</span>
                            <span class="text-sm text-emerald-700 italic block mt-1">${tr.meta}</span>${descP}
                        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Teaching experiences, courses, and trainings conducted by Dr. Md. Saidur Rahman at Khulna University.">
    <title>Teaching | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-44 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');"></div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-16 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100 space-y-10">
                <section id="teaching">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Teaching Experiences</h2>
                    
                    <div class="space-y-6 divide-y divide-emerald-50 mb-10">
${expHtml}
                    </div>

                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Trainings Conducted</h2>
                    <div class="space-y-6">
${trainHtml}
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

function generateContactHtml() {
    const c = CMSState.data.contact;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Contact information for Dr. Md. Saidur Rahman. Get in touch for research collaborations and academic inquiries.">
    <title>Contact | ${CMSState.data.components.name || 'Dr. Md. Saidur Rahman'}</title>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
${TAILWIND_HEAD}
</head>
<body class="bg-brand-bg font-body text-gray-900 pt-16 min-h-screen flex flex-col justify-between">
    <div id="header-placeholder"></div>

    <div class="h-44 bg-cover bg-center relative shadow-inner" style="background-image: linear-gradient(rgba(46, 125, 50, 0.35), rgba(46, 125, 50, 0.35)), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80');"></div>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-16 relative z-10 mb-12">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div id="sidebar-placeholder" class="md:col-span-4"></div>

            <div class="md:col-span-8 bg-white rounded-xl shadow-md p-6 sm:p-10 border border-emerald-100">
                <section id="contact">
                    <h2 class="font-heading font-bold text-2xl text-brand-green border-b-2 border-emerald-100 pb-3 mb-6">Contact Information</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">${c.intro || 'For research collaborations, academic inquiries, or student supervision, please feel free to reach out via the following channels:'}</p>
                    
                    <div class="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100 max-w-lg">
                        <p class="flex items-center text-gray-800 font-medium">
                            <i class="fas fa-envelope text-brand-green text-xl w-8"></i> 
                            <span class="mr-2">Email:</span> 
                            <a href="mailto:${c.email}" class="text-brand-green hover:underline font-semibold">${c.email}</a>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    </main>

    <div id="footer-placeholder"></div>
    <script src="js/components.js"></script>
</body>
</html>
`;
}

// ----------------------------------------------------
// 6. MODALS & UTILITIES
// ----------------------------------------------------
function openPreviewModal() {
    syncFormValuesToState();
    const modal = document.getElementById('modal-preview');
    const frame = document.getElementById('preview-iframe');
    
    const previewContent = generateIndexHtml();
    frame.srcdoc = previewContent;
    modal.classList.add('active');
}

function closePreviewModal() {
    document.getElementById('modal-preview').classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'warning' ? 'toast-warning' : '')}`;
    
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-triangle-exclamation',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
